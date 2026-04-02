// src/core/plugins/favouriteanything/index.ts
import { defineCorePlugin } from "..";
import { findByProps } from "@metro";
import { before } from "@lib/api/patcher";
import { logger } from "@lib/utils/logger";

type PatchCleanupFn = () => void;

let origType: Function | null = null;
let memoWrapper: any = null;
let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let unpatchAddFavorite: PatchCleanupFn | null = null;
let origUseFavoriteGIFsMobile: Function | null = null;
let favMobileModule: any = null;

const VIDEO_EXT = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".m4v", ".gifv"];
const processed = new WeakSet<object>();

function isVideo(url: string): boolean {
    if (!url) return false;
    const path = url.split("?")[0].toLowerCase();
    return VIDEO_EXT.some(e => path.endsWith(e));
}

function makeVideoThumbnail(url: string): string {
    if (!url) return url;
    let out = url.replace("cdn.discordapp.com", "media.discordapp.net");
    if (out.includes("media.discordapp.net") || out.includes("images-ext")) {
        return out + (out.includes("?") ? "&" : "?") + "format=jpeg";
    }
    return url;
}

function findGIFFavButton(): any {
    const modules = (globalThis as any).__bunny?.metro?.modules ?? (globalThis as any).modules;
    if (!modules) return null;

    for (const id in modules) {
        try {
            const mod = modules[id]?.publicModule?.exports;
            if (!mod) continue;
            const def = mod.default;
            if (def?.$$typeof?.toString().includes("memo") && def.type) {
                if (def.type.displayName === "GIFFavButton" || def.type.name === "GIFFavButton") return def;
            }
            if (typeof mod === "function" && (mod.displayName === "GIFFavButton" || mod.name === "GIFFavButton")) return mod;
        } catch {}
    }
    return null;
}

function patchSource(source: any): any {
    if (source.isGIFV) return source;
    return {
        ...source,
        isGIFV: true,
        embedURI: source.embedURI || source.sourceURI || source.uri,
        videoURI: source.videoURI || source.uri,
        embedProviderName: source.embedProviderName || "",
    };
}

function applyPatch(): boolean {
    memoWrapper = findGIFFavButton();
    if (!memoWrapper) return false;

    origType = memoWrapper.type;
    memoWrapper.type = function PatchedGIFFavButton(props: any) {
        const p = { ...props };
        if (p.source && !p.source.isGIFV) p.source = patchSource(p.source);
        return (origType as Function)(p);
    };
    (memoWrapper.type as any).displayName = "GIFFavButton";
    return true;
}

function patchAddFavorite(): void {
    const favModule = findByProps("addFavoriteGIF");
    if (!favModule) return;

    unpatchAddFavorite = before("addFavoriteGIF", favModule, (args: any[]) => {
        const data = args[0];
        if (!data || typeof data !== "object") return;
        const url = data.url || "";
        const src = data.src || "";

        if (isVideo(url) || isVideo(src)) {
            data.format = 2;
        } else if (data.format === 2) {
            data.format = 1;
        }
    });
}

function patchMobileFavorites(): void {
    const mod = findByProps("useFavoriteGIFsMobile");
    if (!mod) return;

    favMobileModule = mod;
    origUseFavoriteGIFsMobile = mod.useFavoriteGIFsMobile;

    let lastFavs: any = null;
    mod.useFavoriteGIFsMobile = function (...args: any[]) {
        const result = (origUseFavoriteGIFsMobile as Function).apply(this, args);
        if (result?.favorites && Array.isArray(result.favorites) && result.favorites !== lastFavs) {
            lastFavs = result.favorites;
            for (const item of result.favorites) {
                if (!item || processed.has(item)) continue;
                processed.add(item);
                if (isVideo(item.url) || isVideo(item.src)) {
                    item.src = makeVideoThumbnail(item.src || item.url);
                }
            }
        }
        return result;
    };
}

export default defineCorePlugin({
    manifest: {
        id: "bunny.favouriteanything",
        version: "1.0.0",
        type: "plugin",
        spec: 3,
        main: "",
        display: {
            name: "FavouriteAnything",
            description: "Adds the favourite button to ALL media, not just GIFs",
            authors: [{ name: "TheUnrealZaka" }],
        },
    },

    start() {
        if (applyPatch()) {
            logger.log("[FavouriteAnything] Patched GIFFavButton.");
        } else {
            let retries = 0;
            const tryPatch = () => {
                if (applyPatch()) {
                    logger.log("[FavouriteAnything] Patched GIFFavButton (after retry).");
                    retryTimeout = null;
                } else if (retries++ < 50) {
                    retryTimeout = setTimeout(tryPatch, 300);
                } else {
                    logger.error("[FavouriteAnything] GIFFavButton not found after retries.");
                }
            };
            retryTimeout = setTimeout(tryPatch, 300);
        }

        patchAddFavorite();
        patchMobileFavorites();
    },

    stop() {
        if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null; }
        if (memoWrapper && origType) {
            memoWrapper.type = origType;
            origType = null;
            memoWrapper = null;
        }
        if (unpatchAddFavorite) { unpatchAddFavorite(); unpatchAddFavorite = null; }
        if (favMobileModule && origUseFavoriteGIFsMobile) {
            favMobileModule.useFavoriteGIFsMobile = origUseFavoriteGIFsMobile;
            origUseFavoriteGIFsMobile = null;
            favMobileModule = null;
        }
    },
});
