import { DarkTheme } from '@react-navigation/native';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

type GlowViewStyle = ViewStyle & {
  boxShadow?: string;
};

export const colors = {
  // Primary / brand
  background: '#080B0E',
  page: '#080B0E',
  panel: '#0B1118',
  panelSoft: '#0F1720',
  transparent: 'transparent',
  cyan: '#34E5E8',
  cyanSoft: '#9FF3F5',
  cyanMuted: '#8FD8DC',
  pink: '#FF2D9B',
  pinkSoft: '#FFD9EC',
  amber: '#FFE066',
  green: '#4DFF88',

  // Typography / text
  text: '#E9F7F8',
  textOnPrimary: '#04282A',
  textDisabled: '#8FA0A8',
  muted: '#7D949B',
  dim: '#5D7A82',

  // Status / feedback
  statusSuccess: '#4DFF88',
  statusError: '#FF0000',
  statusWarning: '#FFE066',
  statusInfo: '#34E5E8',

  // Backgrounds / surfaces
  surfacePrizeDark: '#1A0C1F',
  surfaceVideoDark: '#1A1015',
  backgroundAlpha72: 'rgba(8, 11, 14, 0.72)',
  panelAlpha45: 'rgba(13, 22, 34, 0.45)',
  panelAlpha50: 'rgba(13, 22, 34, 0.5)',
  panelAlpha70: 'rgba(13, 22, 34, 0.7)',
  panelAlpha84: 'rgba(11, 17, 24, 0.84)',
  blackAlpha25: 'rgba(0, 0, 0, 0.25)',
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

  // Pink states: prize, creator payout, sponsor, urgent, destructive
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

export const fontFamilies = {
  display: 'Orbitron-Bold',
  terminal: 'ShareTechMono-Regular'
} as const;

export const fontSizes = {
  micro: 9,
  label: 11,
  button: 13,
  body: 14,
  control: 15,
  cardTitle: 16,
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
  micro: 13,
  label: 16,
  button: 18,
  body: 20,
  cardTitle: 22,
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
  micro: 1.8,
  button: 0,
  label: 2.2
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
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body
  },
  micro: {
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.micro,
    letterSpacing: letterSpacings.micro,
    lineHeight: lineHeights.micro
  },
  button: {
    fontFamily: fontFamilies.display,
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
  screenX: 24
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
        boxShadow: `0 0 20px ${colors.cyanGlow}`
      },
      default: {
        shadowColor: colors.cyan,
        shadowOpacity: 0.38,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8
      }
    }) ?? {},
  pink:
    Platform.select<GlowViewStyle>({
      web: {
        boxShadow: `0 0 22px ${colors.pinkGlow}`
      },
      default: {
        shadowColor: colors.pink,
        shadowOpacity: 0.36,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8
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
  cyan: {
    textShadowColor: colors.borderCyanGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10
  },
  pink: {
    textShadowColor: colors.borderPinkGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10
  },
  muted: {
    textShadowColor: colors.textMutedGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6
  }
} satisfies Record<string, TextStyle>;

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
