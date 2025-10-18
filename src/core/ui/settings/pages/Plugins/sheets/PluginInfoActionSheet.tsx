import { refreshPlugin, uninstallPlugin } from "@lib/addons/plugins";
import { findAssetId } from "@lib/api/assets";
import { purgeStorage } from "@lib/api/storage";
import { hideSheet } from "@lib/ui/sheets";
import {
  ActionSheet,
  Card,
  ContextMenu,
  IconButton,
  Text,
} from "@metro/common/components";
import { clipboard } from "@metro/common";
import { ComponentProps, useState } from "react";
import { ScrollView, View } from "react-native";
import { showToast } from "@ui/toasts";
import { showConfirmationAlert } from "@core/vendetta/alerts";
import { VdPluginManager } from "@core/vendetta/plugins";
import { purgeStorage as purgeVdStorage } from "@core/vendetta/storage";

import { PluginInfoActionSheetProps } from "./common";
import TitleComponent from "./TitleComponent";

function PluginInfoIconButton(props: ComponentProps<typeof IconButton>) {
  const { onPress } = props;
  props.onPress &&= () => {
    hideSheet("PluginInfoActionSheet");
    onPress?.();
  };

  return <IconButton {...props} />;
}

export default function PluginInfoActionSheet({
  plugin,
  navigation,
}: PluginInfoActionSheetProps) {
  plugin.usePluginState();
  const [loading, setLoading] = useState(false);

  // Determine plugin type
  const isVendettaPlugin = plugin.id.includes("/");
  const isCorePlugin =
    plugin.id.startsWith("bunny.") || plugin.id.startsWith("vendetta.");

  const copyPluginUrl = () => {
    // Get appropriate URL for plugin type
    let url = plugin.id;

    if (isVendettaPlugin) {
      // Vendetta plugins use the full URL as ID
      url = plugin.id;
    } else {
      try {
        // Try to get repository URL for Bunny plugins
        const pluginAny = plugin as any;
        const repoUrl =
          pluginAny._manifest?.parentRepository ||
          pluginAny.manifest?.parentRepository;

        url = repoUrl ? `${repoUrl}/builds/${plugin.id}` : plugin.id;
      } catch (e) {
        url = plugin.id;
      }
    }

    clipboard.setString(url);
    if (typeof showToast?.showCopyToClipboard === "function") {
      showToast.showCopyToClipboard();
    } else {
      showToast("Copied to clipboard");
    }
  };

  const refetchPlugin = async () => {
    setLoading(true);
    try {
      if (isVendettaPlugin) {
        // For Vendetta plugins
        const vdPlugin = VdPluginManager.plugins[plugin.id];
        if (vdPlugin.enabled) VdPluginManager.stopPlugin(plugin.id, false);

        await VdPluginManager.fetchPlugin(plugin.id);
        if (vdPlugin.enabled) await VdPluginManager.startPlugin(plugin.id);

        showToast("Plugin refreshed successfully");
      } else {
        // For Bunny plugins
        refreshPlugin(plugin.id);
        showToast("Plugin refreshed successfully");
      }
    } catch (e) {
      console.error("Failed to refresh plugin:", e);
      showToast("Failed to refresh plugin");
    } finally {
      setLoading(false);
    }
  };

  const clearPluginData = () => {
    showConfirmationAlert({
      title: "Clear Data",
      content:
        "Are you sure you want to clear all data for this plugin? This action cannot be undone.",
      confirmText: "Clear",
      confirmColor: "red",
      cancelText: "Cancel",
      onConfirm: async () => {
        hideSheet("PluginInfoActionSheet");
        try {
          if (isVendettaPlugin) {
            // For Vendetta plugins
            const vdPlugin = VdPluginManager.plugins[plugin.id];
            if (vdPlugin.enabled) VdPluginManager.stopPlugin(plugin.id, false);

            await purgeVdStorage(plugin.id);

            if (vdPlugin.enabled) await VdPluginManager.startPlugin(plugin.id);
          } else {
            // For Bunny plugins
            await purgeStorage(`plugins/storage/${plugin.id}.json`);
          }
          showToast("Plugin data cleared successfully");
        } catch (e) {
          console.error("Failed to clear plugin data:", e);
          showToast("Failed to clear plugin data");
        }
      },
    });
  };

  const uninstallPluginHandler = () => {
    if (isCorePlugin) {
      showToast("Core plugins cannot be uninstalled");
      return;
    }

    showConfirmationAlert({
      title: "Uninstall Plugin",
      content:
        "Are you sure you want to uninstall this plugin? This action cannot be undone.",
      confirmText: "Uninstall",
      confirmColor: "red",
      cancelText: "Cancel",
      onConfirm: async () => {
        hideSheet("PluginInfoActionSheet");
        try {
          if (isVendettaPlugin) {
            // For Vendetta plugins
            await VdPluginManager.removePlugin(plugin.id);
          } else {
            // For Bunny plugins
            await uninstallPlugin(plugin.id);
          }
          showToast("Plugin uninstalled successfully");
        } catch (e) {
          console.error("Failed to uninstall plugin:", e);
          showToast(
            `Failed to uninstall plugin: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      },
    });
  };

  return (
    <ActionSheet>
      <ScrollView contentContainerStyle={{ gap: 12, marginBottom: 12 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 24,
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <TitleComponent plugin={plugin} />
          {/* Context menu removed as buttons are directly added to button row */}
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            paddingHorizontal: 4,
          }}
        >
          <PluginInfoIconButton
            label="Configure"
            variant="secondary"
            disabled={!plugin.getPluginSettingsComponent()}
            icon={findAssetId("WrenchIcon")}
            onPress={() => {
              navigation.push("SHIGGYCORD_CUSTOM_PAGE", {
                title: plugin.name,
                render: plugin.getPluginSettingsComponent(),
              });
            }}
          />
          <PluginInfoIconButton
            label="Refetch"
            variant="secondary"
            icon={findAssetId("RetryIcon")}
            onPress={refetchPlugin}
            disabled={loading}
          />
          <PluginInfoIconButton
            label="Copy URL"
            variant="secondary"
            icon={findAssetId("LinkIcon")}
            onPress={copyPluginUrl}
          />
          <PluginInfoIconButton
            label="Clear Data"
            variant="secondary"
            icon={findAssetId("FileIcon")}
            onPress={clearPluginData}
          />
          {!isCorePlugin && (
            <PluginInfoIconButton
              label="Uninstall"
              variant="secondary"
              icon={findAssetId("TrashIcon")}
              onPress={uninstallPluginHandler}
            />
          )}
        </View>
        <Card>
          <Text
            variant="text-md/semibold"
            color="text-primary"
            style={{ marginBottom: 4 }}
          >
            Description
          </Text>
          <Text variant="text-md/medium">{plugin.description}</Text>
        </Card>
      </ScrollView>
    </ActionSheet>
  );
}
