import { after } from "@lib/api/patcher";
import { onJsxCreate } from "@lib/api/react/jsx";
import { findByName, findByProps } from "@metro";
import { defineCorePlugin } from "..";
import { FluxDispatcher } from "@metro/common";

interface Badge { label: string; url: string }
interface UserBadgeData { roles?: string[]; custom?: Badge[] }
interface BadgeData { [userId: string]: UserBadgeData }
interface RoleData { label: string; url: string }
interface RolesData { [roleName: string]: RoleData }
interface EquicordBadge { tooltip: string; badge: string }

const TAG = "[bunny.badges]";
const PREFIX = "rain-";
const RETRY_MS = 3000;
const MAX_RETRIES = 40; // ~2 minutes; modules may not be loaded at startup

const badgesCache = new Map<string, Badge[]>();
const badgeProps = new Map<string, Record<string, any>>();
const pendingRequests = new Set<string>();

type Target = { target: any; key: string; via: string };

const safe = <T,>(fn: () => T): T | null => {
    try { return fn(); } catch { return null; }
};

// Scan every initialized Metro module for a badge hook by name, then by source.
// Used when the name based lookups fail because Discord renamed/minified it.
function scanModules(): Target | null {
    const registry = (globalThis as any).modules;
    if (!registry) return null;

    let sourceMatch: Target | null = null;
    const candidates: string[] = [];

    for (const id in registry) {
        const mod = registry[id];
        if (!mod?.isInitialized) continue;
        const ex = safe(() => mod.publicModule?.exports);
        if (!ex || (typeof ex !== "object" && typeof ex !== "function")) continue;

        const keys = ["default", ...(safe(() => Object.keys(ex)) ?? [])];
        for (const key of keys) {
            const fn = safe(() => ex[key]);
            if (typeof fn !== "function") continue;

            const name: string = fn.name || key;

            // Skip obvious styling hooks (e.g. useBadgeTextVariant).
            if (/variant|text|color|style|theme|size|font/i.test(name)) continue;

            if (/^use/i.test(name) && (/badge/i.test(name) || /badge/i.test(key))) {
                const src = safe(() => Function.prototype.toString.call(fn)) ?? "";
                candidates.push(`${id}:${key}(${src.length}b)`);

                // A name match only counts if the source also builds badge-like objects.
                if (src.length < 12000 && /description/.test(src) && /icon/.test(src)) {
                    return { target: ex, key, via: `scan/name+source (module ${id}, ${key})` };
                }
            }

            // Fallback: a small use... function whose source builds badge objects.
            if (!sourceMatch && /^use/i.test(name)) {
                const src = safe(() => Function.prototype.toString.call(fn)) ?? "";
                if (src.length < 8000 && /badge/i.test(src) && /description/.test(src) && /icon/.test(src)) {
                    sourceMatch = { target: ex, key, via: `scan/source (module ${id}, ${key})` };
                }
            }
        }
    }
    if (!sourceMatch) console.log(`${TAG} scan candidates (rejected): ${candidates.join(", ") || "none"}`);
    return sourceMatch;
}

function resolveUseBadges(): Target | null {
    const attempts: Array<() => Target | null> = [
        () => {
            const m = findByName("useBadges", false);
            return m && typeof m.default === "function"
                ? { target: m, key: "default", via: "findByName/default" } : null;
        },
        () => {
            const m = findByProps("useBadges");
            return m && typeof m.useBadges === "function"
                ? { target: m, key: "useBadges", via: "findByProps" } : null;
        },
        () => {
            const m = findByName("useBadges");
            return typeof m === "function"
                ? { target: { useBadges: m }, key: "useBadges", via: "findByName/direct" } : null;
        },
        scanModules,
    ];

    for (const attempt of attempts) {
        const found = safe(attempt);
        if (found) return found;
    }
    return null;
}

const getUserId = (arg: any): string | undefined =>
    typeof arg === "string" ? arg : arg?.userId ?? arg?.id;

// The hook may return the array directly or wrap it, e.g. { badges: [...] }.
const getList = (result: any): any[] | null => {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.badges)) return result.badges;
    return null;
};

const safeFetchJson = async <T,>(url: string, fallback: T): Promise<T> => {
    try {
        const res = await fetch(url);
        if (!res.ok) return fallback;
        return (await res.json()) as T;
    } catch {
        return fallback;
    }
};

