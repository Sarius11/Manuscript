import type { ReactNode } from "react";
import {
  Button,
  Text,
  XStack,
  YStack,
  type ButtonProps,
  type TextProps,
  type XStackProps,
  type YStackProps
} from "tamagui";

type AppButtonTone = "default" | "ghost" | "focus" | "dashed";

interface AppButtonProps extends ButtonProps {
  tone?: AppButtonTone;
  children: ReactNode;
}

function getToneStyles(tone: AppButtonTone): {
  backgroundColor: string;
  borderColor: string;
  borderStyle: "solid" | "dashed";
  borderWidth: number;
  borderRadius: number;
  textColor: string;
  paddingHorizontal: number;
  paddingVertical: number;
} {
  if (tone === "ghost") {
    return {
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderStyle: "solid",
      borderWidth: 0,
      borderRadius: 6,
      textColor: "$textPrimary",
      paddingHorizontal: 8,
      paddingVertical: 4
    };
  }

  if (tone === "focus") {
    return {
      backgroundColor: "$accentGold",
      borderColor: "$accentGold",
      borderStyle: "solid",
      borderWidth: 1,
      borderRadius: 999,
      textColor: "$paper",
      paddingHorizontal: 14,
      paddingVertical: 6
    };
  }

  if (tone === "dashed") {
    return {
      backgroundColor: "transparent",
      borderColor: "$panelLine",
      borderStyle: "dashed",
      borderWidth: 1,
      borderRadius: 8,
      textColor: "$textMuted",
      paddingHorizontal: 12,
      paddingVertical: 8
    };
  }

  return {
    backgroundColor: "$paperDarker",
    borderColor: "$panelLine",
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 6,
    textColor: "$textPrimary",
    paddingHorizontal: 12,
    paddingVertical: 8
  };
}

export function AppShellFrame(props: YStackProps): JSX.Element {
  return <YStack minHeight="100%" height="100%" backgroundColor="$paper" {...props} />;
}

export function TopToolbarFrame(props: XStackProps): JSX.Element {
  return (
    <XStack
      height={48}
      paddingHorizontal={24}
      alignItems="center"
      justifyContent="space-between"
      borderBottomWidth={1}
      borderBottomColor="$panelLine"
      backgroundColor="$paperDarker"
      {...props}
    />
  );
}

export function WorkspaceFrame(props: XStackProps): JSX.Element {
  return <XStack flex={1} minHeight={0} {...props} />;
}

export function LeftSidebarFrame(props: YStackProps): JSX.Element {
  return (
    <YStack
      width={272}
      minHeight={0}
      borderRightWidth={1}
      borderRightColor="$panelLine"
      backgroundColor="$paperDarker"
      {...props}
    />
  );
}

export function RightSidebarFrame(props: YStackProps): JSX.Element {
  return (
    <YStack
      width={272}
      minHeight={0}
      borderLeftWidth={1}
      borderLeftColor="$panelLine"
      backgroundColor="$paperDarker"
      {...props}
    />
  );
}

export function CenterPaneFrame(props: YStackProps): JSX.Element {
  return <YStack flex={1} minHeight={0} backgroundColor="#121417" {...props} />;
}

export function StatusBarFrame(props: XStackProps): JSX.Element {
  return (
    <XStack
      height={32}
      paddingHorizontal={24}
      alignItems="center"
      justifyContent="space-between"
      backgroundColor="$paperDeep"
      {...props}
    />
  );
}

export function SectionLabel(props: TextProps): JSX.Element {
  return (
    <Text
      fontFamily="$body"
      fontSize="$1"
      letterSpacing={2}
      textTransform="uppercase"
      color="$textMuted"
      fontWeight="600"
      {...props}
    />
  );
}

export function ToolbarBrand(props: TextProps): JSX.Element {
  return (
    <Text
      fontFamily="$body"
      fontSize="$3"
      letterSpacing={2.4}
      textTransform="uppercase"
      color="$accentGold"
      fontWeight="700"
      {...props}
    />
  );
}

export function ToolbarSubtle(props: TextProps): JSX.Element {
  return <Text fontFamily="$heading" fontSize="$3" color="$textMuted" fontStyle="italic" {...props} />;
}

export function ChapterHeadingOverline(props: TextProps): JSX.Element {
  return (
    <Text
      fontFamily="$body"
      fontSize="$1"
      letterSpacing={5}
      textTransform="uppercase"
      color="$accentGold"
      marginBottom={8}
      {...props}
    />
  );
}

export function ChapterHeadingTitle(props: TextProps): JSX.Element {
  return (
    <Text
      fontFamily="$heading"
      fontSize={56}
      fontStyle="italic"
      color="$textPrimary"
      textAlign="center"
      {...props}
    />
  );
}

export function AppButton({ tone = "default", children, ...props }: AppButtonProps): JSX.Element {
  const toneStyles = getToneStyles(tone);

  return (
    <Button
      unstyled
      cursor="pointer"
      backgroundColor={toneStyles.backgroundColor}
      borderColor={toneStyles.borderColor}
      borderStyle={toneStyles.borderStyle}
      borderWidth={toneStyles.borderWidth}
      borderRadius={toneStyles.borderRadius}
      paddingHorizontal={toneStyles.paddingHorizontal}
      paddingVertical={toneStyles.paddingVertical}
      pressStyle={{ opacity: 0.82 }}
      hoverStyle={{
        borderColor: tone === "focus" ? "$accentGold" : "$accentGold",
        backgroundColor: tone === "focus" ? "$accentGold" : toneStyles.backgroundColor
      }}
      {...props}
    >
      <Text
        color={toneStyles.textColor}
        fontFamily="$body"
        fontSize="$1"
        fontWeight="600"
        letterSpacing={1.2}
        textTransform="uppercase"
      >
        {children}
      </Text>
    </Button>
  );
}

export function ToolbarDivider(): JSX.Element {
  return <YStack width={1} height={16} backgroundColor="$panelLine" />;
}
