import { after } from "@lib/api/patcher";
import { findInReactTree } from "@lib/utils";
import { TableRow } from "@metro/common/components";
import { findByNameLazy, findByPropsLazy } from "@metro/wrappers";
import { registeredSections } from "@ui/settings";

import { CustomPageRenderer, wrapOnPress } from "./shared";
import { Strings } from "@core/i18n";
import { TableRowIcon } from "@metro/common/components";

const settingConstants = findByPropsLazy("SETTING_RENDERER_CONFIG");
const SettingsOverviewScreen = findByNameLazy("SettingsOverviewScreen", false);

function useIsFirstRender() {
  let firstRender = false;
  React.useEffect(() => void (firstRender = true), []);
  return firstRender;
}

export function patchTabsUI(unpatches: (() => void | boolean)[]) {
  const getRows = () =>
    Object.values(registeredSections)
      .flatMap((sect) =>
        sect.map((row) => ({
          [row.key]: {
            type: "pressable",
            title: row.title,
            icon: row.icon,
            IconComponent: () => <TableRow.Icon source={row.icon} />,
            usePredicate: row.usePredicate,
            useTrailing: row.useTrailing,
            onPress: wrapOnPress(row.onPress, null, row.render, row.title()),
            withArrow: true,
            ...row.rawTabsConfig,
          },
        })),
      )
      .reduce((a, c) => Object.assign(a, c));

  const origRendererConfig = settingConstants.SETTING_RENDERER_CONFIG;
  let rendererConfigValue = settingConstants.SETTING_RENDERER_CONFIG;

  Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
    enumerable: true,
    configurable: true,
    get: () => ({
      ...rendererConfigValue,
      VendettaCustomPage: {
        type: "route",
        title: () => "ShiggyCord",
        screen: {
          route: "VendettaCustomPage",
          getComponent: () => CustomPageRenderer,
        },
      },
      PUPU_CUSTOM_PAGE: {
        type: "route",
        title: () => "ShiggyCord",
        screen: {
          route: "PUPU_CUSTOM_PAGE",
          getComponent: () => CustomPageRenderer,
        },
      },
      BUNNY_CUSTOM_PAGE: {
        type: "route",
        title: () => "ShiggyCord",
        screen: {
          route: "BUNNY_CUSTOM_PAGE",
          getComponent: () => CustomPageRenderer,
        },
      },
      ...getRows(),
    }),
    set: (v) => (rendererConfigValue = v),
  });

  unpatches.push(() => {
    Object.defineProperty(settingConstants, "SETTING_RENDERER_CONFIG", {
      value: origRendererConfig,
      writable: true,
      get: undefined,
      set: undefined,
    });
  });

  unpatches.push(
    after("default", SettingsOverviewScreen, (_, ret) => {
      if (useIsFirstRender()) return; // :shrug:

      const { sections } = findInReactTree(ret, (i) => i.props?.sections).props;
      // Credit to @palmdevs - https://discord.com/channels/1196075698301968455/1243605828783571024/1307940348378742816
      let index =
        -~sections.findIndex((i: any) => i.settings.includes("ACCOUNT")) || 1;

      Object.keys(registeredSections).forEach((sect) => {
        // Prevent duplicate insertion: on some resumes/re-renders the same
        // registeredSections keys may be inserted multiple times. Check if a
        // section with the same label already exists before splicing.
        const exists = sections.some((s: any) => s && s.label === sect);
        if (exists) return;
        sections.splice(index++, 0, {
          label: sect,
          title: sect,
          settings: registeredSections[sect].map((a) => a.key),
        });
      });
    }),
  );
}
