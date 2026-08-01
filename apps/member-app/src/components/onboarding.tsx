import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { TerminalText } from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';

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
  const progressWidth =
    progress === undefined
      ? null
      : (`${Math.max(0, Math.min(100, progress))}%` as `${number}%`);

  return (
    <View style={style}>
      <View style={styles.headerRow}>
        {onBack ? (
          <ScreenBackButton onPress={onBack} />
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <TerminalText style={styles.stepText} tone="dim" variant="label">
          {step}
        </TerminalText>
        <TerminalText glow style={styles.labelText} tone="cyan" variant="label">
          {label}
        </TerminalText>
      </View>
      {progressWidth ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      ) : null}
    </View>
  );
}

export function ScreenBackButton({ onPress }: ScreenBackButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Back"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
    >
      <TerminalText glow tone="cyan" variant="button">
        {'<'}
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
        glow={tone !== 'muted'}
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
  headerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanButton,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanGhost,
    ...webFocusOutline
  },
  backPlaceholder: {
    width: 44
  },
  stepText: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  labelText: {
    fontFamily: fontFamilies.terminal,
    textAlign: 'right'
  },
  progressTrack: {
    height: 3,
    overflow: 'hidden',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    borderRadius: 2,
    backgroundColor: colors.whiteAlpha06
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
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
