import patchErrorBoundary from "@core/debug/patches/patchErrorBoundary";
import initFixes from "@core/fixes";
import { initFetchI18nStrings } from "@core/i18n";
import initSettings from "@core/ui/settings";
import { initVendettaObject } from "@core/vendetta/api";
import { updateFonts } from "@lib/addons/fonts";
import { initThemes } from "@lib/addons/themes";
import { patchCommands } from "@lib/api/commands";
import { patchLogHook } from "@lib/api/debug";
import { injectFluxInterceptor } from "@lib/api/flux";
import { patchJsx } from "@lib/api/react/jsx";
import { logger } from "@lib/utils/logger";
import { patchSettings } from "@ui/settings";
import { updaterSettings } from "@lib/api/settings";
import { InteractionManager } from "react-native";
import { getDebugInfo, initDebugger } from "@lib/api/debug";

import * as lib from "./lib";
import { timings } from "@lib/utils/timings";

/**
 * Safe wrapper — runs a named init, isolates its failure so it cannot
 * crash the whole startup sequence, and returns its unpatcher (or null).
 */
async function safeInit(
  name: string,
  fn: () => Promise<any>,
): Promise<any | null> {
  try {
    return await timings.measureAsync(`critical:${name}`, async () => fn());
  } catch (e) {
    // Settings-related patches often reference Discord internals that can
    // be renamed/removed in a bundle update. Isolating them here means the
    // rest of the app still loads even if one patch fails.
    logger.log(`[ShiggyCord] critical init failed (non-fatal): ${name}`, e);
    return null;
  }
}

export default async () => {
  // Non-settings inits — less likely to be affected by bundle changes.
  const stableInits: Array<[string, () => Promise<any>]> = [
    ["initThemes",          () => initThemes()],
    ["injectFluxInterceptor", () => injectFluxInterceptor()],
    ["patchLogHook",        () => patchLogHook()],
    ["patchCommands",       () => patchCommands()],
    ["patchJsx",            () => patchJsx()],
    ["patchErrorBoundary",  () => patchErrorBoundary()],
    ["initVendettaObject",  () => initVendettaObject()],
    ["initFetchI18nStrings", () => initFetchI18nStrings()],
    ["initDebugger",        () => initDebugger()],
  ];

  // Settings-related inits — these are the ones touching SettingHookHarness
  // and most likely to break when Discord updates its bundle. Each runs in
  // total isolation so a failure in one cannot affect the others.
  const settingsInits: Array<[string, () => Promise<any>]> = [
    ["patchSettings", () => patchSettings()],
    ["initSettings",  () => initSettings()],
    ["initFixes",     () => initFixes()],
  ];

  // Run stable inits in parallel as before.
  const stableResults = await Promise.all(
    stableInits.map(([name, fn]) => safeInit(name, fn)),
  );
  stableResults.forEach((f) => f && lib.unload.push(f));

  // Run settings inits sequentially and isolated — if patchSettings corrupts
  // state, we don't want initSettings running on top of it blindly.
  for (const [name, fn] of settingsInits) {
    const result = await safeInit(name, fn);
    if (result) lib.unload.push(result);
  }

  window.bunny = lib;

  logger.log(
    "ShiggyCord: UI-critical initialization complete — deferring plugin & network work",
  );

  const runDeferred = async () => {
    const { VdPluginManager } = await import("@core/vendetta/plugins");
    const { initPlugins, updatePlugins } = await import("@lib/addons/plugins");

    VdPluginManager.initPlugins()
      .then((u) => lib.unload.push(u))
      .catch((e) => logger.log("Vendetta init failed:", e));

    initPlugins({ staggerInterval: 500, batchSize: 2 });

    try {
      const mod = await import("@core/debug/toggleCorePlugins").catch(
        () => null,
      );
      if (mod?.default) {
        mod.default({ offDuration: 1500 }).catch(() => {});
      }

      await import("@lib/api/native/fs")
        .then((fs) => fs.removeFile("src/core/debug/toggleCorePlugins.ts"))
        .catch(() => {});
    } catch {
      // suppressed
    }

    updateFonts().catch((e) => logger.log("updateFonts failed:", e));

    setTimeout(
      () => {
        updatePlugins().catch((e) =>
          logger.log("updatePlugins failed (deferred 5min):", e),
        );
      },
      5 * 60 * 1000,
    );
  };

  try {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(runDeferred, 50);
    });
  } catch (e) {
    setTimeout(runDeferred, 200);
  }

  logger.log("GoonCord is ready.");
};or 
