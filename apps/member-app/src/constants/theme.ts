import { DarkTheme } from 'expo-router/react-navigation';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { brandColors, brandFonts } from '@gogymgo/brand';

type GlowViewStyle = ViewStyle & {
  boxShadow?: string;
};

type GlowTextStyle = TextStyle & {
  textShadow?: string;
};

export const colors = {
  // Primary / brand
  background: brandColors.background,
  page: brandColors.background,
  panel: brandColors.panel,
  panelSoft: brandColors.panelSoft,
  transparent: 'transparent',
  cyan: brandColors.cyan,
  cyanSoft: brandColors.cyanSoft,
  cyanMuted: '#8FD8DC',
  pink: brandColors.pink,
  pinkSoft: '#FFD9EC',
  amber: brandColors.amber,
  green: brandColors.green,

  // Typography / text
  text: brandColors.text,
  textOnPrimary: '#04282A',
  textOnPink: '#200816',
  textOnGreen: '#062712',
  textOnAmber: '#2A2100',
  textDisabled: '#9AAAB0',
  muted: brandColors.muted,
  dim: '#78939A',

  // Status / feedback
  statusSuccess: brandColors.green,
  statusError: brandColors.error,
  statusWarning: brandColors.amber,
  statusInfo: brandColors.cyan,

  // Backgrounds / surfaces
  surfacePrizeDark: '#1A0C1F',
  surfaceVideoDark: '#1A1015',
  backgroundAlpha72: 'rgba(8, 11, 14, 0.72)',
  panelAlpha45: 'rgba(13, 22, 34, 0.45)',
  panelAlpha50: 'rgba(13, 22, 34, 0.5)',
  panelAlpha70: 'rgba(13, 22, 34, 0.7)',
  panelAlpha84: 'rgba(11, 17, 24, 0.84)',
  blackAlpha25: 'rgba(0, 0, 0, 0.25)',
  blackAlpha80: 'rgba(0, 0, 0, 0.80)',
  whiteAlpha05: 'rgba(255, 255, 255, 0.05)',
  whiteAlpha06: 'rgba(255, 255, 255, 0.06)',
  whiteAlpha07: 'rgba(255, 255, 255, 0.07)',
  whiteAlpha08: 'rgba(255, 255, 255, 0.08)',
  whiteAlpha10: 'rgba(255, 255, 255, 0.1)',
  whiteAlpha12: 'rgba(255, 255, 255, 0.12)',
  whiteAlpha15: 'rgba(255, 255, 255, 0.15)',

  // Cyan states: active, selected, progress, verified, safe
  surfaceCyanGhost: 'rgba(52, 229, 232, 0.035)',
  surfaceCyanWhisper: 'rgba(52, 229, 232, 0.045)',
  surfaceCyanFaint: 'rgba(52, 229, 232, 0.055)',
  surfaceCyanSubtle: 'rgba(52, 229, 232, 0.06)',
  surfaceCyanSoft: 'rgba(52, 229, 232, 0.08)',
  surfaceCyanSelected: 'rgba(52, 229, 232, 0.12)',
  surfaceCyanProgress: 'rgba(52, 229, 232, 0.14)',
  surfaceCyanActive: 'rgba(52, 229, 232, 0.16)',
  surfaceCyanStrong: 'rgba(52, 229, 232, 0.18)',
  borderCyanHairline: 'rgba(52, 229, 232, 0.16)',
  borderCyanSubtle: 'rgba(52, 229, 232, 0.18)',
  borderCyanSoft: 'rgba(52, 229, 232, 0.22)',
  borderCyanMuted: 'rgba(52, 229, 232, 0.24)',
  borderCyanLight: 'rgba(52, 229, 232, 0.25)',
  borderCyanQuiet: 'rgba(52, 229, 232, 0.28)',
  borderCyan: 'rgba(52, 229, 232, 0.3)',
  borderCyanMedium: 'rgba(52, 229, 232, 0.32)',
  borderCyanStrong: 'rgba(52, 229, 232, 0.35)',
  borderCyanButton: 'rgba(52, 229, 232, 0.36)',
  borderCyanProminent: 'rgba(52, 229, 232, 0.38)',
  borderCyanSelected: 'rgba(52, 229, 232, 0.4)',
  borderCyanActive: 'rgba(52, 229, 232, 0.45)',
  borderCyanHeavy: 'rgba(52, 229, 232, 0.55)',
  borderCyanBright: 'rgba(52, 229, 232, 0.7)',
  borderCyanGlow: 'rgba(52, 229, 232, 0.72)',
  cyanGlow: 'rgba(52, 229, 232, 0.34)',

  // Pink states: prize, multiplier, reward and confirmed sponsor value
  surfacePinkGhost: 'rgba(255, 45, 155, 0.035)',
  surfacePinkFaint: 'rgba(255, 45, 155, 0.055)',
  surfacePinkSoft: 'rgba(255, 45, 155, 0.07)',
  surfacePink: 'rgba(255, 45, 155, 0.08)',
  surfacePinkActive: 'rgba(255, 45, 155, 0.16)',
  surfacePinkStrong: 'rgba(255, 45, 155, 0.18)',
  borderPinkSubtle: 'rgba(255, 45, 155, 0.18)',
  borderPinkSoft: 'rgba(255, 45, 155, 0.2)',
  borderPinkMuted: 'rgba(255, 45, 155, 0.28)',
  borderPink: 'rgba(255, 45, 155, 0.3)',
  borderPinkMedium: 'rgba(255, 45, 155, 0.34)',
  borderPinkStrong: 'rgba(255, 45, 155, 0.38)',
  borderPinkHeavy: 'rgba(255, 45, 155, 0.5)',
  borderPinkGlow: 'rgba(255, 45, 155, 0.72)',
  pinkGlow: 'rgba(255, 45, 155, 0.34)',

  // Status states: verified/success, caution/pending, invalid/destructive
  surfaceSuccess: 'rgba(77, 255, 136, 0.08)',
  surfaceSuccessActive: 'rgba(77, 255, 136, 0.16)',
  borderSuccess: 'rgba(77, 255, 136, 0.38)',
  borderSuccessGlow: 'rgba(77, 255, 136, 0.72)',
  successGlow: 'rgba(77, 255, 136, 0.3)',
  surfaceWarning: 'rgba(255, 224, 102, 0.08)',
  surfaceWarningActive: 'rgba(255, 224, 102, 0.15)',
  borderWarning: 'rgba(255, 224, 102, 0.38)',
  borderWarningGlow: 'rgba(255, 224, 102, 0.68)',
  warningGlow: 'rgba(255, 224, 102, 0.28)',
  surfaceError: 'rgba(255, 0, 0, 0.07)',
  surfaceErrorActive: 'rgba(255, 0, 0, 0.14)',
  borderError: 'rgba(255, 0, 0, 0.38)',
  borderErrorGlow: 'rgba(255, 0, 0, 0.68)',
  errorGlow: 'rgba(255, 0, 0, 0.26)',

  // Muted states
  surfaceMutedGlow: 'rgba(125, 148, 155, 0.12)',
  borderMutedDisabled: 'rgba(125, 148, 155, 0.16)',
  borderMuted: 'rgba(125, 148, 155, 0.22)',
  textMutedGlow: 'rgba(125, 148, 155, 0.36)',

  // Backward-compatible aliases used by navigation and legacy surfaces
  border: 'rgba(52, 229, 232, 0.18)',
  borderStrong: 'rgba(52, 229, 232, 0.55)',
  sponsorBorder: 'rgba(255, 45, 155, 0.28)',
  gridLine: 'rgba(52, 229, 232, 0.08)'
} as const;

