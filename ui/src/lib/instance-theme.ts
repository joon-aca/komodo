import { colorsTuple, darken, lighten, virtualColor } from "@mantine/core";
import { functionColorsTuple } from "mogh_ui";

export type InstanceTheme = "default" | "blue" | "violet";

const PALETTES = {
  blue: { light: "#e5effc", dark: "#101d30" },
  violet: { light: "#f0e5fc", dark: "#25182f" },
};

// This endpoint is public so the same palette is available before login.
// Older Core versions may return the SPA's HTML here; keep stock styling then.
export async function loadInstanceTheme(baseUrl: string): Promise<InstanceTheme> {
  try {
    const response = await fetch(`${baseUrl}/ui-config`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const { theme } = await response.json();
      if (theme === "blue" || theme === "violet") return theme;
    }
  } catch {
    // Presentation settings must never prevent login or application startup.
  }
  return "default";
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
