import { useEffect } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { spacing } from '@/constants/theme';

type FeedbackTone = 'amber' | 'cyan' | 'green' | 'red';

const feedbackLabels: Record<FeedbackTone, string> = {
  amber: 'NEEDS ATTENTION',
  cyan: 'UPDATE',
  green: 'DONE',
  red: 'ERROR'
};

export function useAccessibilityAnnouncement(
  message: string | null | undefined
) {
  useEffect(() => {
    if (message) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}

export function ActionFeedback({
  message,
  style,
  tone = 'cyan'
}: {
  message: string;
  style?: StyleProp<ViewStyle>;
  tone?: FeedbackTone;
}) {
  useAccessibilityAnnouncement(message);

  return (
    <HUDBorderBox style={[styles.feedback, style]} tone={tone}>
      <TerminalText glow tone={tone} variant="micro">
        {feedbackLabels[tone]}
      </TerminalText>
      <TerminalText live={tone === 'red' ? 'assertive' : 'polite'} tone="text" uppercase={false} variant="caption">
        {message}
      </TerminalText>
    </HUDBorderBox>
  );
}

export function RecoverableError({
  body,
  continueLabel,
  onContinue,
  onRetry,
  retrying = false,
  style,
  title
}: {
  body: string;
  continueLabel?: string;
  onContinue?: () => void;
  onRetry: () => void;
  retrying?: boolean;
  style?: StyleProp<ViewStyle>;
  title: string;
}) {
  useAccessibilityAnnouncement(`${title}. ${body}`);

  return (
    <HUDBorderBox glow style={[styles.error, style]} tone="red">
      <TerminalText glow tone="red" variant="label">
        {title}
      </TerminalText>
      <TerminalText tone="text" uppercase={false} variant="body">
        {body}
      </TerminalText>
      <View style={styles.actions}>
        <CyberButtonPrimary
          disabled={retrying}
          label={retrying ? 'Retrying...' : 'Retry'}
          onPress={onRetry}
          tone="red"
        />
        {onContinue && continueLabel ? (
          <CyberButtonOutline
            label={continueLabel}
            onPress={onContinue}
            tone="cyan"
          />
        ) : null}
      </View>
    </HUDBorderBox>
  );
}

export function RecoverableScreenError(
  props: Parameters<typeof RecoverableError>[0]
) {
  return (
    <ScreenContainer contentStyle={styles.screenError}>
      <RecoverableError {...props} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  feedback: {
    gap: spacing.xs,
    padding: spacing.md
  },
  error: {
    gap: spacing.md,
    padding: spacing.lg
  },
  actions: {
    gap: spacing.sm
  },
  screenError: {
    justifyContent: 'center',
    padding: spacing.xl
  }
});