export const colorRoles = {
  primary: colors.cyan,
  secondary: colors.pink,
  accent: colors.pink,
  background: colors.background,
  surface: colors.panel,
  surfaceRaised: colors.panelSoft,
  textPrimary: colors.text,
  textSecondary: colors.muted,
  textTertiary: colors.dim,
  status: {
    success: colors.statusSuccess,
    error: colors.statusError,
    warning: colors.statusWarning,
    info: colors.statusInfo
  }
} as const;

const nativeBodyFont =
  Platform.select({
    android: 'sans-serif',
    ios: 'System',
    web: brandFonts.body
  }) ?? 'System';

const nativeBodyStrongFont =
  Platform.select({
    android: 'sans-serif-medium',
    ios: 'System',
    web: brandFonts.bodyStrong
  }) ?? 'System';

export const fontFamilies = {
  body: nativeBodyFont,
  bodyStrong: nativeBodyStrongFont,
  display: brandFonts.display,
  terminal: brandFonts.mono,
  ui: nativeBodyFont
} as const;

export const fontSizes = {
  micro: 13,
  label: 14,
  button: 15,
  body: 17,
  control: 16,
  cardTitle: 17,
  stat: 18,
  titleSmall: 19,
  title: 21,
  titleLarge: 22,
  titleXl: 24,
  title2Xl: 25,
  screenTitle: 27,
  value: 28,
  valueLarge: 30,
  displaySmall: 34,
  timer: 40,
  display: 42,
  qr: 44,
  prize: 46,
  logo: 50,
  heroTimer: 62,
  heroNumber: 64
} as const;

export const lineHeights = {
  micro: 18,
  label: 20,
  button: 22,
  body: 26,
  cardTitle: 24,
  title: 28,
  titleXl: 31,
  title2Xl: 32,
  value: 34,
  displaySmall: 42,
  display: 50,
  prize: 54
} as const;

