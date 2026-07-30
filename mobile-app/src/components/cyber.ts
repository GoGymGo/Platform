import { createElement, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type AccessibilityRole,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTourModeBanner } from '@/components/appTour';
import { colors, cyberGlow, radii, spacing, textGlow, typography } from '@/constants/theme';

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
}>;

type TerminalTextProps = {
  accessibilityRole?: AccessibilityRole;
  children?: ReactNode;
  glow?: boolean;
  live?: 'polite' | 'assertive';
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
  accessibilityHint?: string;
  disabled?: boolean;
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  tone?: CyberButtonTone;
};

type ScreenLoadingStateProps = {
  body?: string;
  label?: string;
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
    borderColor: colors.borderCyanStrong,
    backgroundColor: colors.surfaceCyanFaint
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

const webFocusOutline = Platform.select({
  web: { outlineColor: colors.cyan } as unknown as ViewStyle,
  default: {}
});

export function ScreenContainer({
  children,
  contentStyle,
  frameStyle
}: ScreenContainerProps) {
  return createElement(
    SafeAreaView,
    { style: cyberStyles.safeArea },
    createElement(AppTourModeBanner),
    createElement(
      View,
      { style: [cyberStyles.frame, frameStyle] },
      createElement(View, { style: [cyberStyles.content, contentStyle] }, children)
    )
  );
}

export function TerminalText({
  accessibilityRole,
  children,
  glow = false,
  live,
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
      accessibilityLiveRegion: live,
      accessibilityRole: accessibilityRole ?? (variant === 'title' ? 'header' : undefined),
      allowFontScaling: true,
      maxFontSizeMultiplier:
        variant === 'display' || variant === 'value' ? 1.5 : 2,
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

export function ScreenLoadingState({
  body,
  label = 'LOADING GOGYMGO'
}: ScreenLoadingStateProps) {
  return createElement(
    ScreenContainer,
    { contentStyle: cyberStyles.stateScreen },
    createElement(ActivityIndicator, { color: colors.cyan, size: 'large' }),
    createElement(
      TerminalText,
      { glow: true, live: 'polite', tone: 'cyan', variant: 'label' },
      label
    ),
    body
      ? createElement(
          TerminalText,
          {
            live: 'polite',
            style: cyberStyles.stateBody,
            tone: 'muted',
            uppercase: false,
            variant: 'body'
          },
          body
        )
      : null
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
  accessibilityHint,
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
      accessibilityHint,
      accessibilityState: { disabled },
      disabled,
      onPress,
      style: ({ pressed }: PressableStateCallbackType) => [
        cyberStyles.buttonShell,
        primaryToneStyles[tone],
        disabled ? null : cyberGlow[tone],
        pressed ? cyberStyles.pressed : null,
        disabled ? cyberStyles.disabled : null,
        style
      ]
    },
    createElement(ButtonContent, { label, tone })
  );
}

export function CyberButtonOutline({
  accessibilityHint,
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
      accessibilityHint,
      accessibilityState: { disabled },
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
  const hasTrailingArrow = /\s*->$/.test(label);
  const visibleLabel = hasTrailingArrow ? label.replace(/\s*->$/, '') : label;

  return createElement(
    View,
    { style: cyberStyles.buttonContent },
    createElement(
      TerminalText,
      {
        glow: true,
        style: cyberStyles.buttonLabel,
        tone,
        uppercase: false,
        variant: 'button'
      },
      visibleLabel
    ),
    hasTrailingArrow
      ? createElement(
          TerminalText,
          {
            glow: true,
            style: cyberStyles.buttonArrow,
            tone,
            uppercase: false,
            variant: 'button'
          },
          '->'
        )
      : null
  );
}

const cyberStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.background
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    overflow: 'hidden',
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
    borderRadius: radii.lg,
    ...webFocusOutline
  },
  buttonContent: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  buttonLabel: {
    minWidth: 0,
    flexShrink: 1,
    textAlign: 'center'
  },
  buttonArrow: {
    flexShrink: 0
  },
  pressed: {
    opacity: 0.72
  },
  disabled: {
    opacity: 0.42,
    borderColor: colors.borderMutedDisabled,
    backgroundColor: colors.panelSoft
  },
  stateScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
    backgroundColor: colors.background
  },
  stateBody: {
    maxWidth: 320,
    textAlign: 'center'
  }
});
