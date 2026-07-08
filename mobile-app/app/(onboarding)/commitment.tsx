import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, spacing, fontSizes } from '@/constants/theme';

const dayOptions = [1, 2, 3, 4, 5, 6, 7] as const;

export default function CommitmentScreen() {
  const router = useRouter();
  const [days, setDays] = useState(4);
  const weeksInCommitment = 4;
  const perfectMonthMultiplier = 10;
  const monthlyBaseEntries = days * weeksInCommitment;
  const perfectMonthEntries = monthlyBaseEntries * perfectMonthMultiplier;

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <TerminalText tone="dim" variant="label">
            STEP 04 / 04
          </TerminalText>
          <TerminalText glow tone="cyan" variant="label">
            COMMITMENT
          </TerminalText>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          LOCK YOUR MONTH
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" variant="body">
          COMMIT HOW MANY DAYS YOU PLAN TO BE ACTIVE EACH WEEK FOR THE MONTH.
          ENTRIES IMPROVE YOUR PRIZE DRAW ODDS. LOCKS SUNDAY 11:59 PM.
        </TerminalText>

        <View style={styles.daysHeader}>
          <TerminalText glow style={styles.daysValue} tone="cyan" variant="display">
            {days}
          </TerminalText>
          <TerminalText tone="muted" variant="label">
            DAYS / WEEK
          </TerminalText>
        </View>

        <View style={styles.dayPicker}>
          {dayOptions.map((day) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: days === day }}
              key={day}
              onPress={() => setDays(day)}
              style={[
                styles.dayButton,
                days === day ? styles.dayButtonActive : styles.dayButtonIdle
              ]}
            >
              <TerminalText glow={days === day} tone={days === day ? 'cyan' : 'dim'} variant="value">
                {day}
              </TerminalText>
            </Pressable>
          ))}
        </View>

        <HUDBorderBox glow style={styles.entriesPanel} tone="pink">
          <TerminalText tone="pink" variant="label">
            PERFECT MONTH ENTRIES
          </TerminalText>
          <TerminalText glow style={styles.entriesValue} tone="pink" variant="display">
            {perfectMonthEntries}
          </TerminalText>
          <TerminalText tone="muted" variant="body">
            {days} PER WEEK X {weeksInCommitment} WEEKS = {monthlyBaseEntries} BASE ENTRIES
          </TerminalText>
          <TerminalText tone="muted" variant="body">
            HIT THE FULL MONTH TO APPLY {perfectMonthMultiplier}X = {perfectMonthEntries} PRIZE DRAW ENTRIES
          </TerminalText>
          <TerminalText tone="text" variant="micro">
            ENTRIES IMPROVE YOUR ESTIMATED PRIZE DRAW ODDS.
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.weeklyBonusPanel} tone="cyan">
          <TerminalText glow tone="cyan" variant="label">
            WEEKLY BONUS
          </TerminalText>
          <View style={styles.bonusRow}>
            <TerminalText glow style={styles.bonusMultiplier} tone="cyan" variant="title">
              2X
            </TerminalText>
            <TerminalText style={styles.bonusCopy} tone="muted" variant="body">
              IF YOU AND YOUR MATCH BOTH HIT THE WEEKLY GOAL, YOU BOTH EARN 2X
              BONUS ENTRIES.
            </TerminalText>
          </View>
          <View style={styles.bonusDivider} />
          <View style={styles.bonusRow}>
            <TerminalText glow style={styles.bonusMultiplier} tone="pink" variant="title">
              3X
            </TerminalText>
            <TerminalText style={styles.bonusCopy} tone="muted" variant="body">
              IF YOUR MATCH MISSES, COMPLETE ONE EXTRA VERIFIED WORKOUT TO EARN
              3X AND CLAIM THEIR UNEARNED BONUS ENTRIES.
            </TerminalText>
          </View>
        </HUDBorderBox>

        <HUDBorderBox style={styles.drawSummary} tone="cyan">
          <TerminalText tone="muted" variant="label">
            CURRENT PRIZE DRAW
          </TerminalText>
          <TerminalText glow style={styles.drawValue} tone="cyan" variant="body">
            $5,000 CAD // 180 WINNERS
          </TerminalText>
        </HUDBorderBox>
        <TerminalText style={styles.commitCopy} tone="muted" variant="body">
          HIT YOUR WEEKLY GOAL TO UNLOCK PRIZE DRAW ENTRIES. ENTRIES IMPROVE
          YOUR MONTHLY PRIZE DRAW ODDS.
        </TerminalText>

        <View style={styles.actions}>
          <CyberButtonOutline
            label="VIEW COMMITMENT RULES"
            onPress={() => router.push('/commitment-rules')}
          />
          <CyberButtonPrimary
            label="LOCK COMMITMENT ->"
            onPress={() => router.push('/entry-confirmed')}
          />
          <CyberButtonOutline
            label="BACK"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SponsorBanner() {
  return (
    <HUDBorderBox style={styles.sponsorBanner} tone="muted">
      <View style={styles.sponsorMark}>
        <TerminalText glow tone="pink" variant="title">
          V
        </TerminalText>
      </View>
      <View style={styles.sponsorCopy}>
        <TerminalText tone="dim" variant="micro">
          SPONSOR SIGNAL
        </TerminalText>
        <TerminalText style={styles.sponsorTitle} tone="text" variant="body">
          SPONSORED BY VOLT
        </TerminalText>
        <TerminalText tone="muted" variant="body">
          PRIZE POOL PARTNER
        </TerminalText>
      </View>
    </HUDBorderBox>
  );
}

const styles = StyleSheet.create({
  sponsorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  sponsorMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.sponsorBorder,
    borderRadius: 8,
    backgroundColor: colors.surfacePink
  },
  sponsorCopy: {
    flex: 1
  },
  sponsorTitle: {
    marginTop: 1,
    fontFamily: fontFamilies.terminal
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  progressTrack: {
    height: 3,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
    borderRadius: 2,
    backgroundColor: colors.whiteAlpha06
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cyan,
    ...cyberGlow.cyan
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    lineHeight: 34,
    textAlign: 'center'
  },
  body: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    fontFamily: fontFamilies.terminal
  },
  daysHeader: {
    alignItems: 'center',
    marginBottom: 6
  },
  daysValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.heroNumber,
    lineHeight: 68
  },
  dayPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    marginBottom: 22
  },
  dayButton: {
    width: 39,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10
  },
  dayButtonActive: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive,
    ...cyberGlow.cyan
  },
  dayButtonIdle: {
    borderColor: colors.whiteAlpha08,
    backgroundColor: colors.panelAlpha45
  },
  entriesPanel: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: 18
  },
  entriesValue: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.prize,
    lineHeight: 52
  },
  weeklyBonusPanel: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  bonusMultiplier: {
    width: 44,
    fontFamily: fontFamilies.display
  },
  bonusCopy: {
    flex: 1,
    fontFamily: fontFamilies.terminal
  },
  bonusDivider: {
    height: 1,
    backgroundColor: colors.borderCyanSubtle
  },
  drawSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg
  },
  drawValue: {
    flex: 1,
    fontFamily: fontFamilies.display,
    textAlign: 'right'
  },
  commitCopy: {
    marginBottom: spacing.md,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  actions: {
    gap: spacing.md
  }
});
