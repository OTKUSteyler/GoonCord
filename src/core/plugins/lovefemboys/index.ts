import { registerCommand } from "@vendetta/commands";
import { findByProps } from "@vendetta/metro";

const { sendBotMessage } = findByProps("sendBotMessage");
const messageUtil = findByProps("sendMessage", "editMessage");
const MessageActions = findByProps("sendMessage", "receiveMessage");
const BotMessage = findByProps("createBotMessage");
const Avatars = findByProps("BOT_AVATARS");

async function fetchRedditImage(nsfw: boolean, sort: string) {
    try {
        const subreddit = nsfw ? "femboys" : "femboy";
        const response = await fetch(
            `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=100`
        ).then((r) => r.json());

        const post = response.data?.children?.[
            Math.floor(Math.random() * response.data?.children?.length)
        ]?.data;

        if (!post) return null;

        const authorData = await fetch(
            `https://www.reddit.com/u/${post.author}/about.json`
        ).then((r) => r.json());

        return {
            url: (post.url_overridden_by_dest ?? post.url)?.replace(/.gifv$/g, ".gif"),
            title: post.title,
            permalink: post.permalink,
            author: post.author,
            subreddit: post.subreddit,
            width: post.preview?.images?.[0]?.source?.width,
            height: post.preview?.images?.[0]?.source?.height,
            authorIcon: authorData?.data?.icon_img?.split("?")[0],
        };
    } catch {
        return null;
    }
}

function sendReply(channelId: string, content: string, embeds: any[]) {
    const msg = BotMessage.createBotMessage({ channelId, content: "", embeds });
    msg.author.username = "Astolfo";
    msg.author.avatar = "Astolfo";
    Avatars.BOT_AVATARS.Astolfo =
        "https://i.pinimg.com/736x/50/77/1f/50771f45b1c015cfbb8b0853ba7b8521.jpg";
    if (content) msg.content = content;
    MessageActions.receiveMessage(channelId, msg);
}

const unregister = registerCommand({
    name: "lovefemboys",
    displayName: "lovefemboys",
    description: "Get an image of a femboy",
    displayDescription: "Get an image of a femboy",
    // @ts-ignore
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
            const options = new Map(args.map((o: any) => [o.name, o]));
            const nsfw: boolean = options.get("nsfw")?.value ?? false;
            const sort: string = options.get("sort")?.value ?? "hot";
            const silent: boolean = options.get("silent")?.value ?? true;

            if (!["best", "hot", "new", "rising", "top", "controversial"].includes(sort)) {
                sendBotMessage(ctx.channel.id, "Incorrect sorting type. Valid options are: `best`, `hot`, `new`, `rising`, `top`, `controversial`.");
                return;
            }

            if (nsfw && !ctx.channel.nsfw_) {
                sendBotMessage(ctx.channel.id, "This channel is not marked as NSFW. Use an NSFW channel instead.");
                return;
            }

            const post = await fetchRedditImage(nsfw, sort);

            if (!post) {
                sendBotMessage(ctx.channel.id, "No image found. Try again later.");
                return;
            }

            if (silent) {
                sendReply(ctx.channel.id, "", [
                    {
                        type: "rich",
                        title: post.title,
                        url: `https://reddit.com${post.permalink}`,
                        author: {
                            name: `u/${post.author} • r/${post.subreddit}`,
                            proxy_icon_url: post.authorIcon,
                            icon_url: post.authorIcon,
                        },
                        image: {
                            proxy_url: post.url,
                            url: post.url,
                            width: post.width,
                            height: post.height,
                        },
                        color: "0xf4b8e4",
                    },
                ]);
            } else {
                const fixNonce = Date.now().toString();
                messageUtil.sendMessage(ctx.channel.id, { content: post.url }, void 0, { nonce: fixNonce });
            }
        } catch (err) {
            console.error("[LoveFemboys] Error:", err);
            sendBotMessage(ctx.channel.id, "ERROR 😭😭😭 Check debug logs!! 🥺🥺🥺");
        }
    },
});

export default {
    onUnload: () => unregister(),
};
