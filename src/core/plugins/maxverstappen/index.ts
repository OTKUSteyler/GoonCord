import { defineCorePlugin } from "..";
import { findByProps } from "@metro";
import { logger } from "@lib/utils/logger";

const { ReactNative } = window as any;
const { DCDSoundManager } = ReactNative?.NativeModules || {};

const AUDIO_URL = "https://github.com/OTKUSteyler/GoonCord/raw/refs/heads/main/src/core/plugins/maxverstappen/Max%20Verstappen.mp3";
const SOUND_ID = 6972;
const TRIGGER_CHANCE = 0.33;
const MAX_PATTERN = /\bmax\s*verstappen\b/i;

let isPlaying = false;
let isPrepared = false;
let isPreparing = false;
let timeoutId: NodeJS.Timeout | null = null;
let onMessageCreate: ((e: any) => void) | null = null;
let onMessageSend: ((e: any) => void) | null = null;

function shouldTrigger(): boolean {
    return Math.random() < TRIGGER_CHANCE;
}

function checkText(text: string): boolean {
    if (!text) return false;
    return MAX_PATTERN.test(text) && shouldTrigger();
}

function ensurePrepared(): Promise<boolean> {
    return new Promise((resolve) => {
        if (isPrepared) return resolve(true);
        if (isPreparing) return resolve(false);

        isPreparing = true;
        DCDSoundManager.prepare(AUDIO_URL, "music", SOUND_ID, (error: any) => {
            isPreparing = false;
            if (error) {
                logger.error("[MaxVerstappen] Failed to prepare:", error);
                return resolve(false);
            }
            isPrepared = true;
            resolve(true);
        });
    });
}

async function playAudio() {
    if (!DCDSoundManager) return;
    if (isPlaying) return;

    const ready = await ensurePrepared();
    if (!ready) return;

    isPlaying = true;
    try {
        await DCDSoundManager.play(SOUND_ID);
        timeoutId = setTimeout(() => {
            DCDSoundManager.stop(SOUND_ID);
            isPlaying = false;
            timeoutId = null;
        }, 5000);
    } catch (e) {
        logger.error("[MaxVerstappen] Playback error:", e);
        isPlaying = false;
    }
}

export default defineCorePlugin({
    manifest: {
        id: "bunny.maxverstappen",
        version: "1.0.0",
        type: "plugin",
        spec: 3,
        main: "",
        display: {
            name: "Max Verstappen",
            description: "Plays audio when Max Verstappen is mentioned (33% chance)",
            authors: [{ name: "GoonCord Team" }],
        },
    },

    start() {
        if (!DCDSoundManager) {
            logger.error("[MaxVerstappen] DCDSoundManager not found");
            return;
        }

        const FluxDispatcher = findByProps("dispatch", "subscribe");
        if (!FluxDispatcher) {
            logger.error("[MaxVerstappen] FluxDispatcher not found");
            return;
        }

        onMessageCreate = ({ message }: any) => {
            try {
                if (!message?.content) return;
                if (checkText(message.content)) playAudio();
            } catch (e) {
                logger.error("[MaxVerstappen] MESSAGE_CREATE error:", e);
            }
        };

        onMessageSend = ({ message }: any) => {
            try {
                if (!message?.content) return;
                if (checkText(message.content)) playAudio();
            } catch (e) {
                logger.error("[MaxVerstappen] MESSAGE_SEND error:", e);
            }
        };

        FluxDispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
        FluxDispatcher.subscribe("MESSAGE_SEND", onMessageSend);

        logger.log("[MaxVerstappen] Enabled");
    },

    stop() {
        if (DCDSoundManager && isPlaying) {
            DCDSoundManager.stop(SOUND_ID);
            isPlaying = false;
        }

        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        const FluxDispatcher = findByProps("dispatch", "subscribe");
        if (FluxDispatcher) {
            if (onMessageCreate) FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessageCreate);
            if (onMessageSend) FluxDispatcher.unsubscribe("MESSAGE_SEND", onMessageSend);
        }

        onMessageCreate = null;
        onMessageSend = null;
        isPrepared = false;
        isPreparing = false;

        logger.log("[MaxVerstappen] Disabled");
    },
});
