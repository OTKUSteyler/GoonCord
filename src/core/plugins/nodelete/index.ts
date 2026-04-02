// src/core/plugins/NoDelete/index.ts
import { defineCorePlugin } from "..";
import { findByStoreName } from "@metro";
import { before } from "@lib/api/patcher";
import { logger } from "@lib/utils/logger";
import { FluxDispatcher } from "@metro/common";

type PatchCleanupFn = () => void;

let patches: PatchCleanupFn[] = [];
let MessageStore: any = null;
let deleteable: string[] = [];

function patchDispatcher(): PatchCleanupFn {
    return before("dispatch", FluxDispatcher, (args: any[]) => {
        try {
            if (!MessageStore) MessageStore = findByStoreName("MessageStore");

            const event = args[0];
            if (!event || event?.type !== "MESSAGE_DELETE") return;
            if (!event?.id || !event?.channelId) return;

            if (deleteable.includes(event.id)) {
                deleteable.splice(deleteable.indexOf(event.id), 1);
                return;
            }

            deleteable.push(event.id);

            args[0] = {
                type: "MESSAGE_EDIT_FAILED_AUTOMOD",
                messageData: {
                    type: 1,
                    message: {
                        channelId: event.channelId,
                        messageId: event.id,
                    },
                },
                errorResponseBody: {
                    code: 200000,
                    message: "[deleted]",
                },
            };
        } catch (e) {
            logger.error("NoDelete: dispatcher patch failed", e);
        }
    });
}

export default defineCorePlugin({
    manifest: {
        id: "bunny.nodelete",
        version: "1.0.0",
        type: "plugin",
        spec: 3,
        main: "",
        display: {
            name: "NoDelete",
            description: "Prevents messages from being deleted from your view",
            authors: [{ name: "meqativ" }],
        },
    },

    start() {
        patches = [patchDispatcher()].filter(Boolean);
        logger.log("NoDelete: Enabled");
    },

    stop() {
        patches.forEach((p) => p?.());
        patches = [];
        deleteable = [];
        MessageStore = null;
        logger.log("NoDelete: Disabled");
    },
});
