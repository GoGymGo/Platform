import { createElement, type PropsWithChildren, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, cyberGlow, radii, spacing, textGlow, typography } from '@/constants/theme';

type TerminalTone = 'cyan' | 'pink' | 'muted' | 'text' | 'dim';
type TerminalVariant = 'display' | 'title' | 'value' | 'label' | 'body' | 'micro' | 'button';
type HUDTone = 'cyan' | 'pink' | 'muted';
type CyberButtonTone = 'cyan' | 'pink';

type ScreenContainerProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  frameStyle?: StyleProp<ViewStyle>;
}>;

type TerminalTextProps = {
  children?: ReactNode;
  glow?: boolean;
  style?: StyleProp<TextStyle>;
  tone?: TerminalTone;
  uppercase?: boolean;
  variant?: TerminalVariant;
};

type HUDBorderBoxProps = PropsWithChildren<{
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: HUDTone;
}>;

type CyberButtonProps = {
  disabled?: boolean;
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  tone?: CyberButtonTone;
};

const terminalToneStyles: Record<TerminalTone, TextStyle> = {
  cyan: { color: colors.cyan },
  pink: { color: colors.pink },
  muted: { color: colors.muted },
  text: { color: colors.text },
  dim: { color: colors.dim }
};

const terminalGlowStyles = {
  cyan: textGlow.cyan,
  pink: textGlow.pink,
  muted: textGlow.muted,
  text: textGlow.cyan,
  dim: textGlow.muted
} satisfies Record<TerminalTone, TextStyle>;

const hudToneStyles: Record<HUDTone, ViewStyle> = {
  cyan: {
    borderColor: colors.borderCyanStrong,
    backgroundColor: colors.surfaceCyanFaint
  },
  pink: {
    borderColor: colors.borderPinkStrong,
    backgroundColor: colors.surfacePinkFaint
  },
  muted: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelAlpha84
  }
};

const primaryToneStyles: Record<CyberButtonTone, ViewStyle> = {
  cyan: {
    borderColor: colors.borderCyanGlow,
    backgroundColor: colors.surfaceCyanActive
  },
  pink: {
    borderColor: colors.borderPinkGlow,
    backgroundColor: colors.surfacePinkActive
  }
};

const outlineToneStyles: Record<CyberButtonTone, ViewStyle> = {
  cyan: {
    borderColor: colors.borderCyanButton,
    backgroundColor: colors.surfaceCyanGhost
  },
  pink: {
    borderColor: colors.borderPinkStrong,
    backgroundColor: colors.surfacePinkGhost
  }
};

export function ScreenContainer({
  children,
  contentStyle,
  frameStyle
}: ScreenContainerProps) {
  return createElement(
    SafeAreaView,
    { style: cyberStyles.safeArea },
    createElement(
      View,
      { style: [cyberStyles.frame, frameStyle] },
      createElement(View, { style: [cyberStyles.content, contentStyle] }, children)
    )
  );
}

export function TerminalText({
  children,
  glow = false,
  style,
  tone = 'text',
  uppercase,
  variant = 'body'
}: TerminalTextProps) {
  const shouldUppercase =
    uppercase ?? ['display', 'value', 'label', 'micro', 'button'].includes(variant);

  return createElement(
    Text,
    {
      style: [
        cyberStyles.terminalBase,
        cyberStyles[variant],
        terminalToneStyles[tone],
        glow ? terminalGlowStyles[tone] : null,
        shouldUppercase ? cyberStyles.uppercase : null,
        style
      ]
    },
    children
  );
}

export function HUDBorderBox({
  children,
  glow = false,
  style,
  tone = 'cyan'
}: HUDBorderBoxProps) {
  return createElement(
    View,
    {
      style: [
        cyberStyles.hudBox,
        hudToneStyles[tone],
        glow ? cyberGlow[tone] : null,
        style
      ]
    },
    children
  );
}

export function CyberButtonPrimary({
  disabled = false,
  label,
  onPress,
  style,
  tone = 'cyan'
}: CyberButtonProps) {
  return createElement(
    Pressable,
    {
      accessibilityRole: 'button',
      disabled,
      onPress,
      style: ({ pressed }: PressableStateCallbackType) => [
        cyberStyles.buttonShell,
        primaryToneStyles[tone],
        cyberGlow[tone],
        pressed ? cyberStyles.pressed : null,
        disabled ? cyberStyles.disabled : null,
        style
      ]
    },
    createElement(ButtonContent, { label, tone })
  );
}

export function CyberButtonOutline({
  disabled = false,
  label,
  onPress,
  style,
  tone = 'cyan'
}: CyberButtonProps) {
  return createElement(
    Pressable,
    {
      accessibilityRole: 'button',
      disabled,
      onPress,
      style: ({ pressed }: PressableStateCallbackType) => [
        cyberStyles.buttonShell,
        outlineToneStyles[tone],
        pressed ? cyberStyles.pressed : null,
        disabled ? cyberStyles.disabled : null,
        style
      ]
    },
    createElement(ButtonContent, { label, tone })
  );
}

function ButtonContent({
  label,
  tone
}: {
  label: string;
  tone: CyberButtonTone;
}) {
  return createElement(
    View,
    { style: cyberStyles.buttonContent },
    createElement(
      TerminalText,
      { glow: true, tone, variant: 'button' },
      label
    )
  );
}

const cyberStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: colors.background
  },
  content: {
    flex: 1,
    backgroundColor: colors.background
  },
  terminalBase: {
    color: colors.text
  },
  display: {
    ...typography.display
  },
  title: {
    ...typography.title
  },
  value: {
    ...typography.value
  },
  label: {
    ...typography.label
  },
  body: {
    ...typography.body
  },
  micro: {
    ...typography.micro
  },
  button: {
    ...typography.button
  },
  uppercase: {
    textTransform: 'uppercase'
  },
  hudBox: {
    width: '100%',
    padding: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.panel
  },
  buttonShell: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radii.lg
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }]
  },
  disabled: {
    opacity: 0.42,
    borderColor: colors.borderMutedDisabled,
    backgroundColor: colors.panelSoft
  }
});
