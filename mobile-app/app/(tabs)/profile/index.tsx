import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AuthStatusNotice } from '@/components/auth';
import {
  ScreenScrollView,
  CyberButtonOutline,
  HUDBorderBox,
  ScreenContainer,
  TerminalText
} from '@/components/cyber';
import { CompactTextButton } from '@/components/onboarding';
import { ProfileAvatar } from '@/components/profileAvatar';
import { SponsorRail as SponsorBanner } from '@/components/sponsor';
import { isDemoVerificationEnabled } from '@/config/demoVerification';
import { colors, componentSizes, fontFamilies, interactionStates, spacing } from '@/constants/theme';
import { useCurrentUserPayout } from '@/data/appDataHooks';
import { getPublicInitials } from '@/domain/profile';
import { useProfileImagePicker } from '@/hooks/useProfileImagePicker';
import { useAuth } from '@/state/auth';
import {
  getVerificationPreference,
  hasSubmittedCreatorApplication,
  type VerificationPreference
} from '@/state/onboardingPreferences';
import { useProfile } from '@/state/profile';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useWorkoutProgress } from '@/state/workoutProgress';
import { useDemoEnrollment } from '@/state/demoEnrollment';

type ProfileStat = {
  accent: 'cyan' | 'green' | 'pink';
  label: string;
  value: string;
};

type SettingsRow = {
  route?: Href;
  status?: string;
  subtitle: string;
  title: string;
  tone: 'cyan' | 'green' | 'muted';
};

type SettingsGroups = {
  competition: readonly SettingsRow[];
  legal: readonly SettingsRow[];
  partnerships: readonly SettingsRow[];
};

