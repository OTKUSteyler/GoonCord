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

const badgesCache = new Map<string, Badge[]>();
const badgeProps = new Map<string, Record<string, any>>();
const pendingRequests = new Set<string>();

// Resolve the useBadges hook through several strategies, since the
// module layout changes between Discord builds.
function resolveUseBadges(): { target: any; key: string } | null {
    const attempts: Array<[string, () => { target: any; key: string } | null]> = [
        ["name/default", () => {
            const m = findByName("useBadges", false);
            return m && typeof m.default === "function" ? { target: m, key: "default" } : null;
        }],
        ["name/direct", () => {
            const m = findByName("useBadges");
            return typeof m === "function" ? { target: { useBadges: m }, key: "useBadges" } : null;
        }],
        ["props", () => {
            const m = findByProps("useBadges");
            return m && typeof m.useBadges === "function" ? { target: m, key: "useBadges" } : null;
        }],
    ];

    for (const [label, attempt] of attempts) {
        try {
            const found = attempt();
            if (found) {
                console.log(`${TAG} resolved useBadges via ${label}`);
                return found;
            }
        } catch { /* try next */ }
    }
    return null;
}

const getUserId = (arg: any): string | undefined =>
    typeof arg === "string" ? arg : arg?.userId ?? arg?.id;

const safeFetchJson = async <T,>(url: string, fallback: T): Promise<T> => {
    try {
        const res = await fetch(url);
        if (!res.ok) return fallback;
        return (await res.json()) as T;
    } catch {
        return fallback;
    }
};

export default defineCorePlugin({
    manifest: {
        id: "bunny.badges",
        version: "1.2.1",
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
            const cachedProps = badgeProps.get(ret.props.id);
            if (cachedProps) Object.assign(ret.props, cachedProps);
        };

        // Component names may change between builds; keep both hooks.
        onJsxCreate("ProfileBadge", (_c, ret) => {
            if (ret.props?.id?.startsWith(PREFIX)) applyCached(ret);
        });
        onJsxCreate("RenderedBadge", (_c, ret) => {
            if (ret.props?.id?.startsWith(PREFIX)) applyCached(ret);
        });

        const fetchAndProcessBadges = async (userId: string) => {
            if (pendingRequests.has(userId)) return;
            pendingRequests.add(userId);

            try {
                const [goonBadges, goonRoles, rainBadges, rainRoles, equicord] =
                    await Promise.all([
                        safeFetchJson<BadgeData>("https://codeberg.org/chocomint-chan/GoonCord_Badges/raw/branch/main/badges.json", {}),
                        safeFetchJson<RolesData>("https://codeberg.org/chocomint-chan/GoonCord_Badges/raw/branch/main/assets/roles/roles.json", {}),
                        safeFetchJson<BadgeData>("https://codeberg.org/raincord/badges/raw/branch/main/badges.json", {}),
                        safeFetchJson<RolesData>("https://codeberg.org/raincord/badges/raw/branch/main/assets/roles/roles.json", {}),
                        safeFetchJson<Record<string, EquicordBadge[]>>("https://badge.equicord.org/badges.json", {}),
                    ]);

                const allBadges: Badge[] = [];

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
        };

        const resolved = resolveUseBadges();
        if (!resolved) {
            console.error(`${TAG} could not find useBadges; Discord likely changed it again`);
            return;
        }

        return after(resolved.key, resolved.target, (args: any[], result: any) => {
            const userId = getUserId(args?.[0]);
            if (!userId || !Array.isArray(result)) return;

            const cached = badgesCache.get(userId);
            if (!cached) {
                fetchAndProcessBadges(userId);
                return;
            }

            // Drop anything we injected previously (memoized results), then re-add.
            const base = result.filter(b => !String(b?.id ?? "").startsWith(PREFIX));
            const mine = cached.map((badge, i) => ({
                id: `${PREFIX}${userId}-${i}`,
                description: badge.label,
                icon: " _",
            }));

            return [...mine, ...base];
        });
    },
});
