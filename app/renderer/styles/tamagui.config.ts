import { createFont, createTamagui, createTokens } from "tamagui";

const bodyFont = createFont({
  family: "Georgia",
  size: {
    1: 12,
    2: 13,
    3: 14,
    4: 16,
    5: 18,
    true: 16
  },
  lineHeight: {
    1: 18,
    2: 19,
    3: 20,
    4: 22,
    5: 26,
    true: 22
  },
  weight: {
    4: "400",
    6: "600",
    7: "700"
  },
  letterSpacing: {
    4: 0,
    true: 0
  }
});

const headingFont = createFont({
  family: "Times New Roman",
  size: {
    2: 14,
    3: 16,
    4: 20,
    5: 24,
    6: 30,
    true: 20
  },
  lineHeight: {
    2: 18,
    3: 21,
    4: 26,
    5: 30,
    6: 36,
    true: 26
  },
  weight: {
    5: "500",
    6: "600",
    7: "700"
  },
  letterSpacing: {
    4: 0.1,
    true: 0.1
  }
});

const tokens = createTokens({
  color: {
    background: "#0c1018",
    panel: "#121926",
    panelAlt: "#171f2e",
    panelMuted: "#1f2940",
    border: "#2f3a52",
    text: "#e7ecf4",
    muted: "#9da9be",
    accent: "#66c2ff"
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 32,
    8: 40,
    true: 16
  },
  size: {
    0: 0,
    1: 14,
    2: 16,
    3: 18,
    4: 20,
    5: 24,
    6: 28,
    7: 36,
    8: 42,
    true: 16
  },
  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    true: 8
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    true: 1
  }
});

const tamaguiConfig = createTamagui({
  tokens,
  defaultTheme: "dark",
  themes: {
    dark: {
      background: "$background",
      color: "$text",
      borderColor: "$border",
      panel: "$panel",
      panelAlt: "$panelAlt",
      panelMuted: "$panelMuted",
      muted: "$muted",
      accent: "$accent"
    }
  },
  fonts: {
    body: bodyFont,
    heading: headingFont
  },
  shorthands: {
    p: "padding",
    px: "paddingHorizontal",
    py: "paddingVertical",
    m: "margin",
    mx: "marginHorizontal",
    my: "marginVertical",
    bg: "backgroundColor"
  },
  media: {
    sm: { maxWidth: 1024 },
    gtSm: { minWidth: 1025 }
  }
});

type AppTamaguiConfig = typeof tamaguiConfig;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default tamaguiConfig;