function getSettingsRows(
  creatorApplicationSubmitted: boolean,
  verificationSourceLabel: string,
  hasPayoutClaim: boolean
): SettingsGroups {
  return {
    competition: [
      {
        title: 'WORKOUT VERIFICATION',
        subtitle: verificationSourceLabel,
        status: 'DEFAULT',
        tone: 'muted',
        route: '/verification?source=profile' as Href
      },
      {
        title: 'WORKOUT CALENDAR',
        subtitle: 'VERIFIED DAYS, PERSONAL STREAKS AND WORKOUT LOGS',
        tone: 'cyan',
        route: '/calendar' as Href
      },
      {
        title: 'HOW GOGYMGO WORKS',
        subtitle: 'GOALS, PERIOD MATCHES AND PRIZE DRAW ENTRIES',
        tone: 'cyan',
        route: '/how-it-works?from=profile' as Href
      },
      {
        title: 'HYPERWALLET PAYOUT ACCOUNT',
        subtitle: hasPayoutClaim
          ? 'CONNECT A BANK ACCOUNT TO RECEIVE YOUR PRIZE'
          : 'ONLY NEEDED IF YOU ARE SELECTED FOR A PAYOUT',
        status: hasPayoutClaim ? 'ACTION REQUIRED' : 'NOT NEEDED',
        tone: hasPayoutClaim ? 'green' : 'muted',
        route: '/profile/payout' as Href
      },
    ],
    partnerships: [
      {
        title: 'CREATOR WORKOUTS',
        subtitle: 'FOLLOW A CREATOR OR START YOUR OWN WORKOUT',
        tone: 'cyan',
        route: '/workouts?source=profile'
      },
      {
        title: 'APPLY AS A CREATOR',
        subtitle: creatorApplicationSubmitted
          ? 'CREATOR INTEREST RECORDED'
          : 'SUBMIT LOCAL FOLLOW-ALONG WORKOUTS',
        status: creatorApplicationSubmitted ? 'SUBMITTED' : undefined,
        tone: creatorApplicationSubmitted ? 'green' : 'cyan',
        route: '/creator/apply?source=profile' as Href
      },
      {
        title: 'APPLY AS A SPONSOR',
        subtitle: 'FUND A TARGETED REGIONAL CAMPAIGN',
        tone: 'cyan',
        route: '/sponsor/apply'
      },
      {
        title: 'REGISTER A GYM',
        subtitle: 'REQUEST A GOGYMGO QR CODE FOR YOUR LOCATION',
        tone: 'cyan',
        route: '/gym/register'
      }
    ],
    legal: [
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
        tone: 'muted',
        route: '/biometric-camera-consent' as Href
      }
    ]
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { signOutUser, user } = useAuth();
  const { publicName, roles } = useProfile();
  const { demoEnrollment } = useDemoEnrollment();
  const { competitionRegion, regionVerification } = useCompetitionRegion();
  const publicInitials = getPublicInitials(publicName);
  const {
    currentStreak,
    remindersEnabled,
    setCompetitionRemindersEnabled,
    totalEntries,
    verifiedSessionCount
  } = useWorkoutProgress();
  const [creatorApplicationSubmitted, setCreatorApplicationSubmitted] = useState(false);
  const [verificationPreference, setVerificationPreference] =
    useState<VerificationPreference>({
      method: 'heartRate',
      sourceKey: 'heartRateDevice',
      sourceLabel: 'HEART-RATE DEVICE'
    });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const [showPartnerTools, setShowPartnerTools] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string>();
  const {
    chooseProfileImage,
    clearProfileImage,
    isPickingImage,
    profileImageMessage,
    profileImageUri
  } = useProfileImagePicker();
  const profileStats: readonly ProfileStat[] = [
    { value: String(currentStreak), label: 'PERSONAL STREAK', accent: 'cyan' },
    { value: String(verifiedSessionCount), label: 'VERIFIED', accent: 'green' },
    {
      value: String(totalEntries),
      label: isDemoVerificationEnabled
        ? demoEnrollment
          ? 'DEMO ENROLLED // NO PRIZES'
          : 'DEMO // NOT ENROLLED'
        : 'PRIZE DRAW ENTRIES',
      accent: 'pink'
    }
  ];
  const { data: payoutClaim } = useCurrentUserPayout(user?.uid);
  const settingsGroups = getSettingsRows(
    creatorApplicationSubmitted,
    verificationPreference.sourceLabel,
    Boolean(payoutClaim)
  );
  const providerLabel = formatProviderLabel(user?.providerIds ?? []);
  const isOperator = roles.some((role) =>
    ['admin', 'fraud_operator', 'operator'].includes(role)
  );

  useEffect(() => {
    let mounted = true;

    if (!user) {
      return () => {
        mounted = false;
      };
    }

    void Promise.all([
      hasSubmittedCreatorApplication(user.uid),
      getVerificationPreference(user.uid)
    ]).then(([submitted, preference]) => {
      if (mounted) {
        setCreatorApplicationSubmitted(submitted);
        setVerificationPreference(preference);
      }
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  async function performSignOut() {
    setSigningOut(true);
    setSignOutError(undefined);
    try {
      await signOutUser();
      router.replace('/');
    } catch {
      setSignOutError('SIGN-OUT COULD NOT BE COMPLETED. TRY AGAIN.');
    } finally {
      setSigningOut(false);
    }
  }

  async function updateNotifications(enabled: boolean) {
    setNotificationBusy(true);
    setNotificationMessage(undefined);
    try {
      const updated = await setCompetitionRemindersEnabled(enabled);

      if (!updated) {
        setNotificationMessage(
          enabled
            ? 'NOTIFICATION PERMISSION IS OFF. ENABLE IT IN YOUR DEVICE SETTINGS, THEN TRY AGAIN.'
            : 'REMINDERS COULD NOT BE UPDATED. TRY AGAIN.'
        );
      }
    } finally {
      setNotificationBusy(false);
    }
  }

  return (
    <ScreenContainer>
      <SponsorBanner />
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <ProfileAvatar
            imageUri={profileImageUri}
            initials={publicInitials}
            showStatus={Boolean(user?.emailVerified)}
          />
          <TerminalText glow style={styles.profileName} tone="cyan" variant="title">
            {publicName}
          </TerminalText>
          <CompactTextButton
            label="EDIT ALIAS"
            onPress={() => router.push('/identity?source=profile' as Href)}
          />
          <View style={styles.profileImageActions}>
            <CyberButtonOutline
              disabled={isPickingImage}
              label={isPickingImage ? 'PREPARING...' : profileImageUri ? 'CHANGE PICTURE' : 'ADD PICTURE'}
              onPress={chooseProfileImage}
              style={styles.profileImageButton}
            />
            {profileImageUri ? (
              <CyberButtonOutline
                label="REMOVE"
                onPress={clearProfileImage}
                style={styles.profileImageButton}
                tone="red"
              />
            ) : null}
          </View>
          {profileImageMessage ? (
            <TerminalText style={styles.profileImageMessage} tone="muted" variant="caption">
              {profileImageMessage}
            </TerminalText>
          ) : null}
        </View>

        <HUDBorderBox style={styles.accountCard} tone="cyan">
          <TerminalText tone="dim" variant="label">
            ACCOUNT SECURITY
          </TerminalText>
          <View style={styles.accountRow}>
            <View style={styles.profileImageCopy}>
              <TerminalText tone="text" uppercase={false} variant="body">
                {user?.email ?? 'ACCOUNT EMAIL UNAVAILABLE'}
              </TerminalText>
              <TerminalText tone="muted" variant="micro">
                {user
                  ? `${providerLabel} // ${user.emailVerified ? 'VERIFIED' : 'EMAIL CHECK REQUIRED'}`
                  : 'ACCOUNT DETAILS APPEAR AFTER SIGN IN'}
              </TerminalText>
            </View>
          </View>
          {user && !user.emailVerified ? (
            <CyberButtonOutline
              label="VERIFY EMAIL ->"
              onPress={() => router.push('/verify-email?next=profile' as Href)}
              style={styles.accountAction}
              tone="amber"
            />
          ) : null}
        </HUDBorderBox>

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

        <HUDBorderBox style={styles.regionCard} tone="cyan">
          <View style={styles.regionCopy}>
            <TerminalText tone="dim" variant="label">
              COMPETITION REGION
            </TerminalText>
            <TerminalText glow tone="cyan" variant="body">
              {competitionRegion.label}
            </TerminalText>
            <TerminalText tone="amber" variant="caption">
              {regionVerification
                ? `SERVER REVIEW // ${regionVerification.status.toUpperCase()}`
                : 'BC REGION SUBMISSION REQUIRED'}
            </TerminalText>
          </View>
          <CyberButtonOutline
            label={regionVerification?.status === 'approved' ? 'VIEW' : 'CHECK STATUS'}
            onPress={() => router.push('/region?source=profile' as Href)}
            style={styles.regionButton}
          />
        </HUDBorderBox>

        {isOperator ? (
          <HUDBorderBox style={styles.regionCard} tone="green">
            <View style={styles.regionCopy}>
              <TerminalText tone="green" variant="label">
                OPERATOR TOOLS
              </TerminalText>
              <TerminalText tone="muted" variant="caption">
                APPROVE OR REJECT PENDING BC DEMO REGION SUBMISSIONS
              </TerminalText>
            </View>
            <CyberButtonOutline
              label="OPEN QUEUE"
              onPress={() => router.push('/profile/region-reviews' as Href)}
              style={styles.regionButton}
            />
          </HUDBorderBox>
        ) : null}

        <TerminalText style={styles.sectionLabel} tone="dim" variant="label">
          COMPETITION
        </TerminalText>
        <HUDBorderBox style={[styles.settingsCard, styles.settingsGroup]} tone="muted">
          {settingsGroups.competition.map((row) => (
            <SettingsItem key={row.title} row={row} />
          ))}
        </HUDBorderBox>

        <HUDBorderBox
          glow={remindersEnabled}
          style={styles.notificationCard}
          tone={remindersEnabled ? 'cyan' : 'muted'}
        >
          <View style={styles.notificationCopy}>
            <TerminalText glow={remindersEnabled} tone={remindersEnabled ? 'cyan' : 'text'} variant="body">
              COMPETITION REMINDERS
            </TerminalText>
            <TerminalText tone="muted" variant="caption">
              WEEKLY GOAL, PERIOD MATCH AND BONUS DAY ALERTS
            </TerminalText>
            <TerminalText tone={remindersEnabled ? 'green' : 'dim'} variant="micro">
              {remindersEnabled ? 'ENABLED ON THIS DEVICE' : 'OFF'}
            </TerminalText>
          </View>
          <Switch
            accessibilityLabel="Competition reminders"
            disabled={notificationBusy}
            onValueChange={(enabled) => void updateNotifications(enabled)}
            thumbColor={remindersEnabled ? colors.cyan : colors.dim}
            trackColor={{ false: colors.panelSoft, true: colors.surfaceCyanActive }}
            value={remindersEnabled}
          />
        </HUDBorderBox>
        {notificationMessage ? (
          <TerminalText style={styles.notificationMessage} tone="amber" variant="caption">
            {notificationMessage}
          </TerminalText>
        ) : null}

        <CyberButtonOutline
          label={showPartnerTools ? 'HIDE PARTNER OPTIONS' : 'PARTNER WITH GOGYMGO'}
          onPress={() => setShowPartnerTools((current) => !current)}
          style={styles.partnerToggle}
        />
        {showPartnerTools ? (
          <HUDBorderBox style={[styles.settingsCard, styles.settingsGroup]} tone="cyan">
            {settingsGroups.partnerships.map((row) => (
              <SettingsItem key={row.title} row={row} />
            ))}
          </HUDBorderBox>
        ) : null}

        <TerminalText style={styles.sectionLabel} tone="dim" variant="label">
          LEGAL + PRIVACY
        </TerminalText>
        <HUDBorderBox style={styles.settingsCard} tone="muted">
          {settingsGroups.legal.map((row) => (
            <SettingsItem key={row.title} row={row} />
          ))}
        </HUDBorderBox>

        {signOutError ? <AuthStatusNotice message={signOutError} tone="red" /> : null}
        <CyberButtonOutline
          disabled={signingOut}
          label={signingOut ? 'SIGNING OUT...' : 'SIGN OUT'}
          onPress={performSignOut}
          style={styles.signOutButton}
          tone="red"
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function formatProviderLabel(providerIds: readonly string[]) {
  const labels = providerIds.map((providerId) => {
    if (providerId === 'password') {
      return 'EMAIL';
    }
    if (providerId === 'google.com') {
      return 'GOOGLE';
    }
    if (providerId === 'apple.com') {
      return 'APPLE';
    }
    return providerId.toUpperCase();
  });

  return labels.length > 0 ? labels.join(' + ') : 'FIREBASE';
}

function SettingsItem({ row }: { row: SettingsRow }) {
  const router = useRouter();
  const isPressable = Boolean(row.route);
  const statusTone = row.tone;

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
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: componentSizes.tabScreenBottomInset,
    backgroundColor: colors.background
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 22
  },
  profileName: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.display
  },
  accountCard: {
    gap: spacing.sm,
    marginBottom: 14,
    padding: spacing.lg
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  profileImageCopy: {
    gap: spacing.xs
  },
  profileImageButton: {
    flex: 1,
    minHeight: 44
  },
  profileImageActions: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md
  },
  profileImageMessage: {
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  accountAction: {
    marginTop: spacing.xs
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
  regionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: 14,
    padding: spacing.lg
  },
  regionCopy: {
    flex: 1,
    gap: spacing.xs
  },
  regionButton: {
    width: 112,
    minHeight: 44
  },
  settingsCard: {
    overflow: 'hidden',
    padding: 0
  },
  settingsGroup: {
    marginBottom: spacing.lg
  },
  sectionLabel: {
    marginBottom: spacing.sm,
    marginLeft: spacing.xs
  },
  partnerToggle: {
    marginBottom: spacing.lg
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg
  },
  notificationCopy: {
    flex: 1,
    gap: spacing.xs
  },
  notificationMessage: {
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteAlpha05,
    ...interactionStates.webFocus
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
  pressed: {
    ...interactionStates.pressed
  }
});
