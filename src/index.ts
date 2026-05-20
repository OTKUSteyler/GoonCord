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

const INIT_TIMEOUT_MS = 3000; // 3s max per init before we give up and move on

/**
 * Races a named init against a timeout so a deadlocked promise can never
 * freeze the splash screen indefinitely.
 */
async function safeInit(
  name: string,
  fn: () => Promise<any>,
  timeoutMs = INIT_TIMEOUT_MS,
): Promise<any | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => {
      logger.log(`[ShiggyCord] init timed out (skipped): ${name}`);
      resolve(null);
    }, timeoutMs),
  );

  try {
    return await Promise.race([
      timings.measureAsync(`critical:${name}`, async () => fn()),
      timeout,
    ]);
  } catch (e) {
    logger.log(`[ShiggyCord] critical init failed (non-fatal): ${name}`, e);
    return null;
  }
}

export default async () => {
  const stableInits: Array<[string, () => Promise<any>]> = [
    ["initThemes",            () => initThemes()],
    ["patchLogHook",          () => patchLogHook()],
    ["patchCommands",         () => patchCommands()],
    ["patchJsx",              () => patchJsx()],
    ["patchErrorBoundary",    () => patchErrorBoundary()],
    ["initVendettaObject",    () => initVendettaObject()],
    ["initDebugger",          () => initDebugger()],
  ];

  // These are the most likely to deadlock — give them slightly more time
  // but still cap them so they can't hang the splash screen.
  const networkInits: Array<[string, () => Promise<any>]> = [
    ["injectFluxInterceptor", () => injectFluxInterceptor()],
    ["initFetchI18nStrings",  () => initFetchI18nStrings()],
  ];

  // Settings inits — most likely to have broken patches from bundle update.
  const settingsInits: Array<[string, () => Promise<any>]> = [
    ["patchSettings", () => patchSettings()],
    ["initSettings",  () => initSettings()],
    ["initFixes",     () => initFixes()],
  ];

  // Stable inits in parallel — fast and unlikely to deadlock.
  const stableResults = await Promise.all(
    stableInits.map(([name, fn]) => safeInit(name, fn)),
  );
  stableResults.forEach((f) => f && lib.unload.push(f));

  // Network/flux inits in parallel with a longer timeout.
  const networkResults = await Promise.all(
    networkInits.map(([name, fn]) => safeInit(name, fn, 5000)),
  );
  networkResults.forEach((f) => f && lib.unload.push(f));

  // Settings inits sequentially and isolated.
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
