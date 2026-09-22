import { VdThemeInfo } from "@lib/addons/themes";
import { removeCacheFile } from "./fs";

// @ts-ignore
const pyonLoaderIdentity = globalThis.__PYON_LOADER__;

// @ts-ignore
const rainLoaderIdentity = globalThis.__RAIN_LOADER__;

// @ts-ignore
const vendettaLoaderIdentity = globalThis.__vendetta_loader;

// @ts-ignore
const shiggyLoaderIdentity = globalThis.__SHIGGY_LOADER__;

export interface VendettaLoaderIdentity {
    name: string;
    features: {
        loaderConfig?: boolean;
        devtools?: {
            prop: string;
            version: string;
        },
        themes?: {
            prop: string;
        };
    };
}

export function isVendettaLoader() {
    return vendettaLoaderIdentity != null;
}

export function isPyonLoader() {
    return pyonLoaderIdentity != null;
}

export function isRa1nLoader() {
    return rainLoaderIdentity != null;
}

export function isShiggyLoader() {
    return shiggyLoaderIdentity != null;
}

function polyfillVendettaLoaderIdentity() {
    if (!isPyonLoader() || isVendettaLoader() || !isRa1nLoader()) return null;

    let loader: { name: string; features: Record<string, any> };

    if (isRa1nLoader() == true) {
        loader = {
            name: rainLoaderIdentity.loaderName,
            features: {} as Record<string, any>,
        };
    } else {
        loader = {
            name: pyonLoaderIdentity.loader?.name ?? "Unknown",
            features: {} as Record<string, any>,
        };
    }

    if (isLoaderConfigSupported()) loader.features.loaderConfig = true;
    if (isSysColorsSupported()) {
        loader.features.syscolors = {
            prop: "__vendetta_syscolors"
        };

        Object.defineProperty(globalThis, "__vendetta_syscolors", {
            get: () => getSysColors(),
            configurable: true
        });
    }
    if (isThemeSupported()) {
        loader.features.themes = {
            prop: "__vendetta_theme"
        };

        Object.defineProperty(globalThis, "__vendetta_theme", {
            // get: () => getStoredTheme(),
            get: () => {
                // PyonXposed only returns keys it parses, making custom keys like Themes+' to gone
                const id = getStoredTheme()?.id;
                if (!id) return null;

                const { themes } = require("@lib/addons/themes");
                return themes[id] ?? getStoredTheme() ?? null;
            },
            configurable: true
        });
    }

    Object.defineProperty(globalThis, "__vendetta_loader", {
        get: () => loader,
        configurable: true
    });

    return loader as VendettaLoaderIdentity;
}

/**
 * The current __PYON_LOADER__ payload has moved to a nested shape:
 * { bundle: { revision }, loader: { name, version, initConfig, constants, modules } }
 * It no longer carries the old flat Vendetta-era fields (loaderName, loaderVersion,
 * hasThemeSupport, fontPatch, storedTheme, sysColors). The functions below read the
 * new nested fields where a native equivalent exists. Where the native side no longer
 * sends a capability flag at all (theme/font/sysColors support), we treat the modern
 * Pyon-based loader as always supporting them — consistent with getThemeFilePath()
 * below, which already unconditionally returns a fixed path for Pyon with no support
 * check. If the native/injector side does expose real capability flags somewhere else
 * in the payload (e.g. under loader.constants), swap the hardcoded `true` for that.
 */

export function getLoaderIdentity() {
    if (isPyonLoader()) {
        return pyonLoaderIdentity;
    } else if (isVendettaLoader()) {
        return getVendettaLoaderIdentity();
    } else if (isRa1nLoader()) {
        return rainLoaderIdentity();
    } else if (isShiggyLoader()) {
        return shiggyLoaderIdentity;
    }

    return null;
}

export function getVendettaLoaderIdentity(): VendettaLoaderIdentity | null {
    // @ts-ignore
    if (globalThis.__vendetta_loader) return globalThis.__vendetta_loader;
    return polyfillVendettaLoaderIdentity();
}

// add to __vendetta_loader anyway
getVendettaLoaderIdentity();

export function getLoaderName() {
    if (isPyonLoader()) return pyonLoaderIdentity.loader?.name ?? "Unknown";
    else if (isRa1nLoader()) return rainLoaderIdentity.loadername;
    else if (isVendettaLoader()) return vendettaLoaderIdentity.name;
    else if (isShiggyLoader()) return shiggyLoaderIdentity.loaderName;

    return "Unknown";
}

