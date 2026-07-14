import { type Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { useWorkoutProgress } from '@/state/workoutProgress';

export default function SessionTabRoute() {
  const router = useRouter();
  const { activeSession } = useWorkoutProgress();

  return (
    <ScreenContainer contentStyle={styles.screen}>
      <View style={styles.header}>
        <TerminalText glow tone="cyan" variant="label">
          SESSION START
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          CHOOSE YOUR WORKOUT
        </TerminalText>
        <TerminalText style={styles.helper} tone="muted" uppercase={false} variant="body">
          {activeSession
            ? 'Your verified workout is still running. Return to the timer to continue.'
            : 'Follow the featured regional workout or use your own plan. Both paths continue to the same verification check-in.'}
        </TerminalText>
      </View>

      <View style={styles.actions}>
        {activeSession ? (
          <CyberButtonPrimary
            label="RESUME ACTIVE SESSION ->"
            onPress={() => router.push('/workout/active')}
          />
        ) : (
          <>
            <CyberButtonPrimary
              label="FOLLOW ALONG WITH A CREATOR ->"
              onPress={() => router.push('/workouts?source=session' as Href)}
              tone="cyan"
            />
            <CyberButtonPrimary
              label="START MY OWN WORKOUT ->"
              onPress={() => router.push('/workout/method' as Href)}
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xxl,
    paddingBottom: 78,
    backgroundColor: colors.background
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  helper: {
    maxWidth: 390,
    marginTop: spacing.sm,
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  actions: {
    gap: spacing.md
  }
});
