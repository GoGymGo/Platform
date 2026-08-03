import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';

type DemoTone = 'amber' | 'cyan' | 'green' | 'pink';
type DemoTab = 'HOME' | 'CALENDAR' | 'TRAIN' | 'COMPETE' | 'ME';

type DemoScreenDefinition = {
  action: string;
  body: string;
  eyebrow: string;
  feature: {
    body: string;
    label: string;
    title: string;
  };
  id: string;
  items: readonly {
    label: string;
    state: string;
    value: string;
  }[];
  stats: readonly {
    label: string;
    value: string;
  }[];
  tab: DemoTab;
  title: string;
  tone: DemoTone;
};

const demoScreens: readonly DemoScreenDefinition[] = [
  {
    id: 'home',
    eyebrow: 'ACCOUNT READY // VANCOUVER',
    title: 'HOME',
    body: 'Your next unfinished action, current Weekly Goal and progress all meet on one screen.',
    tone: 'green',
    tab: 'HOME',
    stats: [
      { label: 'WEEKLY GOAL', value: '4 DAYS' },
      { label: 'VERIFIED', value: '2 / 4' },
      { label: 'STREAK', value: '3 WEEKS' }
    ],
    feature: {
      label: 'NEXT ACTION',
      title: 'START TODAY\'S SESSION',
      body: 'Complete two more verified workouts this week to hit your goal.'
    },
    items: [
      { label: 'WORKOUT CALENDAR', value: '2 DAYS COMPLETE', state: 'OPEN' },
      { label: 'WEEKLY CHALLENGE', value: 'CORE_FOUR // ACTIVE', state: 'VIEW' }
    ],
    action: 'START WORKOUT'
  },
  {
    id: 'calendar',
    eyebrow: 'AUGUST 2026 // WORKOUT LOG',
    title: 'WORKOUT CALENDAR',
    body: 'See verified sessions, personal workouts, bonus days and planned creator workouts together.',
    tone: 'cyan',
    tab: 'CALENDAR',
    stats: [
      { label: 'THIS WEEK', value: '2 / 4' },
      { label: 'PERSONAL STREAK', value: '3' }
    ],
    feature: {
      label: 'TODAY // AUG 02',
      title: 'VERIFIED WORKOUT',
      body: 'Harbour View Condo Gym // 36 minutes // counted toward your Weekly Goal.'
    },
    items: [
      { label: 'MON 03', value: 'UPPER BODY CIRCUIT', state: 'PLANNED' },
      { label: 'THU 06', value: 'PERSONAL WORKOUT', state: 'LOG' }
    ],
    action: 'LOG PERSONAL WORKOUT'
  },
  {
    id: 'train',
    eyebrow: 'VERIFIED TRAINING',
    title: 'TRAIN',
    body: 'Start a workout with the verification method available for your gym and region.',
    tone: 'cyan',
    tab: 'TRAIN',
    stats: [
      { label: 'MINIMUM', value: '30:00' },
      { label: 'METHODS READY', value: '2' }
    ],
    feature: {
      label: 'READY TO TRAIN',
      title: 'SCAN YOUR GYM QR',
      body: 'Entry and exit scans pair with the authoritative server timer for a verified day.'
    },
    items: [
      { label: 'DEFAULT METHOD', value: 'PARTNER GYM QR', state: 'READY' },
      { label: 'CREATOR WORKOUTS', value: '8 AVAILABLE', state: 'BROWSE' }
    ],
    action: 'SCAN GYM QR'
  },
  {
    id: 'leaderboard',
    eyebrow: 'VANCOUVER // FOUR-DAY GROUP',
    title: 'LEADERBOARD',
    body: 'Compare consistency with players who chose the same Weekly Goal.',
    tone: 'cyan',
    tab: 'COMPETE',
    stats: [
      { label: 'CURRENT RANK', value: '#12' },
      { label: 'WEEKLY GOAL', value: '4' },
      { label: 'DRAW ENTRIES', value: '8' }
    ],
    feature: {
      label: 'YOUR POSITION',
      title: 'CAMERON12 // #12',
      body: 'Two verified days this week. Keep moving to climb your regional goal group.'
    },
    items: [
      { label: '#01 CORE_FOUR', value: '16 VERIFIED DAYS', state: 'LEADER' },
      { label: '#02 NEON_4', value: '15 VERIFIED DAYS', state: '+1' },
      { label: '#03 KODA_FIT', value: '15 VERIFIED DAYS', state: '+1' }
    ],
    action: 'VIEW COMPETITION GUIDE'
  },
  {
    id: 'winners-circle',
    eyebrow: 'AUDITED RESULTS // JULY',
    title: 'WINNERS CIRCLE',
    body: 'See finalized goal champions and prize-draw winners after competition review.',
    tone: 'pink',
    tab: 'COMPETE',
    stats: [
      { label: 'GOAL CHAMPIONS', value: '7' },
      { label: 'REWARD WINNERS', value: '3' }
    ],
    feature: {
      label: 'FOUR-DAY CHAMPION',
      title: 'CORE_FOUR',
      body: '16 verified days // Pacific Motion Training Kit // ready to claim.'
    },
    items: [
      { label: 'NEON_4', value: 'VOLT 25% DIGITAL REWARD', state: 'CLAIMED' },
      { label: 'KODA_FIT', value: 'NOVA SHAKER', state: 'READY' }
    ],
    action: 'VIEW ALL GOAL GROUPS'
  },
  {
    id: 'rewards',
    eyebrow: 'REGIONAL REWARD CATALOG',
    title: 'REWARDS',
    body: 'Browse the physical products and digital offers attached to your competition.',
    tone: 'pink',
    tab: 'COMPETE',
    stats: [
      { label: 'LIVE REWARDS', value: '6' },
      { label: 'BRAND PARTNERS', value: '4' }
    ],
    feature: {
      label: 'FEATURED REWARD',
      title: 'PACIFIC MOTION TRAINING KIT',
      body: 'Physical reward // ships within Canada // winner claim required.'
    },
    items: [
      { label: 'VOLT PERFORMANCE', value: '25% DIGITAL REWARD', state: 'IN STOCK' },
      { label: 'NOVA HYDRATION', value: 'LIMITED SHAKER', state: '12 LEFT' }
    ],
    action: 'VIEW BRAND TERMS'
  },
  {
    id: 'awards',
    eyebrow: 'YOUR REWARD HISTORY',
    title: 'MY AWARDS',
    body: 'Track every available, claimed and fulfilled reward in one private list.',
    tone: 'green',
    tab: 'ME',
    stats: [
      { label: 'READY TO CLAIM', value: '1' },
      { label: 'CLAIMED', value: '2' }
    ],
    feature: {
      label: 'ACTION REQUIRED',
      title: 'PACIFIC MOTION TRAINING KIT',
      body: 'Confirm the delivery details before the published claim deadline.'
    },
    items: [
      { label: 'VOLT 25% CODE', value: 'JULY COMPETITION', state: 'CLAIMED' },
      { label: 'NOVA SHAKER', value: 'JUNE COMPETITION', state: 'FULFILLED' }
    ],
    action: 'CLAIM REWARD'
  },
  {
    id: 'weekly-challenge',
    eyebrow: 'ONE-WEEK PARTNER CHALLENGE',
    title: 'WEEKLY CHALLENGE',
    body: 'Pair with an eligible friend and help each other complete your individual Weekly Goals.',
    tone: 'green',
    tab: 'HOME',
    stats: [
      { label: 'YOU', value: '2 / 4' },
      { label: 'CORE_FOUR', value: '3 / 4' }
    ],
    feature: {
      label: 'ACTIVE MATCH',
      title: 'BOTH ON TRACK',
      body: 'Hit both Weekly Goals for a 2× entry multiplier. One extra workout can unlock 3×.'
    },
    items: [
      { label: 'MON', value: 'BOTH VERIFIED', state: 'DONE' },
      { label: 'WED', value: 'PARTNER VERIFIED', state: 'YOUR TURN' }
    ],
    action: 'VIEW PAIRING OPTIONS'
  },
  {
    id: 'social',
    eyebrow: 'FRIENDS + INVITES',
    title: 'SOCIAL CHALLENGES',
    body: 'Find players by public alias, manage consent-based connections and send challenge invites.',
    tone: 'pink',
    tab: 'HOME',
    stats: [
      { label: 'FRIENDS', value: '8' },
      { label: 'OPEN INVITES', value: '2' }
    ],
    feature: {
      label: 'INCOMING REQUEST',
      title: 'NEON_4',
      body: 'Four-day Weekly Goal // Vancouver // wants to connect.'
    },
    items: [
      { label: 'CORE_FOUR', value: 'FRIEND', state: 'CHALLENGE' },
      { label: 'KODA_FIT', value: 'FRIEND', state: 'CHALLENGE' }
    ],
    action: 'SEARCH BY ALIAS'
  },
  {
    id: 'challenge-gym',
    eyebrow: 'PARTNER GYM CHALLENGE',
    title: 'CHALLENGE GYM',
    body: 'Join a gym-hosted challenge with clear eligibility, dates and progress rules.',
    tone: 'amber',
    tab: 'HOME',
    stats: [
      { label: 'ACTIVE PLAYERS', value: '84' },
      { label: 'DAYS LEFT', value: '12' }
    ],
    feature: {
      label: 'PARTNER GYM // VANCOUVER',
      title: 'AUGUST CONSISTENCY RUN',
      body: 'Complete six verified sessions here before August 31.'
    },
    items: [
      { label: 'YOUR PROGRESS', value: '3 / 6 SESSIONS', state: '50%' },
      { label: 'BONUS', value: '1 EXTRA DRAW ENTRY', state: 'LOCKED' }
    ],
    action: 'VIEW CHALLENGE RULES'
  },
  {
    id: 'profile',
    eyebrow: 'PUBLIC ALIAS // PRIVATE ACCOUNT',
    title: 'PROFILE',
    body: 'Manage the identity other players see, your competition setup and app preferences.',
    tone: 'cyan',
    tab: 'ME',
    stats: [
      { label: 'VERIFIED DAYS', value: '28' },
      { label: 'GOALS HIT', value: '6' },
      { label: 'BEST STREAK', value: '4' }
    ],
    feature: {
      label: 'CAMERON12',
      title: 'VANCOUVER // 4-DAY GOAL',
      body: 'Public alias active // email verified // competition enrollment ready.'
    },
    items: [
      { label: 'APP SETTINGS', value: 'REMINDERS ON', state: 'OPEN' },
      { label: 'LEGAL + PRIVACY', value: 'CONSENTS CURRENT', state: 'OPEN' }
    ],
    action: 'EDIT PROFILE'
  },
  {
    id: 'account-data',
    eyebrow: 'PRIVACY + ACCOUNT CONTROL',
    title: 'ACCOUNT DATA',
    body: 'Request a private data export or start a clearly confirmed account-deletion request.',
    tone: 'amber',
    tab: 'ME',
    stats: [
      { label: 'EXPORTS', value: 'PRIVATE' },
      { label: 'DELETION', value: 'CONFIRMED' }
    ],
    feature: {
      label: 'DATA EXPORT',
      title: 'DOWNLOAD YOUR ACCOUNT RECORD',
      body: 'Exports use a private, expiring download and never appear in public competition views.'
    },
    items: [
      { label: 'PROFILE + CONSENTS', value: 'INCLUDED', state: 'READY' },
      { label: 'WORKOUT + REWARD HISTORY', value: 'INCLUDED', state: 'READY' }
    ],
    action: 'REQUEST DATA EXPORT'
  }
];

