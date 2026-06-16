export async function fetchRedditImage(nsfw: boolean, sort: string): Promise<{
    url: string;
    title: string;
    permalink: string;
    author: string;
    subreddit: string;
    width?: number;
    height?: number;
    authorIcon?: string;
} | null> {
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
