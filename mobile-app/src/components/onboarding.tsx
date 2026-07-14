import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { TerminalText } from '@/components/cyber';
import {
  borders,
  colors,
  componentSizes,
  cyberGlow,
  fontFamilies,
  interactionStates,
  radii,
  spacing
} from '@/constants/theme';

type OnboardingHeaderProps = {
  label: string;
  onBack?: () => void;
  progress?: number;
  step: string;
  style?: StyleProp<ViewStyle>;
};

type CompactTextButtonProps = {
  label: string;
  onPress: () => void;
  tone?: 'cyan' | 'pink' | 'muted';
};

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
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <TerminalText glow tone="cyan" variant="button">
              {'<'}
            </TerminalText>
          </Pressable>
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
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ max: 100, min: 0, now: Math.max(0, Math.min(100, progress ?? 0)) }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      ) : null}
    </View>
  );
}

export function CompactTextButton({
  label,
  onPress,
  tone = 'cyan'
}: CompactTextButtonProps) {
  const textTone = tone === 'muted' ? 'dim' : tone;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed ? styles.pressed : null]}
    >
      <TerminalText glow={tone !== 'muted'} tone={textTone} variant="button">
        {label}
      </TerminalText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    minHeight: componentSizes.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  backButton: {
    width: componentSizes.minimumTouchTarget,
    height: componentSizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borders.hairline,
    borderColor: colors.borderInteractive,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceInteractive,
    ...interactionStates.webFocus
  },
  backPlaceholder: {
    width: componentSizes.minimumTouchTarget
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
    minHeight: componentSizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    ...interactionStates.webFocus
  },
  pressed: {
    ...interactionStates.pressed
  }
});
