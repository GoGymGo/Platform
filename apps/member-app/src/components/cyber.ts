import { createElement, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type AccessibilityRole,
  type PressableStateCallbackType,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  cyberGlow,
  fontFamilies,
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
}>;

type TerminalTextProps = {
  accessibilityRole?: AccessibilityRole;
  children?: ReactNode;
  glow?: boolean;
  live?: 'polite' | 'assertive';
  numberOfLines?: number;
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
    borderColor: colors.cyan,
    backgroundColor: colors.cyan
  },
  pink: {
    borderColor: colors.pink,
    backgroundColor: colors.pink
  },
  green: {
    borderColor: colors.green,
    backgroundColor: colors.green
  },
  amber: {
    borderColor: colors.amber,
    backgroundColor: colors.amber
  },
  red: {
    borderColor: colors.statusError,
    backgroundColor: colors.statusError
  }
};

const primaryTextToneStyles: Record<CyberButtonTone, TextStyle> = {
  cyan: { color: colors.textOnPrimary },
  pink: { color: colors.textOnPink },
  green: { color: colors.textOnGreen },
  amber: { color: colors.textOnAmber },
  red: { color: colors.text }
};

const outlineTextToneStyles: Record<CyberButtonTone, TextStyle> = {
  cyan: { color: colors.cyanSoft },
  pink: { color: colors.pinkSoft },
  green: { color: colors.green },
  amber: { color: colors.amber },
  red: { color: colors.statusError }
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
  const { width } = useWindowDimensions();
  const responsiveFrameStyle = width >= 1100
    ? cyberStyles.frameDesktop
    : width >= 700
      ? cyberStyles.frameTablet
      : null;

  return createElement(
    SafeAreaView,
    { style: cyberStyles.safeArea },
    createElement(
      View,
      { style: [cyberStyles.frame, responsiveFrameStyle, frameStyle] },
      createElement(
        View,
        { pointerEvents: 'none', style: cyberStyles.backdrop },
        createElement(View, { style: cyberStyles.cyanSignal }),
        createElement(View, { style: cyberStyles.topRule })
      ),
      createElement(View, { style: [cyberStyles.content, contentStyle] }, children)
    )
  );
}

export function TerminalText({
  accessibilityRole,
  children,
  glow = false,
  live,
  numberOfLines,
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
      numberOfLines,
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
    createElement(ButtonContent, { disabled, filled: true, label, tone })
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
    createElement(ButtonContent, { disabled, filled: false, label, tone })
  );
}

function ButtonContent({
  disabled,
  filled,
  label,
  tone
}: {
  disabled: boolean;
  filled: boolean;
  label: string;
  tone: CyberButtonTone;
}) {
  const hasTrailingArrow = /\s*->$/.test(label);
  const visibleLabel = hasTrailingArrow ? label.replace(/\s*->$/, '') : label;
  const textTone = filled ? primaryTextToneStyles[tone] : outlineTextToneStyles[tone];

  return createElement(
    View,
    { style: cyberStyles.buttonContent },
    createElement(
      Text,
      {
        allowFontScaling: true,
        maxFontSizeMultiplier: 1.5,
        style: [
          cyberStyles.buttonLabel,
          textTone,
          disabled ? cyberStyles.buttonLabelDisabled : null
        ]
      },
      visibleLabel
    ),
    hasTrailingArrow
      ? createElement(
          Text,
          {
            allowFontScaling: true,
            maxFontSizeMultiplier: 1.5,
            style: [
              cyberStyles.buttonArrow,
              textTone,
              disabled ? cyberStyles.buttonLabelDisabled : null
            ]
          },
          '→'
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
    maxWidth: 480,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: colors.background
  },
  frameTablet: {
    maxWidth: 720
  },
  frameDesktop: {
    maxWidth: 960
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden'
  },
  cyanSignal: {
    position: 'absolute',
    top: -170,
    right: -170,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: colors.surfaceCyanSoft,
    opacity: 0.34
  },
  topRule: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 1,
    backgroundColor: colors.cyan,
    opacity: 0.32
  },
  content: {
    flex: 1,
    backgroundColor: colors.transparent
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
    borderRadius: radii.md,
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
    ...typography.button,
    textAlign: 'center'
  },
  buttonArrow: {
    flexShrink: 0,
    fontFamily: fontFamilies.ui,
    fontSize: 18,
    lineHeight: 18
  },
  buttonLabelDisabled: {
    color: colors.muted
  },
  pressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }]
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
