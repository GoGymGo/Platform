import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { TerminalText } from '@/components/cyber';
import { colors, fontFamilies, radii, spacing } from '@/constants/theme';

type OnboardingHeaderProps = {
  label: string;
  onBack?: () => void;
  progress?: number;
  step: string;
  style?: StyleProp<ViewStyle>;
};

type CompactTextButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone?: 'amber' | 'cyan' | 'pink' | 'muted';
};

type ScreenBackButtonProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const webFocusOutline = Platform.select({
  web: { outlineColor: colors.cyan } as unknown as ViewStyle,
  default: {}
});

export function OnboardingHeader({
  label,
  onBack,
  progress,
  step,
  style
}: OnboardingHeaderProps) {
  const { width } = useWindowDimensions();
  const compact = width <= 400;
  const progressWidth =
    progress === undefined
      ? null
      : (`${Math.max(0, Math.min(100, progress))}%` as `${number}%`);

  return (
    <View style={[styles.headerShell, style]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <ScreenBackButton onPress={onBack} />
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <View style={[styles.headerCopy, compact ? styles.headerCopyCompact : null]}>
          <TerminalText
            numberOfLines={1}
            style={[styles.stepText, compact ? styles.headerTextCompact : null]}
            tone="dim"
            variant="label"
          >
            {step}
          </TerminalText>
          <TerminalText
            numberOfLines={1}
            style={[styles.labelText, compact ? styles.headerTextCompact : null]}
            tone="cyan"
            variant="label"
          >
            {label}
          </TerminalText>
        </View>
      </View>
      {progressWidth ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      ) : null}
    </View>
  );
}

export function ScreenBackButton({ onPress, style }: ScreenBackButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Back"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.backButton,
        style,
        pressed ? styles.pressed : null
      ]}
    >
      <TerminalText tone="cyan" uppercase={false} variant="button">
        {'←'}
      </TerminalText>
    </Pressable>
  );
}

export function CompactTextButton({
  disabled = false,
  label,
  onPress,
  tone = 'cyan'
}: CompactTextButtonProps) {
  const textTone = tone === 'muted' ? 'dim' : tone;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.textButton,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null
      ]}
    >
      <TerminalText
        tone={textTone}
        uppercase={false}
        variant="button"
      >
        {label}
      </TerminalText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerShell: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.borderCyanSubtle,
    backgroundColor: colors.transparent
  },
  headerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  headerCopy: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  headerCopyCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 0
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanMedium,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanGhost,
    ...webFocusOutline
  },
  backPlaceholder: {
    width: 44
  },
  stepText: {
    minWidth: 0,
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  labelText: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: fontFamilies.terminal,
    textAlign: 'right'
  },
  headerTextCompact: {
    width: '100%',
    flex: 0,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right'
  },
  progressTrack: {
    height: 4,
    overflow: 'hidden',
    marginTop: spacing.sm,
    borderRadius: 2,
    backgroundColor: colors.whiteAlpha06
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.cyan
  },
  textButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    ...webFocusOutline
  },
  pressed: {
    opacity: 0.7
  },
  disabled: {
    opacity: 0.45
  }
});
