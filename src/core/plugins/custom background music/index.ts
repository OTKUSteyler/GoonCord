import { findByProps } from "@vendetta/metro";
import { ReactNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import Settings from "./Settings";
import { defineCorePlugin } from "..";

const { DCDSoundManager } = ReactNative.NativeModules;

export const settings: { url?: string } = storage;

const SOUND_ID = 6973;

let isPlaying = false;
let loopTimeoutId: ReturnType<typeof setTimeout> | null = null;
let currentUrl: string | null = null;

function prepareSound(url: string): Promise<number> {
    return new Promise((resolve) => {
        DCDSoundManager.prepare(url, "music", SOUND_ID, (error: any, sound: any) => {
            if (error) return resolve(-1);
            resolve(sound?.duration ?? -1);
        });
    });
}

function stopLoop() {
    isPlaying = false;
    if (loopTimeoutId) {
        clearTimeout(loopTimeoutId);
        loopTimeoutId = null;
    }
    DCDSoundManager.stop(SOUND_ID);
}

// Exported so Settings.tsx can call this the moment the URL changes
export async function playFromUrl(url: string) {
    if (!url) return;

    stopLoop();
    currentUrl = url;

    const duration = await prepareSound(url);
    if (duration === -1 || currentUrl !== url) return;

    isPlaying = true;

    const cycle = async () => {
        if (!isPlaying || currentUrl !== url) return;
        await DCDSoundManager.play(SOUND_ID);
        loopTimeoutId = setTimeout(cycle, duration);
    };

    cycle();
}

export default {
    onLoad: () => {
        if (settings.url) playFromUrl(settings.url);
    },
    onUnload: () => {
        stopLoop();
        currentUrl = null;
    },
    settings: Settings,
};
