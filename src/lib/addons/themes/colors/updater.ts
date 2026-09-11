import { settings } from "@lib/api/settings";
import { findByProps, findByPropsLazy, findByStoreNameLazy } from "@metro";

import { parseColorManifest } from "./parser";
import { ColorManifest, InternalColorDefinition } from "./types";

const tokenRef = findByProps("SemanticColor");
const origRawColor = { ...tokenRef.RawColor };
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
    origRaw: origRawColor,
    lastSetDiscordTheme: "darker"
};

export function updateBunnyColor(colorManifest: ColorManifest | null, { update = true }) {
    if (settings.safeMode?.enabled) return;

    const internalDef = colorManifest ? parseColorManifest(colorManifest) : null;
    const ref = Object.assign(_colorRef, {
        current: internalDef,
        key: `bn-theme-${++_inc}`,
        lastSetDiscordTheme: !ThemeStore.theme.startsWith("bn-theme-")
            ? ThemeStore.theme
            : _colorRef.lastSetDiscordTheme
    });

    if (internalDef != null) {
        // Register the synthetic key BEFORE calling native, and verify it actually
        // landed in every table native reads from. If any registration step fails,
        // bail out to a known-good theme instead of handing native an unknown key.
        try {
            tokenRef.Theme[ref.key.toUpperCase()] = ref.key;

            if (!FormDivider.DIVIDER_COLORS[ref.current!.reference]) {
                throw new Error(`Missing divider color reference: ${ref.current!.reference}`);
            }
            FormDivider.DIVIDER_COLORS[ref.key] = FormDivider.DIVIDER_COLORS[ref.current!.reference];

            Object.keys(tokenRef.Shadow).forEach(k => {
                if (!(ref.current!.reference in tokenRef.Shadow[k])) {
                    throw new Error(`Missing shadow reference: ${ref.current!.reference}`);
                }
                tokenRef.Shadow[k][ref.key] = tokenRef.Shadow[k][ref.current!.reference];
            });

            Object.keys(tokenRef.SemanticColor).forEach(k => {
                if (!(ref.current!.reference in tokenRef.SemanticColor[k])) {
                    throw new Error(`Missing semantic color reference: ${ref.current!.reference}`);
                }
                tokenRef.SemanticColor[k][ref.key] = {
                    ...tokenRef.SemanticColor[k][ref.current!.reference]
                };
            });
        } catch (e) {
            console.error("Failed to register custom theme key, falling back", e);
            ref.current = null; // force fallback path below
        }
    }

    if (update) {
        AppearanceManager.setShouldSyncAppearanceSettings(false);

        const targetTheme = ref.current != null ? ref.key : ref.lastSetDiscordTheme;

        // This is the actual crash site: a raw call into native code with no
        // guard. Wrap it so a native-side rejection can't take the whole
        // bridge/thread down — fall back to the last known-good Discord theme.
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
