import { instead } from "@lib/api/patcher";
import { logger } from "@lib/utils/logger";
import { _lazyContextSymbol } from "@metro/lazy";
import { requireModule } from "@metro/internals/modules";
import { LazyModuleContext } from "@metro/types";
import { findByNameLazy } from "@metro/wrappers";

function log(...messages: any[]) {
  try {
    logger.warn("[ShiggyCord] patchAnimatedValue:", ...messages);
  } catch {}
}

/**
 * Discord's bundled React Native throws `AnimatedValue: Attempting to set value
 * to undefined` when a `undefined` value reaches an `Animated.Value` — either
 * through `setValue()` (which calls `_updateValue`) or through the constructor.
 * Some of Discord's own flows (and third-party plugins) hit this during
 * animation setup, which bubbles up to the React ErrorBoundary and makes
 * ShiggyCord render its custom crash screen.
 *
 * Fix the root cause instead of masking the symptom:
 * - `_updateValue` is a prototype method, so one patch covers every instance no
 *   matter which module captured the class reference.
 * - The constructor is guarded by swapping the public `Animated.Value`
 *   reference (and the module's `default` export) for a patched proxy so that
 *   `new Animated.Value(undefined)` can no longer throw.
 */
export default function patchAnimatedValue() {
  const unpatchers: Array<() => boolean> = [];

  const install = (Class: any, source: string) => {
    try {
      if (
        !Class?.prototype ||
        typeof Class.prototype._updateValue !== "function"
      ) {
        log(`${source}: resolved value is not AnimatedValue, skipping`);
        return;
      }

      // setValue(undefined) → _updateValue(undefined). Keep the last value.
      unpatchers.push(
        instead(
          "_updateValue",
          Class.prototype,
          function (this: any, args: any[], origFunc: Function) {
            if (args[0] === undefined) args[0] = this?._value ?? 0;
            return origFunc(...args);
          },
        ),
      );

      // Constructor guard: coerce non-number to 0 so `new Animated.Value(undefined)` can't throw.
      const guard = (args: any[], origFunc: Function) => {
        if (typeof args[0] !== "number") args[0] = 0;
        return origFunc(...args);
      };

      // 1. Module exports (`require(...).default`).
      try {
        const ctxt: LazyModuleContext | undefined =
          findByNameLazy("AnimatedValue")[_lazyContextSymbol];
        if (ctxt?.moduleId != null) {
          const moduleExports = requireModule(ctxt.moduleId);
          if (moduleExports?.default === Class) {
            unpatchers.push(instead("default", moduleExports, guard));
          }
        }
      } catch {}

      // 2. The public `Animated.Value` namespace reference.
      try {
        const ReactNative: any = require("react-native");
        const Animated = ReactNative?.Animated;
        if (Animated && Animated.Value === Class) {
          unpatchers.push(instead("Value", Animated, guard));
        }
      } catch {}

      log(`${source}: patched _updateValue + constructor guard`);
    } catch (e) {
      log(`${source}: patch failed`, e);
    }
  };

  // Primary: Discord's own RN Animated namespace (most reliable, no full scan).
  try {
    const ReactNative: any = require("react-native");
    install(ReactNative?.Animated?.Value, "react-native.Animated.Value");
    if (unpatchers.length > 0) {
      return () => unpatchers.forEach((unpatch) => unpatch());
    }
  } catch (e) {
    log("react-native.Animated path failed", e);
  }

  // Fallback: byName lookup.
  try {
    const ctxt: LazyModuleContext =
      findByNameLazy("AnimatedValue")[_lazyContextSymbol];
    if (ctxt) {
      ctxt.getExports((Class: any) => install(Class, "findByNameLazy"));
    } else {
      log("no lazy context found");
    }
  } catch (e) {
    log("findByNameLazy path failed", e);
  }

  return () => unpatchers.forEach((unpatch) => unpatch());
}
