import { createFont, createTamagui, createTokens } from "tamagui";

const bodyFont = createFont({
  family: "\"Avenir Next\", \"Segoe UI\", \"Helvetica Neue\", sans-serif",
  size: {
    1: 12,
    2: 13,
    3: 14,
    4: 16,
    5: 18,
    6: 20,
    true: 16
  },
  lineHeight: {
    1: 16,
    2: 18,
    3: 20,
    4: 22,
    5: 24,
    6: 28,
    true: 22
  },
  weight: {
    4: "400",
    5: "500",
    6: "600",
    7: "700"
  },
  letterSpacing: {
    1: 0.2,
    2: 0.1,
    true: 0.1
  }
});

const headingFont = createFont({
  family: "\"Iowan Old Style\", Georgia, \"Times New Roman\", serif",
  size: {
    1: 14,
    2: 16,
    3: 20,
    4: 28,
    5: 36,
    6: 44,
    true: 28
  },
  lineHeight: {
    1: 18,
    2: 22,
    3: 28,
    4: 36,
    5: 44,
    6: 52,
    true: 36
  },
  weight: {
    4: "400",
    5: "500",
    6: "600",
    7: "700"
  },
  letterSpacing: {
    1: 0.2,
    2: 0.2,
    true: 0.2
  }
});

const tokens = createTokens({
  color: {
    paper: "#1A1A1A",
    paperDarker: "#242424",
    paperDeep: "#0F0F0F",
    panelLine: "#3A3A3A",
    textPrimary: "#E0E0E0",
    textMuted: "#8A8A8A",
    textSubtle: "#A7A7A7",
    accentGold: "#D4C3A9",
    accentGoldSoft: "#6F6351",
    chapterActive: "#2C2C2C",
    manuscriptInk: "#DAD7CF",
    manuscriptDim: "#BBB5A9"
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 36,
    9: 48,
    true: 16
  },
  size: {
    0: 0,
    1: 11,
    2: 12,
    3: 14,
    4: 16,
    5: 18,
    6: 22,
    7: 28,
    8: 36,
    9: 46,
    true: 16
  },
  radius: {
    0: 0,
    1: 3,
    2: 6,
    3: 10,
    4: 16,
    5: 999,
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
      background: "$paper",
      color: "$textPrimary",
      borderColor: "$panelLine",
      panel: "$paperDarker",
      panelDeep: "$paperDeep",
      muted: "$textMuted",
      subtle: "$textSubtle",
      accent: "$accentGold"
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