const demoTabs: readonly DemoTab[] = ['HOME', 'CALENDAR', 'TRAIN', 'COMPETE', 'ME'];

export default function DemoScreen() {
  const [screenIndex, setScreenIndex] = useState(0);
  const screen = demoScreens[screenIndex];
  const isLastScreen = screenIndex === demoScreens.length - 1;
  const progress = Math.round(((screenIndex + 1) / demoScreens.length) * 100);

  function showNextScreen() {
    setScreenIndex((current) =>
      current === demoScreens.length - 1 ? 0 : current + 1
    );
  }

  return (
    <ScreenContainer>
      <View accessibilityRole="header" style={styles.demoBanner}>
        <TerminalText glow tone="pink" variant="label">
          DEMO // SAMPLE DATA // NO ACCOUNT OR BACKEND
        </TerminalText>
      </View>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <TerminalText glow tone="green" variant="label">
            MAIN APP SCREEN TOUR
          </TerminalText>
          <TerminalText glow style={styles.tourTitle} tone="cyan" variant="title">
            SEE GOGYMGO
          </TerminalText>
          <TerminalText style={styles.introCopy} tone="muted" uppercase={false} variant="body">
            Click through every main app destination one screen at a time. The
            tour uses static sample data and never opens your camera, reads
            location, creates an account or writes to GoGymGo services.
          </TerminalText>
        </View>

        <View style={styles.progressHeader}>
          <TerminalText live="polite" tone="cyan" variant="label">
            SCREEN {String(screenIndex + 1).padStart(2, '0')} / {String(demoScreens.length).padStart(2, '0')}
          </TerminalText>
          <TerminalText tone="dim" variant="micro">
            {progress}% COMPLETE
          </TerminalText>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%` as `${number}%` }
            ]}
          />
        </View>

        <HUDBorderBox glow style={styles.phone} tone={screen.tone}>
          <View style={styles.phoneStatus}>
            <TerminalText tone="dim" variant="micro">
              GOGYMGO // DEMO
            </TerminalText>
            <TerminalText glow tone={screen.tone} variant="micro">
              SAMPLE
            </TerminalText>
          </View>

          <View style={styles.screenHeading}>
            <TerminalText glow tone={screen.tone} variant="label">
              {screen.eyebrow}
            </TerminalText>
            <TerminalText glow style={styles.screenTitle} tone="cyan" variant="title">
              {screen.title}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              {screen.body}
            </TerminalText>
          </View>

          <View style={styles.stats}>
            {screen.stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <TerminalText glow style={styles.statValue} tone={screen.tone} variant="value">
                  {stat.value}
                </TerminalText>
                <TerminalText style={styles.statLabel} tone="muted" variant="micro">
                  {stat.label}
                </TerminalText>
              </View>
            ))}
          </View>

          <HUDBorderBox style={styles.feature} tone={screen.tone}>
            <TerminalText tone={screen.tone} variant="micro">
              {screen.feature.label}
            </TerminalText>
            <TerminalText glow tone="text" variant="label">
              {screen.feature.title}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              {screen.feature.body}
            </TerminalText>
          </HUDBorderBox>

          <View style={styles.itemList}>
            {screen.items.map((item) => (
              <View key={`${item.label}-${item.value}`} style={styles.itemRow}>
                <View style={styles.itemCopy}>
                  <TerminalText tone="dim" variant="micro">
                    {item.label}
                  </TerminalText>
                  <TerminalText tone="text" uppercase={false} variant="body">
                    {item.value}
                  </TerminalText>
                </View>
                <TerminalText glow tone={screen.tone} variant="micro">
                  {item.state}
                </TerminalText>
              </View>
            ))}
          </View>

          <View style={styles.sampleAction}>
            <TerminalText glow tone={screen.tone} variant="button">
              {screen.action} →
            </TerminalText>
          </View>

          <View style={styles.tabBar}>
            {demoTabs.map((tab) => (
              <View key={tab} style={styles.tab}>
                <View
                  style={[
                    styles.tabDot,
                    tab === screen.tab ? styles.tabDotActive : null
                  ]}
                />
                <TerminalText
                  glow={tab === screen.tab}
                  style={styles.tabLabel}
                  tone={tab === screen.tab ? 'cyan' : 'dim'}
                  variant="micro"
                >
                  {tab}
                </TerminalText>
              </View>
            ))}
          </View>
        </HUDBorderBox>

        <CyberButtonPrimary
          accessibilityHint={
            isLastScreen
              ? 'Return to the first demo screen'
              : `Show ${demoScreens[screenIndex + 1].title}`
          }
          label={isLastScreen ? 'BACK TO FIRST SCREEN ->' : 'NEXT SCREEN ->'}
          onPress={showNextScreen}
          tone={isLastScreen ? 'green' : 'cyan'}
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  demoBanner: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPinkHeavy,
    backgroundColor: colors.surfacePinkSoft
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  intro: {
    alignItems: 'center',
    gap: spacing.sm
  },
  tourTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    textAlign: 'center'
  },
  introCopy: {
    maxWidth: 430,
    textAlign: 'center'
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  progressTrack: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.whiteAlpha08
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.cyan
  },
  phone: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    minHeight: 620,
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: 24,
    backgroundColor: colors.panelAlpha84
  },
  phoneStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  screenHeading: {
    gap: spacing.sm
  },
  screenTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.titleXl
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  stat: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderCyanSubtle,
    backgroundColor: colors.surfaceCyanGhost
  },
  statLabel: {
    minHeight: 36
  },
  statValue: {
    fontSize: fontSizes.titleSmall
  },
  feature: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  itemList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted
  },
  itemRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted
  },
  itemCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  sampleAction: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderCyanButton,
    backgroundColor: colors.surfaceCyanSoft
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanSubtle
  },
  tab: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderMuted
  },
  tabDotActive: {
    backgroundColor: colors.cyan
  },
  tabLabel: {
    fontSize: 9,
    textAlign: 'center'
  }
});
