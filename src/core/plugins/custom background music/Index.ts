import { findByProps } from "@vendetta/metro";
import { React, ReactNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { before } from "@vendetta/patcher";
import Settings from "./Settings";

const { ImageBackground } = ReactNative;

export const settings: {
    backgroundUrl?: string;
    opacity?: number;
    blur?: number;
} = storage;

let unpatch: (() => void) | undefined;

// Locate the root view that wraps the app's main content.
// This is the part most likely to need adjusting for GoonCord specifically —
// Vendetta-family clients usually expose something like this via findByProps,
// but the exact export name can differ between forks.
const AppContainer = findByProps("AppContainer") ?? findByProps("MainTabsView");

function applyBackground() {
    if (!AppContainer) return;

    unpatch = before("default", AppContainer, (args) => {
        const url = settings.backgroundUrl;
        if (!url) return;

        const original = args[0]?.children;
        args[0].children = React.createElement(
            ImageBackground,
            {
                source: { uri: url },
                style: { flex: 1 },
                imageStyle: { opacity: settings.opacity ?? 0.3 },
                blurRadius: settings.blur ?? 0,
            },
            original
        );
    });
}

export default {
    onLoad: () => {
        settings.opacity ??= 0.3;
        settings.blur ??= 0;
        applyBackground();
    },
    onUnload: () => {
        unpatch?.();
    },
    settings: Settings,
};
