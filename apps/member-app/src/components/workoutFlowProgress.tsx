import {
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle
} from 'react-native';

import { TerminalText } from '@/components/cyber';
import { colors, spacing } from '@/constants/theme';

export type WorkoutFlowStage = 'device' | 'start' | 'verify' | 'complete';

const stages: readonly {
  key: WorkoutFlowStage;
  label: string;
}[] = [
  { key: 'device', label: 'DEVICE' },
  { key: 'start', label: 'START' },
  { key: 'verify', label: 'VERIFY' },
  { key: 'complete', label: 'COMPLETE' }
];

export function WorkoutFlowProgress({
  complete = false,
  stage,
  style
}: {
  complete?: boolean;
  stage: WorkoutFlowStage;
  style?: StyleProp<ViewStyle>;
}) {
  const activeIndex = stages.findIndex((item) => item.key === stage);
  const currentStep = complete ? stages.length : activeIndex + 1;
  const currentLabel = complete
    ? 'Complete'
    : `${stages[activeIndex].label[0]}${stages[activeIndex].label.slice(1).toLowerCase()}`;

  return (
    <View
      accessibilityLabel={complete
        ? 'Workout complete. All four steps finished.'
        : `Workout step ${activeIndex + 1} of ${stages.length}: ${stages[activeIndex].label.toLowerCase()}.`}
      accessibilityRole="progressbar"
      accessibilityValue={{
        max: stages.length,
        min: 1,
        now: currentStep
      }}
      style={[styles.container, style]}
    >
      <View style={styles.summary}>
        <TerminalText tone="dim" uppercase={false} variant="caption">
          Step {currentStep} of {stages.length}
        </TerminalText>
        <View style={styles.separator} />
        <TerminalText
          glow
          tone={complete ? 'green' : 'cyan'}
          uppercase={false}
          variant="caption"
        >
          {currentLabel}
        </TerminalText>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.trackFill,
            complete ? styles.trackComplete : null,
            { width: `${(currentStep / stages.length) * 100}%` }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.xs
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  separator: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.dim
  },
  track: {
    width: '100%',
    height: 3,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: colors.whiteAlpha08
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.cyan
  },
  trackComplete: {
    backgroundColor: colors.statusSuccess
  }
});