export const letterSpacings = {
  none: 0,
  tight: 0,
  micro: 0.8,
  button: 0,
  label: 1.4
} as const;

export const typography = {
  display: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.display,
    letterSpacing: letterSpacings.tight,
    lineHeight: lineHeights.display
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.title,
    letterSpacing: letterSpacings.tight,
    lineHeight: lineHeights.title
  },
  value: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.value,
    letterSpacing: letterSpacings.tight,
    lineHeight: lineHeights.value
  },
  label: {
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.label,
    letterSpacing: letterSpacings.label,
    lineHeight: lineHeights.label
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body
  },
  caption: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    letterSpacing: letterSpacings.none,
    lineHeight: 22
  },
  micro: {
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.micro,
    letterSpacing: letterSpacings.micro,
    lineHeight: lineHeights.micro
  },
  button: {
    fontFamily: fontFamilies.bodyStrong,
    fontWeight: '600',
    fontSize: fontSizes.button,
    letterSpacing: letterSpacings.button,
    lineHeight: lineHeights.button
  }
} satisfies Record<string, TextStyle>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screenX: 20
} as const;

export const radii = {
  sm: 8,
  md: 11,
  lg: 13,
  xl: 14
} as const;

export const cyberGlow = {
  cyan:
    Platform.select<GlowViewStyle>({
      web: {
        boxShadow: '0 0 24px rgba(52, 229, 232, 0.18)'
      },
      default: {
        shadowColor: colors.cyan,
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8
      }
    }) ?? {},
  pink:
    Platform.select<GlowViewStyle>({
      web: {
        boxShadow: '0 0 24px rgba(255, 45, 155, 0.16)'
      },
      default: {
        shadowColor: colors.pink,
        shadowOpacity: 0.16,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8
      }
    }) ?? {},
  green:
    Platform.select<GlowViewStyle>({
      web: {
        boxShadow: '0 0 22px rgba(77, 255, 136, 0.15)'
      },
      default: {
        shadowColor: colors.statusSuccess,
        shadowOpacity: 0.15,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 0 },
        elevation: 7
      }
    }) ?? {},
  amber:
    Platform.select<GlowViewStyle>({
      web: {
        boxShadow: '0 0 22px rgba(255, 224, 102, 0.14)'
      },
      default: {
        shadowColor: colors.statusWarning,
        shadowOpacity: 0.14,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 0 },
        elevation: 7
      }
    }) ?? {},
  red:
    Platform.select<GlowViewStyle>({
      web: {
        boxShadow: '0 0 22px rgba(255, 0, 0, 0.14)'
      },
      default: {
        shadowColor: colors.statusError,
        shadowOpacity: 0.14,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 0 },
        elevation: 7
      }
    }) ?? {},
  muted:
    Platform.select<GlowViewStyle>({
      web: {
        boxShadow: `0 0 16px ${colors.surfaceMutedGlow}`
      },
      default: {
        shadowColor: colors.dim,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
        elevation: 3
      }
    }) ?? {}
} as const;

export const textGlow = {
  cyan:
    Platform.select<GlowTextStyle>({
      web: { textShadow: '0 0 12px rgba(52, 229, 232, 0.3)' },
      default: {
        textShadowColor: 'rgba(52, 229, 232, 0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
      }
    }) ?? {},
  pink:
    Platform.select<GlowTextStyle>({
      web: { textShadow: '0 0 12px rgba(255, 45, 155, 0.28)' },
      default: {
        textShadowColor: 'rgba(255, 45, 155, 0.28)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
      }
    }) ?? {},
  green:
    Platform.select<GlowTextStyle>({
      web: { textShadow: '0 0 12px rgba(77, 255, 136, 0.26)' },
      default: {
        textShadowColor: 'rgba(77, 255, 136, 0.26)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
      }
    }) ?? {},
  amber:
    Platform.select<GlowTextStyle>({
      web: { textShadow: '0 0 12px rgba(255, 224, 102, 0.24)' },
      default: {
        textShadowColor: 'rgba(255, 224, 102, 0.24)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
      }
    }) ?? {},
  red:
    Platform.select<GlowTextStyle>({
      web: { textShadow: '0 0 12px rgba(255, 0, 0, 0.24)' },
      default: {
        textShadowColor: 'rgba(255, 0, 0, 0.24)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
      }
    }) ?? {},
  muted:
    Platform.select<GlowTextStyle>({
      web: { textShadow: `0 0 6px ${colors.textMutedGlow}` },
      default: {
        textShadowColor: colors.textMutedGlow,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 6
      }
    }) ?? {}
} satisfies Record<string, GlowTextStyle>;

export const goGymGoTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.cyan,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.pink
  }
} satisfies typeof DarkTheme;
