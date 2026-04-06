import { defineCorePlugin } from "..";
import { findByProps } from "@metro";
import { after } from "@lib/api/patcher";
import { logger } from "@lib/utils/logger";

const AUDIO_URL = "https://your-audio-link-here.mp3";
const TRIGGER_CHANCE = 0.33;
const MAX_PATTERN = /\bmax\s*verstappen\b/i;

let audioInstance: any = null;

function playAudio() {
    try {
        const Sound = findByProps("play", "stop", "release");
        if (!Sound) {
            logger.error("[MaxVerstappen] Could not find audio module");
            return;
        }
        if (audioInstance) {
            audioInstance.stop();
            audioInstance.release();
            audioInstance = null;
        }
        audioInstance = new Sound(AUDIO_URL, null, (error: any) => {
            if (error) {
                logger.error("[MaxVerstappen] Failed to load audio", error);
                return;
            }
            audioInstance.play((success: boolean) => {
                if (!success) logger.error("[MaxVerstappen] Playback failed");
                audioInstance?.release();
                audioInstance = null;
            });
        });
    } catch (e) {
        logger.error("[MaxVerstappen] Audio error", e);
    }
}

function shouldTrigger(): boolean {
    return Math.random() < TRIGGER_CHANCE;
}

function checkText(text: string): boolean {
    return MAX_PATTERN.test(text) && shouldTrigger();
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
        const FluxDispatcher = findByProps("dispatch", "subscribe");
        if (FluxDispatcher) {
            FluxDispatcher.subscribe("MESSAGE_CREATE", ({ message }: any) => {
                if (!message?.content) return;
                if (checkText(message.content)) {
                    logger.log("[MaxVerstappen] Triggered on received message!");
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
        }

        logger.log("[MaxVerstappen] Enabled");
    },

    stop() {
        if (audioInstance) {
            audioInstance.stop();
            audioInstance.release();
            audioInstance = null;
        }

        const FluxDispatcher = findByProps("dispatch", "subscribe");
        if (FluxDispatcher) {
            FluxDispatcher.unsubscribe("MESSAGE_CREATE");
            FluxDispatcher.unsubscribe("MESSAGE_SEND");
        }

        logger.log("[MaxVerstappen] Disabled");
    },
});
