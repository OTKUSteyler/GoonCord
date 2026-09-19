import { settings } from "@lib/api/settings";
import { findByProps, findByPropsLazy, findByStoreNameLazy } from "@metro";

import { parseColorManifest } from "./parser";
import { ColorManifest, InternalColorDefinition } from "./types";

const AppearanceManager = findByPropsLazy("updateTheme");
const ThemeStore = findByStoreNameLazy("ThemeStore");
const FormDivider = findByPropsLazy("DIVIDER_COLORS");

let _inc = 1;

interface InternalColorRef {
    key: `bn-theme-${string}`;
    current: InternalColorDefinition | null;
    readonly origRaw: Record<string, string>;
    lastSetDiscordTheme: string;
}

/** @internal */
export const _colorRef: InternalColorRef = {
    current: null,
    key: `bn-theme-${_inc}`,
    origRaw: {},
    lastSetDiscordTheme: "dark"
};

export function updateBunnyColor(colorManifest: ColorManifest | null, { update = true }) {
    if (settings.safeMode?.enabled) return;

    const tokenRef = findByProps("SemanticColor");
    if (tokenRef?.RawColor && Object.keys(_colorRef.origRaw).length === 0) {
        Object.assign(_colorRef.origRaw, tokenRef.RawColor);
    }

    const internalDef = colorManifest ? parseColorManifest(colorManifest) : null;
    const currentThemeName = ThemeStore?.theme ?? "dark";
    const ref = Object.assign(_colorRef, {
        current: internalDef,
        key: `bn-theme-${++_inc}` as const,
        lastSetDiscordTheme: !currentThemeName.startsWith("bn-theme-")
            ? currentThemeName
            : _colorRef.lastSetDiscordTheme
    });

    if (internalDef != null && tokenRef) {
        try {
            if (tokenRef.Theme) {
                tokenRef.Theme[ref.key.toUpperCase()] = ref.key;
            }

            const targetRef = ref.current?.reference ?? "dark";

            if (FormDivider?.DIVIDER_COLORS) {
                const dividerFallback = FormDivider.DIVIDER_COLORS[targetRef] ??
                    FormDivider.DIVIDER_COLORS.dark ??
                    FormDivider.DIVIDER_COLORS.darker ??
                    Object.values(FormDivider.DIVIDER_COLORS)[0];
                FormDivider.DIVIDER_COLORS[ref.key] = dividerFallback;
            }

            if (tokenRef.Shadow) {
                Object.keys(tokenRef.Shadow).forEach(k => {
                    const shadowGroup = tokenRef.Shadow[k];
                    if (shadowGroup) {
                        const shadowFallback = shadowGroup[targetRef] ??
                            shadowGroup.dark ??
                            shadowGroup.darker ??
                            shadowGroup.midnight ??
                            shadowGroup.onyx ??
                            Object.values(shadowGroup)[0];
                        shadowGroup[ref.key] = shadowFallback;
                    }
                });
            }

            if (tokenRef.SemanticColor) {
                Object.keys(tokenRef.SemanticColor).forEach(k => {
                    const colorGroup = tokenRef.SemanticColor[k];
                    if (colorGroup) {
                        const colorFallback = colorGroup[targetRef] ??
                            colorGroup.dark ??
                            colorGroup.darker ??
                            colorGroup.midnight ??
                            colorGroup.onyx ??
                            Object.values(colorGroup)[0];
                        colorGroup[ref.key] = { ...colorFallback };
                    }
                });
            }
        } catch (e) {
            console.error("Failed to register custom theme keys:", e);
        }
    }

    if (update && AppearanceManager?.updateTheme) {
        try {
            AppearanceManager.setShouldSyncAppearanceSettings?.(false);
        } catch {}

        const targetTheme = ref.current != null ? ref.key : ref.lastSetDiscordTheme;

        try {
            AppearanceManager.updateTheme(targetTheme);
        } catch (e) {
            console.error(`Native rejected theme "${targetTheme}", reverting to "${ref.lastSetDiscordTheme}"`, e);
            try {
                AppearanceManager.updateTheme(ref.lastSetDiscordTheme);
            } catch (e2) {
                console.error("Fallback theme also failed to apply", e2);
            }
        }
    }
}
