import { colorsTuple, darken, lighten, virtualColor } from "@mantine/core";
import { functionColorsTuple } from "mogh_ui";

export type InstanceTheme = "default" | "blue" | "violet";

const PALETTES = {
  blue: { light: "#e5effc", dark: "#101d30" },
  violet: { light: "#f0e5fc", dark: "#25182f" },
};

export interface UiConfig {
  theme: InstanceTheme;
  /** Empty when the instance is unnamed. */
  instanceName: string;
}

const APP_NAME = "KOMODO";
/** Matches Core's limit; guards the layout against any other responder. */
const INSTANCE_NAME_MAX_CHARS = 40;

// Resolved once before the first render and constant afterwards.
let uiConfig: UiConfig = { theme: "default", instanceName: "" };

export const instanceName = () => uiConfig.instanceName;

/** The app name, followed by the instance name when one is configured. */
export const appName = () =>
  uiConfig.instanceName
    ? `${APP_NAME} · ${uiConfig.instanceName}`
    : APP_NAME;

// This endpoint is public so the same presentation is available before login.
// Older Core versions may return the SPA's HTML here; keep stock styling then.
export async function loadUiConfig(baseUrl: string): Promise<UiConfig> {
  try {
    const response = await fetch(`${baseUrl}/ui-config`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const { theme, instance_name } = await response.json();
      uiConfig = {
        theme: theme === "blue" || theme === "violet" ? theme : "default",
        instanceName:
          typeof instance_name === "string"
            ? Array.from(instance_name.trim())
                .slice(0, INSTANCE_NAME_MAX_CHARS)
                .join("")
            : "",
      };
    }
  } catch {
    // Presentation settings must never prevent login or application startup.
  }
  return uiConfig;
}

export function instanceThemeColors(name: InstanceTheme) {
  if (name === "default") return {};

  const { light, dark } = PALETTES[name];
  return {
    // Reuse mogh_ui's virtual accent / accent-border colors and component defaults.
    lightAccent: functionColorsTuple(darken(light, 0.02), (c) => darken(c, 0.01)),
    darkAccent: functionColorsTuple(lighten(dark, 0.025), (c) => lighten(c, 0.012)),
    lightAccentBorder: functionColorsTuple(darken(light, 0.1), (c) =>
      darken(c, 0.01),
    ),
    darkAccentBorder: functionColorsTuple(lighten(dark, 0.08), (c) =>
      lighten(c, 0.03),
    ),
    lightInstanceBody: colorsTuple(light),
    darkInstanceBody: colorsTuple(dark),
    "instance-body": virtualColor({
      name: "instance-body",
      light: "lightInstanceBody",
      dark: "darkInstanceBody",
    }),
  };
}
