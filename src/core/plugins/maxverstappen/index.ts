import { defineCorePlugin } from "..";
import { findByProps } from "@metro";
import { logger } from "@lib/utils/logger";

// Get DCDSoundManager the same way as enhancements plugin
const { ReactNative } = window as any;
const { DCDSoundManager } = ReactNative?.NativeModules || {};

const AUDIO_URL = "https://github.com/OTKUSteyler/GoonCord/raw/refs/heads/main/src/core/plugins/maxverstappen/Max%20Verstappen.mp3";
const SOUND_ID = 6972; // different id from enhancements (6971)
const TRIGGER_CHANCE = 0.33;
const MAX_PATTERN = /\bmax\s*verstappen\b/i;

let isPlaying = false;
let timeoutId: NodeJS.Timeout | null = null;

function shouldTrigger(): boolean {
    return Math.random() < TRIGGER_CHANCE;
}

function checkText(text: string): boolean {
    return MAX_PATTERN.test(text) && shouldTrigger();
}

async function playAudio() {
    if (!DCDSoundManager) {
        logger.error("[MaxVerstappen] DCDSoundManager not available");
        return;
    }

    // Stop if already playing
    if (isPlaying) {
        if (timeoutId) clearTimeout(timeoutId);
        DCDSoundManager.stop(SOUND_ID);
        isPlaying = false;
    }

    // Prepare then play
    DCDSoundManager.prepare(AUDIO_URL, "music", SOUND_ID, async (error: any, sound: any) => {
        if (error) {
            logger.error("[MaxVerstappen] Failed to prepare sound:", error);
            return;
        }

        isPlaying = true;
        try {
            await DCDSoundManager.play(SOUND_ID);
            const duration = sound?.duration || 5000;
            timeoutId = setTimeout(() => {
                DCDSoundManager.stop(SOUND_ID);
                isPlaying = false;
                timeoutId = null;
            }, duration);
        } catch (e) {
            logger.error("[MaxVerstappen] Playback error:", e);
            isPlaying = false;
        }
    });
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
            authors: [{ name: "your-name" }],
        },
    },

    start() {
        if (!DCDSoundManager) {
            logger.error("[MaxVerstappen] DCDSoundManager not found - plugin disabled");
            return;
        }

        const FluxDispatcher = findByProps("dispatch", "subscribe");
        if (!FluxDispatcher) {
            logger.error("[MaxVerstappen] FluxDispatcher not found");
            return;
        }

        FluxDispatcher.subscribe("MESSAGE_CREATE", ({ message }: any) => {
            if (!message?.content) return;
            if (checkText(message.content)) {
                logger.log("[MaxVerstappen] Triggered!");
                playAudio();
            }
        });

        FluxDispatcher.subscribe("MESSAGE_SEND", ({ message }: any) => {
            if (!message?.content) return;
            if (checkText(message.content)) {
                logger.log("[MaxVerstappen] Triggered on sent message!");
                playAudio();
            }
        });

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
            FluxDispatcher.unsubscribe("MESSAGE_CREATE");
            FluxDispatcher.unsubscribe("MESSAGE_SEND");
        }

        logger.log("[MaxVerstappen] Disabled");
    },
});
