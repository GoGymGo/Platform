import { createElement, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type AccessibilityProps,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  borders,
  colors,
  componentSizes,
  cyberGlow,
  interactionStates,
  radii,
  spacing,
  textGlow,
  typography
} from '@/constants/theme';

export { ScreenScrollView } from './screenScrollView';

type TerminalTone = 'cyan' | 'pink' | 'green' | 'amber' | 'red' | 'muted' | 'text' | 'dim';
type TerminalVariant =
  | 'display'
  | 'title'
  | 'value'
  | 'label'
  | 'body'
  | 'caption'
  | 'micro'
  | 'button';
type HUDTone = 'cyan' | 'pink' | 'green' | 'amber' | 'red' | 'muted';
type CyberButtonTone = 'cyan' | 'pink' | 'green' | 'amber' | 'red';

type ScreenContainerProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  frameStyle?: StyleProp<ViewStyle>;
  surface?: 'base' | 'modal';
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
  accessibilityLabel?: AccessibilityProps['accessibilityLabel'];
  accessibilityLiveRegion?: AccessibilityProps['accessibilityLiveRegion'];
  accessibilityRole?: AccessibilityProps['accessibilityRole'];
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: HUDTone;
}>;

type CyberButtonProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  tone?: CyberButtonTone;
};

const terminalToneStyles: Record<TerminalTone, TextStyle> = {
  cyan: { color: colors.cyan },
  pink: { color: colors.pink },
  green: { color: colors.statusSuccess },
  amber: { color: colors.statusWarning },
  red: { color: colors.statusError },
  muted: { color: colors.muted },
  text: { color: colors.text },
  dim: { color: colors.dim }
};

const terminalGlowStyles = {
  cyan: textGlow.cyan,
  pink: textGlow.pink,
  green: textGlow.green,
  amber: textGlow.amber,
  red: textGlow.red,
  muted: textGlow.muted,
  text: textGlow.cyan,
  dim: textGlow.muted
} satisfies Record<TerminalTone, TextStyle>;

const hudToneStyles: Record<HUDTone, ViewStyle> = {
  cyan: {
    borderColor: colors.borderCyanMedium,
    backgroundColor: colors.surfaceCyanWhisper
  },
  pink: {
    borderColor: colors.borderPinkStrong,
    backgroundColor: colors.surfacePinkFaint
  },
  green: {
    borderColor: colors.borderSuccess,
    backgroundColor: colors.surfaceSuccess
  },
  amber: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
  },
  red: {
    borderColor: colors.borderError,
    backgroundColor: colors.surfaceError
  },
  muted: {
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceRaised
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
  },
  green: {
    borderColor: colors.borderSuccessGlow,
    backgroundColor: colors.surfaceSuccessActive
  },
  amber: {
    borderColor: colors.borderWarningGlow,
    backgroundColor: colors.surfaceWarningActive
  },
  red: {
    borderColor: colors.borderErrorGlow,
    backgroundColor: colors.surfaceErrorActive
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
  },
  green: {
    borderColor: colors.borderSuccess,
    backgroundColor: colors.surfaceSuccess
  },
  amber: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
  },
  red: {
    borderColor: colors.borderError,
    backgroundColor: colors.surfaceError
  }
};

export function ScreenContainer({
  children,
  contentStyle,
  frameStyle,
  surface = 'base'
}: ScreenContainerProps) {
  const surfaceStyle = surface === 'modal' ? cyberStyles.modalSurface : cyberStyles.baseSurface;

  return createElement(
    SafeAreaView,
    { style: [cyberStyles.safeArea, surfaceStyle] },
    createElement(
      View,
      { style: [cyberStyles.frame, surfaceStyle, frameStyle] },
      createElement(View, { style: [cyberStyles.content, surfaceStyle, contentStyle] }, children)
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
  accessibilityLabel,
  accessibilityLiveRegion,
  accessibilityRole,
  children,
  glow = false,
  style,
  tone = 'cyan'
}: HUDBorderBoxProps) {
  return createElement(
    View,
    {
      accessibilityLabel,
      accessibilityLiveRegion,
      accessibilityRole,
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
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  style,
  tone = 'cyan'
}: CyberButtonProps) {
  const [focused, setFocused] = useState(false);

  return createElement(
    Pressable,
    {
      accessibilityRole: 'button',
      accessibilityLabel: accessibilityLabel ?? label,
      accessibilityHint,
      accessibilityState: { disabled },
      disabled,
      onBlur: () => setFocused(false),
      onFocus: () => setFocused(true),
      onPress,
      style: ({ pressed }: PressableStateCallbackType) => [
        cyberStyles.buttonShell,
        primaryToneStyles[tone],
        disabled ? null : cyberGlow[tone],
        focused ? cyberStyles.focused : null,
        pressed ? cyberStyles.pressed : null,
        disabled ? cyberStyles.disabled : null,
        style
      ]
    },
    createElement(ButtonContent, { glow: true, label, tone })
  );
}

export function CyberButtonOutline({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  style,
  tone = 'cyan'
}: CyberButtonProps) {
  const [focused, setFocused] = useState(false);

  return createElement(
    Pressable,
    {
      accessibilityRole: 'button',
      accessibilityLabel: accessibilityLabel ?? label,
      accessibilityHint,
      accessibilityState: { disabled },
      disabled,
      onBlur: () => setFocused(false),
      onFocus: () => setFocused(true),
      onPress,
      style: ({ pressed }: PressableStateCallbackType) => [
        cyberStyles.buttonShell,
        outlineToneStyles[tone],
        focused ? cyberStyles.focused : null,
        pressed ? cyberStyles.pressed : null,
        disabled ? cyberStyles.disabled : null,
        style
      ]
    },
    createElement(ButtonContent, { glow: false, label, tone })
  );
}

function ButtonContent({
  glow,
  label,
  tone
}: {
  glow: boolean;
  label: string;
  tone: CyberButtonTone;
}) {
  return createElement(
    View,
    { style: cyberStyles.buttonContent },
    createElement(
      TerminalText,
      { glow, tone, variant: 'button' },
      label
    )
  );
}

const cyberStyles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: componentSizes.screenMaxWidth,
    alignSelf: 'center'
  },
  content: {
    flex: 1
  },
  baseSurface: {
    backgroundColor: colors.surfaceBase
  },
  modalSurface: {
    backgroundColor: colors.surfaceModal
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
  caption: {
    ...typography.caption
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
    borderWidth: borders.hairline,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised
  },
  buttonShell: {
    minHeight: componentSizes.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    borderWidth: borders.hairline,
    borderRadius: radii.lg,
    ...interactionStates.webFocus
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  pressed: {
    ...interactionStates.pressed
  },
  disabled: {
    ...interactionStates.disabled,
    borderColor: colors.borderMutedDisabled,
    backgroundColor: colors.surfaceDisabled
  },
  focused: {
    borderColor: colors.borderFocus,
    ...cyberGlow.cyan
  }
});