async function fetchAndProcessBadges(userId: string) {
    if (pendingRequests.has(userId)) return;
    pendingRequests.add(userId);

    try {
        const [goonBadges, goonRoles, rainBadges, rainRoles, equicord] = await Promise.all([
            safeFetchJson<BadgeData>("https://codeberg.org/chocomint-chan/GoonCord_Badges/raw/branch/main/badges.json", {}),
            safeFetchJson<RolesData>("https://codeberg.org/chocomint-chan/GoonCord_Badges/raw/branch/main/assets/roles/roles.json", {}),
            safeFetchJson<BadgeData>("https://codeberg.org/raincord/badges/raw/branch/main/badges.json", {}),
            safeFetchJson<RolesData>("https://codeberg.org/raincord/badges/raw/branch/main/assets/roles/roles.json", {}),
            safeFetchJson<Record<string, EquicordBadge[]>>("https://badge.equicord.org/badges.json", {}),
        ]);

        const allBadges: Badge[] = [];

        // Each source resolves roles against its own roles file.
        for (const { badges, roles } of [
            { badges: goonBadges, roles: goonRoles },
            { badges: rainBadges, roles: rainRoles },
        ]) {
            const data = badges[userId];
            if (!data) continue;

            data.roles?.forEach(name => {
                const role = roles[name];
                if (role) allBadges.push({ label: role.label, url: role.url });
            });
            if (data.custom) allBadges.push(...data.custom);
        }

        (equicord[userId] ?? []).forEach(b =>
            allBadges.push({ label: b.tooltip, url: b.badge })
        );

        badgesCache.set(userId, allBadges);

        allBadges.forEach((badge, i) => {
            const id = `${PREFIX}${userId}-${i}`;
            badgeProps.set(id, {
                id,
                source: { uri: badge.url },
                label: badge.label,
                userId,
            });
        });

        FluxDispatcher.dispatch({ type: "USER_UPDATE", user: { id: userId } });
    } catch (err) {
        console.error(`${TAG} Failed to fetch/process badges:`, err);
    } finally {
        pendingRequests.delete(userId);
    }
}

export default defineCorePlugin({
    manifest: {
        id: "bunny.badges",
        version: "1.3.0",
        type: "plugin",
        spec: 3,
        main: "",
        display: {
            name: "Badges",
            description: "Adds badges to user's profile",
            authors: [{ name: "cocobo1" }, { name: "pylixonly" }],
        },
    },

    start() {
        const applyCached = (ret: any) => {
            const cached = badgeProps.get(ret.props.id);
            if (cached) Object.assign(ret.props, cached);
        };

        // Keep both component hooks; names can differ between builds.
        onJsxCreate("ProfileBadge", (_c, ret) => {
            if (ret.props?.id?.startsWith(PREFIX)) applyCached(ret);
        });
        onJsxCreate("RenderedBadge", (_c, ret) => {
            if (ret.props?.id?.startsWith(PREFIX)) applyCached(ret);
        });

        let unpatch: (() => void) | null = null;
        let timer: ReturnType<typeof setInterval> | null = null;
        let loggedShape = false;

        const patch = (found: Target) => {
            console.log(`${TAG} patching useBadges via ${found.via}`);

            unpatch = after(found.key, found.target, (args: any[], result: any) => {
                const userId = getUserId(args?.[0]);
                const list = getList(result);

                if (!loggedShape) {
                    loggedShape = true;
                    console.log(
                        `${TAG} hook called; arg=${JSON.stringify(args?.[0])?.slice(0, 120)} ` +
                        `resultType=${Array.isArray(result) ? "array" : typeof result}`
                    );
                }

                if (!userId || !list) return;

                const cached = badgesCache.get(userId);
                if (!cached) {
                    fetchAndProcessBadges(userId);
                    return;
                }

                // Remove entries we injected on a previous (memoized) render.
                for (let i = list.length - 1; i >= 0; i--) {
                    if (String(list[i]?.id ?? "").startsWith(PREFIX)) list.splice(i, 1);
                }

                // Mutate in place so it works whether or not the patcher
                // uses the callback's return value.
                list.unshift(
                    ...cached.map((badge, i) => ({
                        id: `${PREFIX}${userId}-${i}`,
                        description: badge.label,
                        icon: " _",
                    }))
                );
            });
        };

        const tryResolve = (): boolean => {
            const found = resolveUseBadges();
            if (!found) return false;
            patch(found);
            return true;
        };

        // The hook's module may not be initialized yet at startup, so retry.
        if (!tryResolve()) {
            console.warn(`${TAG} useBadges not found yet, retrying...`);
            let tries = 0;
            timer = setInterval(() => {
                tries++;
                if (tryResolve()) {
                    clearInterval(timer!);
                    timer = null;
                } else if (tries >= MAX_RETRIES) {
                    clearInterval(timer!);
                    timer = null;
                    console.error(`${TAG} could not find useBadges; Discord likely changed it again`);
                }
            }, RETRY_MS);
        }

        return () => {
            if (timer) clearInterval(timer);
            unpatch?.();
        };
    },
});