export function getLoaderVersion(): string | null {
    if (isPyonLoader()) return pyonLoaderIdentity.loader?.version ?? null;
    else if (isRa1nLoader()) return rainLoaderIdentity.loaderVersion;
    else if (isShiggyLoader()) return shiggyLoaderIdentity.loaderVersion;
    return null;
}

export function isLoaderConfigSupported() {
    if (isPyonLoader()) {
        return true;
    } else if (isVendettaLoader()) {
        return vendettaLoaderIdentity!!.features.loaderConfig;
    } else if (isRa1nLoader()) {
        return true;
    }

    return false;
}

export function isThemeSupported() {
    if (isPyonLoader()) {
        // No hasThemeSupport flag on the current payload shape; the modern
        // Pyon-based loader always supports themes (see getThemeFilePath()).
        return true;
    } else if (isVendettaLoader()) {
        return vendettaLoaderIdentity!!.features.themes != null;
    } else if (isRa1nLoader()) {
        return false; // Rain has theme support disabled, this is here just to make sure it doesnt think it does
    } else if (isShiggyLoader()) {
        return shiggyLoaderIdentity.hasThemeSupport;
    }

    return false;
}

export function getStoredTheme(): VdThemeInfo | null {
    if (isPyonLoader()) {
        // No storedTheme field on the current payload shape; the currently
        // selected theme is tracked client-side in the `themes` MMKV store
        // instead (see @lib/addons/themes -> getCurrentTheme()), which
        // getThemeFromLoader() already falls back to when this returns null.
        return null;
    } else if (isVendettaLoader()) {
        const themeProp = vendettaLoaderIdentity!!.features.themes?.prop;
        if (!themeProp) return null;
        // @ts-ignore
        return globalThis[themeProp] || null;
    } else if (isShiggyLoader()) {
        return shiggyLoaderIdentity.storedTheme || null;
    }

    return null;
}

export function getThemeFilePath() {
    if (isPyonLoader()) {
        return "pyoncord/current-theme.json";
    } else if (isVendettaLoader()) {
        return "vendetta_theme.json";
    } else if (isShiggyLoader()) {
        return "ShiggyCord/current-theme.json";
    }

    return null;
}

export function isReactDevToolsPreloaded() {
    if (isPyonLoader()) {
        return Boolean(window.__REACT_DEVTOOLS__);
    }
    if (isVendettaLoader()) {
        return vendettaLoaderIdentity!!.features.devtools != null;
    }

    return false;
}

export function getReactDevToolsProp(): string | null {
    if (!isReactDevToolsPreloaded()) return null;

    if (isPyonLoader()) {
        window.__pyoncord_rdt = window.__REACT_DEVTOOLS__.exports;
        return "__pyoncord_rdt";
    }

    if (isVendettaLoader()) {
        return vendettaLoaderIdentity!!.features.devtools!!.prop;
    }

    return null;
}

export function getReactDevToolsVersion() {
    if (!isReactDevToolsPreloaded()) return null;

    if (isPyonLoader()) {
        return window.__REACT_DEVTOOLS__.version || null;
    }
    if (isVendettaLoader()) {
        return vendettaLoaderIdentity!!.features.devtools!!.version;
    }

    return null;
}

export function isSysColorsSupported() {
    return true;
}

export function getSysColors() {
    if (!isSysColorsSupported()) return null;
    if (isPyonLoader()) {
        // No sysColors field on the current payload shape.
        return null;
    } else if (isVendettaLoader()) {
        return vendettaLoaderIdentity!!.features.syscolors!!.prop;
    }

    return null;
}

export function getLoaderConfigPath() {
    if (isPyonLoader()) {
        return "pyoncord/loader.json";
    } else if (isVendettaLoader()) {
        return "vendetta_loader.json";
    } else if (isRa1nLoader()) {
        return "rain/loader.json";
    }

    return "loader.json";
}

export function isFontSupported() {
    // No fontPatch field on the current payload shape; the modern
    // Pyon-based loader always supports fonts.
    if (isPyonLoader()) return true;
    else if (isShiggyLoader()) return shiggyLoaderIdentity.fontPatch === 2;

    return false;
}

export async function clearBundle() {
    // TODO: This should be not be hardcoded, maybe put in loader.json?
    return void await removeCacheFile("bundle.js");
}
