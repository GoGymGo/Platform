import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import {
  ScreenScrollView,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { OnboardingHeader } from '@/components/onboarding';
import { BrandScreenHeader } from '@/components/screenLayout';
import { colors, spacing } from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useCompetitionRegion } from '@/state/competitionRegion';

export default function GymCompetitionScreen() {
  const router = useRouter();
  const { competitionRegion } = useCompetitionRegion();

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader
          label="GYM CONTEST"
          onBack={() => goBackOrReplace(router, '/squad')}
          step="PARTNER GYM"
        />
        <BrandScreenHeader
          description="Partner gym Contests and location-verified workouts will appear here when participating Partner gyms are ready."
          eyebrow="PARTNER GYM"
          title="GYM CONTEST"
        />

        <HUDBorderBox style={styles.unavailableCard} tone="muted">
          <TerminalText tone="cyan" variant="label">
            PARTNER GYMS AREN&apos;T AVAILABLE IN {competitionRegion.label} YET
          </TerminalText>
        </HUDBorderBox>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.transparent
  },
  unavailableCard: {
    gap: spacing.sm,
    padding: spacing.xl
  }
});
