import { _colorRef } from "@lib/addons/themes/colors/updater";
import { after, before } from "@lib/api/patcher";
import { findInTree } from "@lib/utils";
import { proxyLazy } from "@lib/utils/lazy";
import { findByProps } from "@metro";

const mmkvStorage = proxyLazy(() => {
    const newModule = findByProps("impl");
    if (typeof newModule?.impl === "object") return newModule.impl;
    return findByProps("storage");
});

export default function patchStorage() {
    const patchedKeys = new Set(["ThemeStore", "SelectivelySyncedUserSettingsStore"]);
    const sanitizedKeys = new Set<string>();

    const patches = [
        after("get", mmkvStorage, ([key], ret) => {
            if (!patchedKeys.has(key)) return;

            const state = findInTree(ret._state, s => typeof s.theme === "string");
            if (!state) return;

            const lastSetDiscordTheme = _colorRef.lastSetDiscordTheme ?? "darker";

            if (/^bn-theme-\d+$/.test(state.theme) && !/^bn-theme-\d+$/.test(lastSetDiscordTheme) && !sanitizedKeys.has(key)) {
                try {
                    const newVal = { ...ret._state, theme: lastSetDiscordTheme };
                    mmkvStorage.set(key, newVal);
                    sanitizedKeys.add(key);
                } catch (e) {
                }
                state.theme = lastSetDiscordTheme;
                return;
            }

            if (_colorRef.current) state.theme = _colorRef.key;
        }),
        before("set", mmkvStorage, ([key, value]) => {
            if (!patchedKeys.has(key)) return;

            const json = JSON.stringify(value);
            const lastSetDiscordTheme = _colorRef.lastSetDiscordTheme ?? "darker";
            const replacementTheme = /^bn-theme-\d+$/.test(lastSetDiscordTheme) ? "darker" : lastSetDiscordTheme;
            const replaced = json.replace(
                /"theme":"bn-theme-\d+"/,
                `"theme":${JSON.stringify(replacementTheme)}`
            );

            return [key, JSON.parse(replaced)];
        })
    ];

    return () => patches.forEach(p => p());
}
