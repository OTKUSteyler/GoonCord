import { registerCommand } from "@vendetta/commands";
import { findByProps } from "@vendetta/metro";
import { fetchRedditImage } from "./utils";

const { sendBotMessage } = findByProps("sendBotMessage");
const messageUtil = findByProps("sendMessage", "editMessage");
const MessageActions = findByProps("sendMessage", "receiveMessage");
const BotMessage = findByProps("createBotMessage");
const Avatars = findByProps("BOT_AVATARS");

function sendReply(channelId: string, content: string, embeds: any[]) {
    const msg = BotMessage.createBotMessage({ channelId, content: "", embeds });
    msg.author.username = "Astolfo";
    msg.author.avatar = "Astolfo";
    Avatars.BOT_AVATARS.Astolfo =
        "https://i.pinimg.com/736x/50/77/1f/50771f45b1c015cfbb8b0853ba7b8521.jpg";
    if (content) msg.content = content;
    MessageActions.receiveMessage(channelId, msg);
}

const DEFAULT_SORT = "hot";

const lovefemboys = registerCommand({
    name: "lovefemboys",
    displayName: "lovefemboys",
    description: "Get an image of a femboy",
    displayDescription: "Get an image of a femboy",
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
    // @ts-ignore
    applicationId: "-1",
    inputType: 1,
    type: 1,
    execute: async function (args, ctx) {
        const options = new Map(args.map((o) => [o.name, o]));
        const nsfw: boolean = options.get("nsfw")?.value ?? false;
        const sort: string = options.get("sort")?.value ?? DEFAULT_SORT;
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
    },
});

export default lovefemboys;
