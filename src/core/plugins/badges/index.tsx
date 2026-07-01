import { after } from "@lib/api/patcher";
import { onJsxCreate } from "@lib/api/react/jsx";
import { findByNameLazy } from "@metro";
import { defineCorePlugin } from "..";
import { FluxDispatcher } from "@metro/common";

interface Badge {
    label: string;
    url: string;
}

interface UserBadgeData {
    roles?: string[];
    custom?: Badge[];
}

interface BadgeData {
    [userId: string]: UserBadgeData;
}

interface RoleData {
    label: string;
    url: string;
}

interface RolesData {
    [roleName: string]: RoleData;
}

interface EquicordBadge {
    tooltip: string;
    badge: string;
}

const useBadgesModule = findByNameLazy("useBadges", false);

const badgesCache = new Map<string, Badge[]>();
const badgeProps = new Map<string, Record<string, any>>();
const pendingRequests = new Set<string>();

export default defineCorePlugin({
    manifest: {
        id: "bunny.badges",
        version: "1.2.0",
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
        onJsxCreate("ProfileBadge", (component, ret) => {
            if (ret.props.id?.startsWith("rain-")) {
                const cachedProps = badgeProps.get(ret.props.id);
                if (cachedProps) {
                    ret.props.source = cachedProps.source;
                    ret.props.label = cachedProps.label;
                    ret.props.id = cachedProps.id;
                }
            }
        });

        onJsxCreate("RenderedBadge", (component, ret) => {
            if (ret.props.id?.startsWith("rain-")) {
                const cachedProps = badgeProps.get(ret.props.id);
                if (cachedProps) {
                    Object.assign(ret.props, cachedProps);
                }
            }
        });

        // Small helper so one failing/optional source can't take down the others.
        const safeFetchJson = async <T,>(url: string, fallback: T): Promise<T> => {
            try {
                const res = await fetch(url);
                if (!res.ok) return fallback;
                return (await res.json()) as T;
            } catch {
                return fallback;
            }
        };

        const fetchAndProcessBadges = async (userId: string) => {
            if (pendingRequests.has(userId)) return;
            pendingRequests.add(userId);

            try {
                const [
                    goonBadgesData,
                    goonRolesData,
                    rainBadgesData,
                    rainRolesData,
                    equicordData,
                ] = await Promise.all([
                    safeFetchJson<BadgeData>(
                        "https://codeberg.org/chocomint-chan/GoonCord_Badges/raw/branch/main/badges.json",
                        {}
                    ),
                    safeFetchJson<RolesData>(
                        "https://codeberg.org/chocomint-chan/GoonCord_Badges/raw/branch/main/assets/roles/roles.json",
                        {}
                    ),
                    safeFetchJson<BadgeData>(
                        "https://codeberg.org/raincord/badges/raw/branch/main/badges.json",
                        {}
                    ),
                    safeFetchJson<RolesData>(
                        "https://codeberg.org/raincord/badges/raw/branch/main/assets/roles/roles.json",
                        {}
                    ),
                    safeFetchJson<Record<string, EquicordBadge[]>>(
                        "https://badge.equicord.org/badges.json",
                        {}
                    ),
                ]);

                const allBadges: Badge[] = [];

                // GoonCord and raincord badge/role sets are keyed independently,
                // so each source is resolved against its own roles file.
                const badgeSources: Array<{ badges: BadgeData; roles: RolesData }> = [
                    { badges: goonBadgesData, roles: goonRolesData },
                    { badges: rainBadgesData, roles: rainRolesData },
                ];

                badgeSources.forEach(({ badges, roles }) => {
                    const userBadgeData = badges[userId];
                    if (!userBadgeData) return;

                    // process role badges
                    userBadgeData.roles?.forEach(roleName => {
                        const roleData = roles[roleName];
                        if (roleData) {
                            allBadges.push({
                                label: roleData.label,
                                url: roleData.url,
                            });
                        }
                    });

                    // process custom badges
                    if (userBadgeData.custom) {
                        allBadges.push(...userBadgeData.custom);
                    }
                });

                // process equicord badges
                const equicordUserBadges = equicordData[userId] ?? [];
                equicordUserBadges.forEach(b => {
                    allBadges.push({ label: b.tooltip, url: b.badge });
                });

                badgesCache.set(userId, allBadges);

                allBadges.forEach((badge, i) => {
                    const badgeId = `rain-${userId}-${i}`;
                    badgeProps.set(badgeId, {
                        id: badgeId,
                        source: { uri: badge.url },
                        label: badge.label,
                        userId,
                    });
                });

                FluxDispatcher.dispatch({ type: "USER_UPDATE", user: { id: userId } });
            } catch (err) {
                console.error("[bunny.badges] Failed to fetch/process badges:", err);
            } finally {
                pendingRequests.delete(userId);
            }
        };

        return after("default", useBadgesModule, ([user], result) => {
            if (!user) return;

            const userId = user.userId;
            const cached = badgesCache.get(userId);

            if (!cached) {
                if (!pendingRequests.has(userId)) {
                    fetchAndProcessBadges(userId);
                }
                return;
            }

            cached.forEach((badge, i) => {
                const badgeId = `rain-${userId}-${i}`;

                result.unshift({
                    id: badgeId,
                    description: badge.label,
                    icon: " _",
                });
            });
        });
    },
});
