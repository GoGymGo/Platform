import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { ProfileAvatar } from '@/components/profileAvatar';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { colors, cyberGlow, fontFamilies, spacing } from '@/constants/theme';
import { getPublicInitials } from '@/domain/profile';
import { formatDateKey, useWorkoutProgress } from '@/state/workoutProgress';
import { useProfile } from '@/state/profile';

type PlayerTone = 'cyan' | 'muted';

export default function SquadScreen() {
  const router = useRouter();
  const { profileImageUri, publicName } = useProfile();
  const { competition, competitionEntryStartDateKey, weeklyGoal } = useWorkoutProgress();
  const activePeriod = competition.currentPeriod;
  const isRemainderDayPhase =
    competition.phase === 'bonus-days' && competition.bonusDateKeys.length > 0;
  const matchInitials = activePeriod
    ? getInitials(activePeriod.opponentAlias)
    : '--';
  const bonusStatus = activePeriod
    ? getBonusStatus(activePeriod, weeklyGoal)
    : 'AVAILABLE WHEN YOUR PERIOD MATCH STARTS';
  const bonusEndDay = Number(competition.bonusDateKeys.at(-1)?.slice(-2) ?? 28);

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText glow tone="cyan" variant="label">
            {activePeriod
              ? 'YOUR WEEKLY OPPONENT'
              : isRemainderDayPhase
                ? 'BONUS DAYS 29-31'
                : 'MATCH PENDING'}
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            {activePeriod
              ? `WEEK ${activePeriod.index} PERIOD MATCH`
              : isRemainderDayPhase
                ? 'BONUS DAYS. EXTRA ENTRIES.'
                : 'YOUR FIRST MATCH STARTS SOON'}
          </TerminalText>
        </View>

        {activePeriod ? (
          <HUDBorderBox glow style={styles.pactCard} tone="cyan">
            <View style={styles.matchupRow}>
              <PlayerBlock
                initials={getPublicInitials(publicName)}
                imageUri={profileImageUri}
                label="YOU"
                progress={`${Math.min(activePeriod.userVerifiedCount, weeklyGoal)} / ${weeklyGoal}`}
                tone="cyan"
              />
              <TerminalText style={styles.vsText} tone="dim" variant="button">
                VS
              </TerminalText>
              <PlayerBlock
                initials={matchInitials}
                label={activePeriod.opponentAlias}
                progress={`${Math.min(activePeriod.opponentVerifiedCount, weeklyGoal)} / ${weeklyGoal}`}
                tone="muted"
              />
            </View>

            <View style={styles.dailyProgress}>
              <DailyProgressRow
                dateKeys={activePeriod.period.dateKeys}
                label="YOU"
                tone="cyan"
                verifiedDateKeys={activePeriod.userVerifiedDateKeys}
              />
              <DailyProgressRow
                dateKeys={activePeriod.period.dateKeys}
                label="MATCH"
                tone="muted"
                verifiedDateKeys={activePeriod.opponentVerifiedDateKeys}
              />
            </View>

            <HUDBorderBox style={styles.matchNote} tone="cyan">
              <TerminalText style={styles.matchNoteText} tone="cyan" uppercase={false} variant="body">
                {getMatchNote(activePeriod, weeklyGoal)}
              </TerminalText>
            </HUDBorderBox>
          </HUDBorderBox>
        ) : isRemainderDayPhase ? (
          <HUDBorderBox glow style={styles.pactCard} tone="cyan">
            <TerminalText glow tone="cyan" variant="label">
              DAYS 29-{bonusEndDay}
            </TerminalText>
            <TerminalText style={styles.matchNoteText} tone="muted" variant="body">
              PERIOD MATCHES ARE COMPLETE. EACH VERIFIED WORKOUT ON A BONUS
              CALENDAR DAY ADDS {weeklyGoal} PRIZE DRAW {weeklyGoal === 1 ? 'ENTRY' : 'ENTRIES'} BEFORE PERFECT-MONTH 10X.
            </TerminalText>
          </HUDBorderBox>
        ) : (
          <HUDBorderBox glow style={styles.pactCard} tone="cyan">
            <TerminalText glow tone="cyan" variant="label">
              FIRST ELIGIBLE WEEK
            </TerminalText>
            <TerminalText style={styles.pendingDate} tone="text" variant="title">
              {formatDateKey(competitionEntryStartDateKey)}
            </TerminalText>
            <TerminalText style={styles.matchNoteText} tone="muted" variant="body">
              YOUR RANDOM PERIOD MATCH OPENS WHEN YOUR FIRST ELIGIBLE SCORING WEEK
              STARTS. WORKOUTS BEFORE THIS DATE CAN STILL APPEAR IN YOUR
              CALENDAR, BUT THEY DO NOT COUNT TOWARD THIS COMPETITION.
            </TerminalText>
          </HUDBorderBox>
        )}

        {activePeriod ? (
          <HUDBorderBox glow style={styles.forfeitCard} tone="pink">
            <View style={styles.forfeitHeader}>
              <TerminalText glow tone="pink" variant="micro">
                BONUS
              </TerminalText>
              <TerminalText glow tone="pink" variant="label">
                MAKE-UP BONUS
              </TerminalText>
            </View>
            <TerminalText style={styles.forfeitCopy} tone="text" uppercase={false} variant="body">
              If you both hit the Weekly Goal, you each earn 2x. If your matched
              player misses, one extra verified workout upgrades your week to 3x.
              The 3x upgrade is automatic when your goal already uses every available day.
            </TerminalText>
            <View style={styles.claimRow}>
              <TerminalText tone="muted" variant="micro">
                STATUS
              </TerminalText>
              <TerminalText glow style={styles.claimValue} tone="pink" variant="body">
                {bonusStatus}
              </TerminalText>
            </View>
          </HUDBorderBox>
        ) : null}

        <CyberButtonOutline
          label="VIEW GYM COMPETITION ->"
          onPress={() => router.push('/squad/gym')}
          style={styles.gymButton}
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function DailyProgressRow({
  dateKeys,
  label,
  tone,
  verifiedDateKeys
}: {
  dateKeys: readonly string[];
  label: string;
  tone: PlayerTone;
  verifiedDateKeys: readonly string[];
}) {
  const verifiedDates = new Set(verifiedDateKeys);

  return (
    <View style={styles.dailyRow}>
      <TerminalText style={styles.dailyLabel} tone={tone} variant="micro">
        {label}
      </TerminalText>
      <View style={styles.dailyCells}>
        {dateKeys.map((dateKey) => {
          const verified = verifiedDates.has(dateKey);

          return (
            <View
              accessibilityLabel={`${label}, day ${Number(dateKey.slice(-2))}, ${verified ? 'verified' : 'not verified'}`}
              key={`${label}-${dateKey}`}
              style={[
                styles.dailyCell,
                verified
                  ? tone === 'muted'
                    ? styles.dailyCellMuted
                    : styles.dailyCellCyan
                  : styles.dailyCellOpen
              ]}
            >
              <TerminalText glow={verified} tone={verified ? tone : 'dim'} variant="micro">
                {Number(dateKey.slice(-2))}
              </TerminalText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getMatchNote(
  period: NonNullable<ReturnType<typeof useWorkoutProgress>['competition']['currentPeriod']>,
  weeklyGoal: number
) {
  if (period.availability === 'solo') {
    return `NO COMPATIBLE MATCHED PLAYER WAS AVAILABLE. HIT ${weeklyGoal} VERIFIED WORKOUT DAYS FOR THE STANDARD 1X RESULT.`;
  }

  if (period.userGoalMet && period.opponentGoalMet) {
    return `BOTH PLAYERS HIT ${weeklyGoal}. THE 2X RESULT IS SECURED WHEN THIS WEEK CLOSES.`;
  }

  if (period.userGoalMet && period.bonusWorkoutCompleted) {
    return weeklyGoal === 7
      ? 'YOUR SEVEN-DAY GOAL IS COMPLETE. 3X ACTIVATES AUTOMATICALLY IF YOUR MATCHED PLAYER MISSES.'
      : 'YOUR EXTRA VERIFIED WORKOUT IS COMPLETE. 3X IS ARMED IF YOUR MATCHED PLAYER MISSES.';
  }

  if (period.userGoalMet) {
    return `YOUR ${weeklyGoal}-DAY GOAL IS COMPLETE. ADD ONE MORE VERIFIED WORKOUT TO ARM 3X IF YOUR MATCHED PLAYER MISSES.`;
  }

  const remaining = weeklyGoal - period.userVerifiedCount;
  const deadline = formatDateKey(period.period.dateKeys.at(-1) ?? period.period.dateKeys[0]);
  const opponentProgress = Math.min(period.opponentVerifiedCount, weeklyGoal);

  return `Complete ${remaining} more verified ${remaining === 1 ? 'workout' : 'workouts'} by ${deadline}. Your matched player is at ${opponentProgress}/${weeklyGoal}. ${period.opponentGoalMet ? 'Hit your goal to secure 2x with them.' : 'The 2x bonus remains available if you both hit the goal.'}`;
}

function getBonusStatus(
  period: NonNullable<ReturnType<typeof useWorkoutProgress>['competition']['currentPeriod']>,
  weeklyGoal: number
) {
  if (period.userGoalMet && period.opponentGoalMet) {
    return '2X SECURED';
  }

  if (period.userGoalMet && period.bonusWorkoutCompleted) {
    return weeklyGoal === 7 ? '3X AUTO-ARMED' : '3X ARMED';
  }

  if (period.userGoalMet) {
    return weeklyGoal === 7 ? 'WAITING ON MATCH' : 'EXTRA WORKOUT AVAILABLE';
  }

  return `${weeklyGoal - period.userVerifiedCount} TO GO`;
}

function getInitials(alias: string) {
  return alias
    .split(/[_\s]+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function PlayerBlock({
  imageUri,
  initials,
  label,
  progress,
  tone
}: {
  imageUri?: string | null;
  initials: string;
  label: string;
  progress: string;
  tone: PlayerTone;
}) {
  const isMuted = tone === 'muted';

  return (
    <View style={styles.playerBlock}>
      {imageUri ? (
        <ProfileAvatar imageUri={imageUri} initials={initials} size={50} />
      ) : (
        <View style={[styles.playerAvatar, isMuted ? styles.playerAvatarMuted : styles.playerAvatarCyan]}>
          <TerminalText style={isMuted ? styles.playerInitialsLight : styles.playerInitialsDark} tone="text" variant="button">
            {initials}
          </TerminalText>
        </View>
      )}
      <TerminalText style={styles.playerLabel} tone="text" variant="body">
        {label}
      </TerminalText>
      <TerminalText glow style={styles.playerProgress} tone={tone} variant="micro">
        {progress}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.background
  },
  header: {
    marginBottom: spacing.lg
  },
  title: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.display
  },
  pactCard: {
    marginBottom: spacing.lg,
    padding: 18
  },
  pendingDate: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    fontFamily: fontFamilies.display
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  playerBlock: {
    flex: 1,
    alignItems: 'center'
  },
  playerAvatar: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14
  },
  playerAvatarCyan: {
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  playerAvatarMuted: {
    borderWidth: 1,
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelSoft,
    ...cyberGlow.muted
  },
  playerInitialsDark: {
    color: colors.textOnPrimary,
    fontFamily: fontFamilies.display
  },
  playerInitialsLight: {
    color: colors.text,
    fontFamily: fontFamilies.display
  },
  playerLabel: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.terminal
  },
  playerProgress: {
    marginTop: 2,
    fontFamily: fontFamilies.display
  },
  vsText: {
    fontFamily: fontFamilies.display
  },
  matchNote: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 14
  },
  matchNoteText: {
    fontFamily: fontFamilies.body,
    textAlign: 'center'
  },
  dailyProgress: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSubtle
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  dailyLabel: {
    width: 42,
    fontFamily: fontFamilies.terminal
  },
  dailyCells: {
    flex: 1,
    flexDirection: 'row',
    gap: 4
  },
  dailyCell: {
    flex: 1,
    minWidth: 0,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 6
  },
  dailyCellOpen: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelAlpha45
  },
  dailyCellCyan: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  dailyCellMuted: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.surfaceMutedGlow
  },
  forfeitCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  forfeitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  forfeitCopy: {
    fontFamily: fontFamilies.body
  },
  claimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: 13
  },
  claimValue: {
    fontFamily: fontFamilies.display,
    textAlign: 'right'
  },
  gymButton: {
    marginTop: spacing.lg
  },
});
