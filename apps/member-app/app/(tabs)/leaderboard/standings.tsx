import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ContestLeaderboard } from '@/components/contestLeaderboard';
import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { CompetitionHubNav } from '@/components/competitionHubNav';
import { RecoverableError } from '@/components/reliability';
import { BrandScreenHeader } from '@/components/screenLayout';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useMyLatestCompetitionResults } from '@/data/appDataHooks';
import { useCompetitionRegion } from '@/state/competitionRegion';

export default function LeaderboardWinnersScreen() {
  const router = useRouter();
  const { competitionRegion } = useCompetitionRegion();
  const resultsQuery = useMyLatestCompetitionResults();
  const publishedResults =
    resultsQuery.data?.resultsStatus === 'settled' ? resultsQuery.data : null;

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        memoryKey="leaderboard-winners"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <BrandScreenHeader
          accent="pink"
          description="See the current Goal-group leaders, then return here for audited champions and prize-draw winners."
          eyebrow={`${competitionRegion.label} // MONTHLY CONTEST`}
          title="LEADERBOARD / WINNERS"
        />

        <CompetitionHubNav active="winners" style={styles.hubNav} />

        <ContestLeaderboard />

        <View style={styles.winnersHeading}>
          <TerminalText glow tone="pink" variant="label">
            FINAL WINNERS
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="caption">
            Audited Goal champions and prize-draw winners publish after the
            contest closes.
          </TerminalText>
        </View>

        <HUDBorderBox style={styles.winnersCard} tone="pink">
          {resultsQuery.isError ? (
            <RecoverableError
              body="Final winner status could not be loaded. The live leaderboard above is still available."
              onRetry={() => void resultsQuery.refetch()}
              retrying={resultsQuery.isFetching}
              title="COULD NOT LOAD WINNERS"
            />
          ) : resultsQuery.isPending ? (
            <TerminalText live="polite" tone="muted" variant="label">
              CHECKING FINAL RESULTS...
            </TerminalText>
          ) : publishedResults ? (
            <>
              <TerminalText glow tone="pink" variant="label">
                WINNERS CIRCLE PUBLISHED
              </TerminalText>
              <TerminalText
                style={styles.winnersCopy}
                tone="muted"
                uppercase={false}
                variant="body"
              >
                {publishedResults.competitionName} has audited champions and{' '}
                {publishedResults.rewardCount.toLocaleString()} reward winners
                ready to view.
              </TerminalText>
              <CyberButtonPrimary
                label="OPEN WINNERS CIRCLE ->"
                onPress={() => router.push('/winners-circle')}
                tone="pink"
              />
            </>
          ) : resultsQuery.data?.resultsStatus === 'pending' ? (
            <>
              <TerminalText glow tone="amber" variant="label">
                RESULTS UNDER REVIEW
              </TerminalText>
              <TerminalText
                style={styles.winnersCopy}
                tone="muted"
                uppercase={false}
                variant="body"
              >
                The contest is complete. Final Goal champions and prize-draw
                winners will appear after audit.
              </TerminalText>
            </>
          ) : (
            <>
              <TerminalText glow tone="cyan" variant="label">
                CURRENT CONTEST IN PROGRESS
              </TerminalText>
              <TerminalText
                style={styles.winnersCopy}
                tone="muted"
                uppercase={false}
                variant="body"
              >
                Follow the leaderboard above. This section will unlock when
                final results are published.
              </TerminalText>
            </>
          )}
        </HUDBorderBox>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.transparent
  },
  hubNav: {
    marginBottom: spacing.lg
  },
  winnersHeading: {
    gap: spacing.xs,
    marginTop: spacing.xl,
    marginBottom: spacing.md
  },
  winnersCard: {
    gap: spacing.md,
    padding: spacing.lg
  },
  winnersCopy: {
    fontFamily: fontFamilies.body
  }
});
