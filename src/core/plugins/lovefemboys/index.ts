import { defineCorePlugin } from "..";

const findByProps = (...props: string[]) =>
    (window as any).bunny?.metro?.findByProps(...props) ??
    (window as any).vendetta?.metro?.findByProps(...props);

const MessageActions = findByProps("sendMessage", "receiveMessage");
const Channels = findByProps("getLastSelectedChannelId");
const BotMessage = findByProps("createBotMessage");
const Avatars = findByProps("BOT_AVATARS");

// Simple in-memory storage since @vendetta/plugin isn't available in core
const storage: Record<string, any> = {
    sortdefs: "hot",
    nsfwwarn: true,
};

function showConfirm(title: string, content: string): Promise<boolean> {
    return new Promise((resolve) => {
        const UI = findByProps("showConfirmationAlert") ?? findByProps("openAlert");
        if (UI?.showConfirmationAlert) {
            UI.showConfirmationAlert({
                title,
                content,
                confirmText: "Yes, Continue",
                onConfirm: () => resolve(true),
                cancelText: "Cancel",
                onCancel: () => resolve(false),
            });
        } else {
            // fallback if alert API unavailable
            resolve(confirm(`${title}\n\n${content}`));
        }
    });
}

function sendReply(channelID: string, content: string | object, embed: any[]) {
    const channel = channelID ?? Channels?.getLastSelectedChannelId?.();
    const msg = BotMessage.createBotMessage({
        channelId: channel,
        content: "",
        embeds: embed,
    });
    msg.author.username = "Astolfo";
    msg.author.avatar = "Astolfo";
    Avatars.BOT_AVATARS.Astolfo =
        "https://i.pinimg.com/736x/50/77/1f/50771f45b1c015cfbb8b0853ba7b8521.jpg";
    if (typeof content === "string") {
        msg.content = content;
    } else {
        Object.assign(msg, content);
    }
    MessageActions.receiveMessage(channel, msg);
}

export default defineCorePlugin({
    manifest: {
        id: "lovefemboys",
        name: "LoveFemboys",
        version: "1.0.0",
        description: "Get an image of a femboy via slash command",
        authors: [],
    },
    onLoad() {
        const { registerCommand } = findByProps("registerCommand");

        this._unregister = registerCommand({
            name: "lovefemboys",
            displayName: "lovefemboys",
            description: "Get an image of a femboy",
            displayDescription: "Get an image of a femboy",
            applicationId: "-1",
            inputType: 1,
            type: 1,
            options: [
                {
                    name: "nsfw",
                    displayName: "nsfw",
                    description: "Get the result from r/femboys instead of r/femboy (NSFW)",
                    displayDescription: "Get the result from r/femboys instead of r/femboy (NSFW)",
                    required: false,
                    type: 5,
                },
                {
                    name: "sort",
                    displayName: "sort",
                    description: "Changes the way reddit sorts.",
                    displayDescription: "Changes the way reddit sorts",
                    required: false,
                    type: 3,
                },
                {
                    name: "silent",
                    displayName: "silent",
                    description: "Makes it so only you can see the message.",
                    displayDescription: "Makes it so only you can see the message.",
                    required: false,
                    type: 5,
                },
            ],
            execute: async (args: any[], ctx: any) => {
                try {
                    const nsfw = args.find((a) => a.name === "nsfw")?.value;
                    let sort = args.find((a) => a.name === "sort")?.value;
                    const silent = args.find((a) => a.name === "silent")?.value;

                    if (typeof sort === "undefined") sort = storage.sortdefs;
                    if (!["best", "hot", "new", "rising", "top", "controversial"].includes(sort)) {
                        sendReply(ctx.channel.id, "Incorrect sorting type. Valid options are\n`best`, `hot`, `new`, `rising`, `top`, `controversial`.", []);
                        return;
                    }

                    if (nsfw) {
                        const ok = await showConfirm(
                            "⚠️ NSFW Content Warning",
                            "This command will send NSFW content from r/femboys. Are you sure you want to continue?"
                        );
                        if (!ok) return;
                    }

                    let response = await fetch(
                        `https://www.reddit.com/r/femboy${nsfw ? "s" : ""}/${sort}.json?limit=100`
                    ).then((r) => r.json());

                    if (!ctx.channel.nsfw_ && nsfw && storage.nsfwwarn && !(silent ?? true)) {
                        sendReply(ctx.channel.id, "This channel is not marked as NSFW.", []);
                        return;
                    }

                    response = response.data?.children?.[
                        Math.floor(Math.random() * response.data?.children?.length)
                    ]?.data;

                    const author = await fetch(
                        `https://www.reddit.com/u/${response?.author}/about.json`
                    ).then((r) => r.json());

                    if (silent ?? true) {
                        sendReply(ctx.channel.id, "", [
                            {
                                type: "rich",
                                title: response?.title,
                                url: `https://reddit.com${response?.permalink}`,
                                author: {
                                    name: `u/${response?.author} • r/${response?.subreddit}`,
                                    proxy_icon_url: author?.data.icon_img.split("?")[0],
                                    icon_url: author?.data.icon_img.split("?")[0],
                                },
                                image: {
                                    proxy_url: response?.url_overridden_by_dest?.replace(/.gifv$/g, ".gif") ?? response?.url?.replace(/.gifv$/g, ".gif"),
                                    url: response?.url_overridden_by_dest?.replace(/.gifv$/g, ".gif") ?? response?.url?.replace(/.gifv$/g, ".gif"),
                                    width: response?.preview?.images?.[0]?.source?.width,
                                    height: response?.preview?.images?.[0]?.source?.height,
                                },
                                color: "0xf4b8e4",
                            },
                        ]);
                    } else {
                        const fixNonce = Date.now().toString();
                        MessageActions.sendMessage(
                            ctx.channel.id,
                            { content: response?.url_overridden_by_dest ?? response?.url },
                            void 0,
                            { nonce: fixNonce }
                        );
                    }
                } catch (err) {
                    console.error("[LoveFemboys] Error:", err);
                    sendReply(ctx.channel.id, "ERROR !!!!!!!!!!!! 😭😭😭 Check debug logs!! 🥺🥺🥺", []);
                }
            },
        });
    },
    onUnload() {
        this._unregister?.();
    },
});
