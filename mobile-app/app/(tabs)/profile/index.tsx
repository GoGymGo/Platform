import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { colors, cyberGlow, fontFamilies, radii, spacing } from '@/constants/theme';

type IdentityMode = 'private' | 'alias' | 'real';

type ProfileStat = {
  accent: 'cyan' | 'pink';
  label: string;
  value: string;
};

type SettingsRow = {
  route?: Href;
  status?: string;
  subtitle: string;
  title: string;
  tone: 'cyan' | 'pink' | 'muted';
};

const profileStats: readonly ProfileStat[] = [
  { value: '0', label: 'DAY STREAK', accent: 'cyan' },
  { value: '0', label: 'VERIFIED', accent: 'cyan' },
  { value: '1', label: 'PRIZE DRAW ENTRY', accent: 'pink' }
];

const settingsRows: readonly SettingsRow[] = [
  {
    title: 'PAYOUT VERIFICATION',
    subtitle: 'ONLY NEEDED IF YOU WIN OR RECEIVE CREATOR PAYOUTS',
    status: 'LATER',
    tone: 'muted'
  },
  {
    title: 'WORKOUT VERIFICATION',
    subtitle: 'NO DEVICE CONNECTED YET',
    status: 'SET UP',
    tone: 'muted',
    route: '/verification'
  },
  {
    title: 'CREATOR WORKOUTS',
    subtitle: 'TRAIN SOLO OR FOLLOW LOCAL CREATOR WORKOUTS',
    tone: 'cyan',
    route: '/workouts'
  },
  {
    title: 'CREATOR STATUS',
    subtitle: 'APPLY TO SUBMIT LOCAL WORKOUTS',
    status: 'NOT APPLIED',
    tone: 'pink',
    route: '/creator/apply'
  },
  {
    title: 'NOTIFICATIONS',
    subtitle: 'PINGS, PACTS, PRIZE DRAW RESULTS // NOT SET',
    tone: 'muted'
  },
  {
    title: 'PRIVACY POLICY',
    subtitle: 'DATA RIGHTS // US + CANADA',
    tone: 'muted',
    route: '/privacy-policy' as Href
  },
  {
    title: 'TERMS OF SERVICE',
    subtitle: 'PRIZE DRAW RULES // VERIFICATION TERMS',
    tone: 'muted',
    route: '/terms-of-service' as Href
  },
  {
    title: 'BIOMETRIC / CAMERA CONSENT',
    subtitle: 'LOCAL CHECKS // NO IMAGERY STORED',
    tone: 'cyan',
    route: '/biometric-camera-consent' as Href
  }
];

export default function ProfileScreen() {
  const router = useRouter();
  const [identityMode, setIdentityMode] = useState<IdentityMode>('private');

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <TerminalText glow style={styles.profileAvatarText} tone="cyan" variant="value">
              GR
            </TerminalText>
          </View>
          <TerminalText glow style={styles.profileName} tone="cyan" variant="title">
            GHOST_RUNNER
          </TerminalText>
          <HUDBorderBox style={styles.profileTierBadge} tone="cyan">
            <TerminalText glow tone="cyan" variant="micro">
              NEW MEMBER // TORONTO
            </TerminalText>
          </HUDBorderBox>
        </View>

        <View style={styles.statsRow}>
          {profileStats.map((stat) => (
            <HUDBorderBox key={stat.label} style={styles.statCard} tone="muted">
              <TerminalText
                glow
                style={styles.statValue}
                tone={stat.accent}
                variant="value"
              >
                {stat.value}
              </TerminalText>
              <TerminalText style={styles.statLabel} tone="muted" variant="micro">
                {stat.label}
              </TerminalText>
            </HUDBorderBox>
          ))}
        </View>

        <HUDBorderBox style={styles.identityCard} tone="cyan">
          <TerminalText tone="dim" variant="label">
            PUBLIC IDENTITY
          </TerminalText>
          <View style={styles.segmentGroup}>
            <SegmentButton
              active={identityMode === 'private'}
              label="PRIVATE"
              onPress={() => setIdentityMode('private')}
            />
            <SegmentButton
              active={identityMode === 'alias'}
              label="ALIAS"
              onPress={() => setIdentityMode('alias')}
            />
            <SegmentButton
              active={identityMode === 'real'}
              label="REAL"
              onPress={() => setIdentityMode('real')}
            />
          </View>
          <TerminalText style={styles.identityHelp} tone="muted" variant="body">
            CONTROLS LEADERBOARDS, PAIRINGS & WINNER POSTS. PAYOUT
            VERIFICATION STAYS PRIVATE.
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.settingsCard} tone="muted">
          {settingsRows.map((row) => (
            <SettingsItem key={row.title} row={row} />
          ))}
        </HUDBorderBox>

        <CyberButtonOutline
          label="SIGN OUT"
          onPress={() => router.replace('/welcome')}
          style={styles.signOutButton}
          tone="pink"
        />
        <CyberButtonOutline
          label="BACK"
          onPress={() => router.push('/home')}
          style={styles.backButton}
        />
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

function SegmentButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segmentButton, active ? styles.segmentButtonActive : styles.segmentButtonIdle]}
    >
      <TerminalText glow={active} tone={active ? 'cyan' : 'dim'} variant="micro">
        {label}
      </TerminalText>
    </Pressable>
  );
}

function SettingsItem({ row }: { row: SettingsRow }) {
  const router = useRouter();
  const isPressable = Boolean(row.route);
  const statusTone = row.tone === 'pink' ? 'pink' : 'cyan';

  return (
    <Pressable
      accessibilityRole={isPressable ? 'button' : 'text'}
      disabled={!isPressable}
      onPress={() => {
        if (row.route) {
          router.push(row.route);
        }
      }}
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && isPressable ? styles.pressed : null
      ]}
    >
      <View style={styles.settingsCopy}>
        <TerminalText style={styles.settingsTitle} tone="text" variant="body">
          {row.title}
        </TerminalText>
        <TerminalText tone="muted" uppercase={false} variant="body">
          {row.subtitle}
        </TerminalText>
      </View>
      {row.status ? (
        <HUDBorderBox style={styles.statusBadge} tone={statusTone}>
          <TerminalText glow={row.tone !== 'muted'} tone={statusTone} variant="micro">
            {row.status}
          </TerminalText>
        </HUDBorderBox>
      ) : (
        <TerminalText tone="dim" variant="button">
          -&gt;
        </TerminalText>
      )}
    </Pressable>
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
    backgroundColor: colors.surfacePinkSoft
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.background
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 22
  },
  profileAvatar: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: 24,
    backgroundColor: colors.borderCyanSubtle,
    ...cyberGlow.cyan
  },
  profileAvatarText: {
    fontFamily: fontFamilies.display
  },
  profileName: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.display
  },
  profileTierBadge: {
    width: 'auto',
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 14
  },
  statValue: {
    fontFamily: fontFamilies.display
  },
  statLabel: {
    marginTop: 2,
    fontFamily: fontFamilies.terminal,
    textAlign: 'center'
  },
  identityCard: {
    marginBottom: 14,
    padding: spacing.lg
  },
  segmentGroup: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 11,
    padding: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.blackAlpha25
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 9
  },
  segmentButtonActive: {
    borderColor: colors.borderCyanHeavy,
    backgroundColor: colors.surfaceCyanProgress,
    ...cyberGlow.cyan
  },
  segmentButtonIdle: {
    borderColor: colors.transparent
  },
  identityHelp: {
    marginTop: 10,
    fontFamily: fontFamilies.terminal
  },
  settingsCard: {
    overflow: 'hidden',
    padding: 0
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteAlpha05
  },
  settingsCopy: {
    flex: 1
  },
  settingsTitle: {
    fontFamily: fontFamilies.display
  },
  statusBadge: {
    width: 'auto',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6
  },
  signOutButton: {
    marginTop: spacing.lg
  },
  backButton: {
    marginTop: 10
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
