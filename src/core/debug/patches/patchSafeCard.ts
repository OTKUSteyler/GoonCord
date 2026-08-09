import React from "react";
import { View } from "react-native";
import { byProps } from "@metro/filters";
import { findExports } from "@metro/finders";
import { findByStoreNameLazy } from "@metro/wrappers";
import { instead } from "@lib/api/patcher";
import { logger } from "@lib/utils/logger";
import { isSemanticColor, resolveSemanticColor, semanticColors } from "@ui/color";

const ThemeStore = findByStoreNameLazy("ThemeStore");

function log(...messages: any[]) {
  try {
    logger.warn("[ShiggyCord] patchSafeCard:", ...messages);
  } catch {}
}

let cardHealthy = false;

const FALLBACK_STYLE = {
  borderRadius: 8,
  padding: 16,
};

function resolveCardBackground(): string | undefined {
  try {
    const color = semanticColors?.CARD_BACKGROUND_DEFAULT;
    if (isSemanticColor(color)) return resolveSemanticColor(color);
    if (typeof color === "string") return color;
  } catch {}

  return undefined;
}

export default function patchSafeCard() {
  const unpatchers: Array<() => boolean> = [];

  try {
    const cardModule = findExports(byProps("Card"));
    const origCard = cardModule?.Card;
    if (typeof origCard !== "function") {
      log("no Card function on the resolved module, skipping");
      return () => unpatchers.forEach((unpatch) => unpatch());
    }

    log("resolved design Card from first-match module");

    let cardBackground = resolveCardBackground();

    const unsubscribeTheme = ThemeStore?.addChangeListener?.(() => {
      const resolved = resolveCardBackground();
      if (resolved) cardBackground = resolved;
    });
    if (typeof unsubscribeTheme === "function") {
      unpatchers.push(() => {
        unsubscribeTheme();
        return true;
      });
    }

    class CardProbeBoundary extends React.Component<
      {
        fallback: React.ReactNode;
        children?: React.ReactNode;
      },
      { hasError: boolean }
    > {
      state = { hasError: false };

      static getDerivedStateFromError() {
        return { hasError: true };
      }

      componentDidCatch(error: unknown) {
        try {
          log("Card render threw, using View fallback", error);
        } catch {}
      }

      render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
      }
    }

    class HealthyProbe extends React.Component<{
      onHealthy: () => void;
      children?: React.ReactNode;
    }> {
      componentDidMount() {
        this.props.onHealthy();
      }

      render() {
        return this.props.children;
      }
    }

    const SafeCard = function SafeCard(props: any) {
      if (cardHealthy) return React.createElement(origCard, props);

      return React.createElement(
        CardProbeBoundary,
        {
          fallback: React.createElement(
            View,
            {
              style: [
                FALLBACK_STYLE,
                ...(cardBackground
                  ? [{ backgroundColor: cardBackground }]
                  : []),
                props?.style,
              ],
            },
            props?.children,
          ),
        },
        React.createElement(
          HealthyProbe,
          {
            onHealthy: () => {
              cardHealthy = true;
            },
          },
          React.createElement(origCard, props),
        ),
      );
    };

    unpatchers.push(
      instead("Card", cardModule, (args: any[]) => SafeCard(args[0] ?? {})),
    );

    log("patched design Card (adaptive probe on first mount)");
  } catch (e) {
    log("patch failed", e);
  }

  return () => unpatchers.forEach((unpatch) => unpatch());
}
