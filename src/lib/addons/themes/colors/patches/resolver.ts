import { _colorRef } from "@lib/addons/themes/colors/updater";
import { NativeThemeModule } from "@lib/api/native/modules";
import { before, instead } from "@lib/api/patcher";
import { findByProps } from "@metro";
import { byMutableProp } from "@metro/filters";
import { createLazyModule } from "@metro/lazy";
import chroma from "chroma-js";

const isThemeModule = createLazyModule(byMutableProp("isThemeDark"));

const SEMANTIC_FALLBACK_MAP: Record<string, string> = {
    "BG_BACKDROP": "BACKGROUND_FLOATING",
    "BG_BASE_PRIMARY": "BACKGROUND_PRIMARY",
    "BG_BASE_SECONDARY": "BACKGROUND_SECONDARY",
    "BG_BASE_TERTIARY": "BACKGROUND_SECONDARY_ALT",
    "BG_MOD_FAINT": "BACKGROUND_MODIFIER_ACCENT",
    "BG_MOD_STRONG": "BACKGROUND_MODIFIER_ACCENT",
    "BG_MOD_SUBTLE": "BACKGROUND_MODIFIER_ACCENT",
    "BG_SURFACE_OVERLAY": "BACKGROUND_FLOATING",
    "BG_SURFACE_OVERLAY_TMP": "BACKGROUND_FLOATING",
    "BG_SURFACE_RAISED": "BACKGROUND_MOBILE_PRIMARY"
};

const alphaCache = new Map<string, string>();
let alphaCacheKey: string | null = null;

function cachedAlphaHex(hex: string, opacity: number): string {
    if (alphaCacheKey !== _colorRef.key) {
        alphaCache.clear();
        alphaCacheKey = _colorRef.key;
    }
    const cacheKey = `${hex}|${opacity}`;
    let result = alphaCache.get(cacheKey);
    if (result === undefined) {
        result = chroma(hex).alpha(opacity).hex();
        alphaCache.set(cacheKey, result);
    }
    return result;
}

export default function patchDefinitionAndResolver() {
    const tokenReference = findByProps("SemanticColor");
    if (!tokenReference) return () => {};

    const origRawColor = { ...tokenReference.RawColor };

    const callback = ([theme]: any[]) => theme === _colorRef.key ? [_colorRef.current?.reference ?? "dark"] : void 0;

    if (tokenReference.RawColor) {
        Object.keys(tokenReference.RawColor).forEach(key => {
            Object.defineProperty(tokenReference.RawColor, key, {
                configurable: true,
                enumerable: true,
                get: () => {
                    const ret = _colorRef.current?.raw[key];
                    return ret || origRawColor[key];
                }
            });
        });
    }

    const resolverTarget = tokenReference.default?.meta ?? tokenReference.default?.internal ?? tokenReference.default;

    const unpatches = [
        before("isThemeDark", isThemeModule, callback),
        before("isThemeLight", isThemeModule, callback),
        before("updateTheme", NativeThemeModule, callback),
        resolverTarget ? instead("resolveSemanticColor", resolverTarget, (args: any[], orig: any) => {
            if (!_colorRef.current) return orig(...args);
            if (args[0] !== _colorRef.key) return orig(...args);

            args[0] = _colorRef.current.reference;

            const [name, colorDef] = extractInfo(_colorRef.current.reference, args[1], tokenReference);

            let semanticDef = _colorRef.current.semantic[name];
            if (!semanticDef && _colorRef.current.spec === 2 && name in SEMANTIC_FALLBACK_MAP) {
                semanticDef = _colorRef.current.semantic[SEMANTIC_FALLBACK_MAP[name]];
            }

            if (semanticDef?.value) {
                if (semanticDef.opacity === 1) return semanticDef.value;
                return cachedAlphaHex(semanticDef.value, semanticDef.opacity);
            }

            if (colorDef?.raw) {
                const rawValue = _colorRef.current.raw[colorDef.raw];
                if (rawValue) {
                    return colorDef.opacity === 1 ? rawValue : cachedAlphaHex(rawValue, colorDef.opacity);
                }
            }

            return orig(...args);
        }) : () => {},
        () => {
            if (tokenReference.RawColor) {
                Object.defineProperty(tokenReference, "RawColor", {
                    configurable: true,
                    writable: true,
                    value: origRawColor
                });
            }
        }
    ];

    return () => unpatches.forEach(p => p());
}

function extractInfo(themeName: string, colorObj: any, tokenReference: any): [name: string, colorDef: any] {
    if (!colorObj || typeof colorObj !== "object") return ["", null];
    // @ts-ignore - assigning to extractInfo._sym
    const propName = colorObj[extractInfo._sym ??= Object.getOwnPropertySymbols(colorObj)[0]];
    const colorDef = tokenReference?.SemanticColor?.[propName];
    if (!colorDef) return [propName, null];

    const targetDef = colorDef[themeName] ?? colorDef.darker ?? colorDef.dark ?? colorDef.midnight ?? colorDef.onyx ?? Object.values(colorDef)[0];
    return [propName, targetDef];
}
