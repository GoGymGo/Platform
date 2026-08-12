import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

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
import { UserAlias } from '@/components/streakRewards';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useMyStreaks } from '@/data/appDataHooks';
import {
  useCurrentEnrollment,
  useWithdrawFromCompetition
} from '@/data/accountReadinessHooks';
import { getPublicInitials } from '@/domain/profile';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import { useProfileImagePicker } from '@/hooks/useProfileImagePicker';
import { useAuth } from '@/state/auth';
import { useProfile } from '@/state/profile';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useWorkoutProgress } from '@/state/workoutProgress';
import { clearLocalAppData } from '@/services/localAppReset';
import { clearPendingGymScan } from '@/services/pendingGymScan';

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
  preferences: readonly SettingsRow[];
  legal: readonly SettingsRow[];
};

function getSettingsRows(): SettingsGroups {
  return {
    preferences: [
      {
        title: 'HOW THE CONTEST WORKS',
        subtitle: 'GOALS, ENTRIES, RANKINGS AND REWARDS',
        tone: 'muted',
        route: '/how-it-works?from=profile' as Href
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
        subtitle: 'ACCOUNT // VERIFICATION // SERVICE TERMS',
        tone: 'muted',
        route: '/terms-of-service' as Href
      },
      {
        title: 'OFFICIAL CONTEST RULES',
        subtitle: 'ELIGIBILITY // ENTRIES // DRAW // PRIZES',
        tone: 'muted',
        route: '/official-rules' as Href
      },
      {
        title: 'ACCOUNT DATA & DELETION',
        subtitle: 'EXPORT DATA // REQUEST ACCOUNT DELETION',
        tone: 'muted',
        route: '/account-data' as Href
      }
    ]
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();
  const { signOutUser, user } = useAuth();
  const { publicName } = useProfile();
  const { data: streakSummary } = useMyStreaks();
  const currentEnrollment = useCurrentEnrollment();
  const withdrawFromCompetition = useWithdrawFromCompetition();
  const { competitionRegion, regionVerification } = useCompetitionRegion();
  const publicInitials = getPublicInitials(publicName);
  const {
    currentStreak,
    remindersEnabled,
    setCompetitionRemindersEnabled,
    totalEntries,
    verifiedSessionCount
  } = useWorkoutProgress();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const [accountActionMessage, setAccountActionMessage] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const [resettingApp, setResettingApp] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showCompetitionSettings, setShowCompetitionSettings] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string>();
  const {
    chooseProfileImage,
    clearProfileImage,
    isPickingImage,
    profileImageMessage,
    profileImageStatus,
    profileImageUri
  } = useProfileImagePicker();
  const profileStats: readonly ProfileStat[] = [
    { value: String(currentStreak), label: 'PERSONAL STREAK', accent: 'cyan' },
    { value: String(verifiedSessionCount), label: 'VERIFIED', accent: 'green' },
    {
      value: String(totalEntries),
      label: 'PRIZE DRAW ENTRIES',
      accent: 'pink'
    }
  ];
  const settingsGroups = getSettingsRows();
  const providerLabel = formatProviderLabel(user?.providerIds ?? []);

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

  async function performWithdrawal() {
    const enrollment = currentEnrollment.data;
    if (!enrollment) return;

    setAccountActionMessage(undefined);
    try {
      await withdrawFromCompetition.mutateAsync(enrollment.competitionId);
      await clearPendingGymScan();
      setConfirmWithdrawal(false);
      setAccountActionMessage(
        'WITHDRAWAL COMPLETE. CONTEST ACCESS AND PRIZE ELIGIBILITY ARE CLOSED.'
      );
    } catch {
      setAccountActionMessage('WITHDRAWAL COULD NOT BE COMPLETED. TRY AGAIN.');
    }
  }

  async function performAppReset() {
    setResettingApp(true);
    setAccountActionMessage(undefined);
    try {
      await signOutUser();
      await clearPendingGymScan();
      await clearLocalAppData();
      queryClient.clear();
      router.replace('/');
    } catch {
      setAccountActionMessage(
        'RESET FAILED. CLOSE THE APP AND TRY AGAIN.'
      );
      setResettingApp(false);
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
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.profileIdentityRow}>
            <UserAlias
              alias={publicName}
              streaks={streakSummary?.streaks}
              style={styles.profileAlias}
              textStyle={styles.profileName}
              tone="text"
              variant="title"
            />
            <ProfileAvatar
              imageUri={profileImageUri}
              initials={publicInitials}
              showStatus={Boolean(user?.emailVerified)}
            />
          </View>
          <CyberButtonOutline
            label={showProfileEditor ? 'DONE EDITING' : 'EDIT PROFILE'}
            onPress={() => setShowProfileEditor((current) => !current)}
            style={styles.editProfileButton}
          />
          {showProfileEditor ? (
            <View style={styles.profileEditor}>
              <CompactTextButton
                label="EDIT ALIAS"
                onPress={() => router.push('/identity?source=profile' as Href)}
              />
              <View style={styles.profileImageActions}>
                <CyberButtonOutline
                  disabled={isPickingImage}
                  label={
                    isPickingImage
                      ? 'PREPARING...'
                      : profileImageUri
                        ? 'CHANGE PICTURE'
                        : 'ADD PICTURE'
                  }
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
            </View>
          ) : null}
          {showProfileEditor && profileImageMessage ? (
            <TerminalText
              live="polite"
              style={styles.profileImageMessage}
              tone="muted"
              variant="caption"
            >
              {profileImageMessage}
            </TerminalText>
          ) : null}
          {showProfileEditor && profileImageStatus === 'pending_review' ? (
            <TerminalText
              live="polite"
              style={styles.profileImageMessage}
              tone="amber"
              variant="caption"
            >
              PICTURE PENDING MODERATION
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
                {user?.email ?? 'NO EMAIL ON FILE'}
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
              <TerminalText glow style={styles.statValue} tone={stat.accent} variant="value">
                {stat.value}
              </TerminalText>
              <TerminalText style={styles.statLabel} tone="muted" variant="micro">
                {stat.label}
              </TerminalText>
            </HUDBorderBox>
          ))}
        </View>

        <CyberButtonOutline
          label="FRIENDS + INVITES ->"
          onPress={() => router.push('/squad/social' as Href)}
          style={styles.sectionToggle}
        />

        <CyberButtonOutline
          label={showCompetitionSettings ? 'HIDE APP SETTINGS' : 'APP SETTINGS'}
          onPress={() => setShowCompetitionSettings((current) => !current)}
          style={styles.sectionToggle}
        />
        {showCompetitionSettings ? (
          <>
            {mobileGymVerificationAvailable ? (
            <HUDBorderBox style={styles.regionCard} tone="cyan">
              <View style={styles.regionCopy}>
                <TerminalText tone="dim" variant="label">
                  CONTEST REGION
                </TerminalText>
                <TerminalText glow tone="cyan" variant="body">
                  {competitionRegion.label}
                </TerminalText>
                <TerminalText
                  tone={regionVerification?.status === 'verified' ? 'green' : 'amber'}
                  variant="caption"
                >
                  {regionVerification
                    ? regionVerification.status === 'verified'
                      ? 'VERIFIED BY DEVICE LOCATION'
                      : 'LOCATION RECHECK REQUIRED'
                    : 'LOCATION VERIFICATION REQUIRED'}
                </TerminalText>
              </View>
              <CyberButtonOutline
                label="CHANGE"
                onPress={() => router.push('/region?source=profile' as Href)}
                style={styles.regionButton}
              />
            </HUDBorderBox>
            ) : null}

            <TerminalText style={styles.sectionLabel} tone="dim" variant="label">
              WORKOUT PREFERENCE
            </TerminalText>
            <HUDBorderBox style={[styles.settingsCard, styles.settingsGroup]} tone="muted">
              {settingsGroups.preferences.map((row) => (
                <SettingsItem key={row.title} row={row} />
              ))}
            </HUDBorderBox>

            <Pressable
              aria-checked={remindersEnabled}
              aria-disabled={notificationBusy}
              accessibilityHint="Turn Weekly Goal, Weekly Challenge and Bonus Day alerts on or off"
              accessibilityLabel="Contest reminders"
              accessibilityRole="switch"
              accessibilityState={{
                checked: remindersEnabled,
                disabled: notificationBusy
              }}
              disabled={notificationBusy}
              onPress={() => void updateNotifications(!remindersEnabled)}
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <HUDBorderBox
                glow={remindersEnabled}
                style={styles.notificationCard}
                tone={remindersEnabled ? 'cyan' : 'muted'}
              >
                <View style={styles.notificationCopy}>
                  <TerminalText
                    glow={remindersEnabled}
                    tone={remindersEnabled ? 'cyan' : 'text'}
                    variant="body"
                  >
                    CONTEST REMINDERS
                  </TerminalText>
                  <TerminalText tone="muted" variant="caption">
                    WEEKLY GOAL, WEEKLY CHALLENGE AND BONUS DAY ALERTS
                  </TerminalText>
                  <TerminalText tone={remindersEnabled ? 'green' : 'dim'} variant="micro">
                    {remindersEnabled ? 'ENABLED ON THIS DEVICE' : 'OFF'}
                  </TerminalText>
                </View>
                <Switch
                  accessible={false}
                  pointerEvents="none"
                  thumbColor={remindersEnabled ? colors.cyan : colors.dim}
                  trackColor={{
                    false: colors.panelSoft,
                    true: colors.surfaceCyanActive
                  }}
                  value={remindersEnabled}
                />
              </HUDBorderBox>
            </Pressable>
            {notificationMessage ? (
              <TerminalText
                live="assertive"
                style={styles.notificationMessage}
                tone="amber"
                uppercase={false}
                variant="caption"
              >
                {notificationMessage}
              </TerminalText>
            ) : null}
          </>
        ) : null}

        <CyberButtonOutline
          label={showLegal ? 'HIDE LEGAL & PRIVACY' : 'LEGAL & PRIVACY'}
          onPress={() => setShowLegal((current) => !current)}
        />
        {showLegal ? (
          <HUDBorderBox style={[styles.settingsCard, styles.legalCard]} tone="muted">
            {settingsGroups.legal.map((row) => (
              <SettingsItem key={row.title} row={row} />
            ))}
          </HUDBorderBox>
        ) : null}

        <TerminalText style={styles.sectionLabel} tone="dim" variant="label">
          ACCOUNT & CONTEST
        </TerminalText>
        {currentEnrollment.data ? (
          <HUDBorderBox style={styles.accountActionCard} tone="red">
            <TerminalText tone="red" variant="label">
              WITHDRAW FROM CONTEST
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="body">
              Ends workouts, ranking and prize eligibility. You can&apos;t re-enter; your Contest
              record remains.
            </TerminalText>
            {confirmWithdrawal ? (
              <View style={styles.confirmActions}>
                <CyberButtonOutline
                  disabled={withdrawFromCompetition.isPending}
                  label="KEEP MY ENTRY"
                  onPress={() => setConfirmWithdrawal(false)}
                  style={styles.confirmButton}
                />
                <CyberButtonOutline
                  disabled={withdrawFromCompetition.isPending}
                  label={
                    withdrawFromCompetition.isPending
                      ? 'WITHDRAWING...'
                      : 'CONFIRM WITHDRAWAL'
                  }
                  onPress={() => void performWithdrawal()}
                  style={styles.confirmButton}
                  tone="red"
                />
              </View>
            ) : (
              <CyberButtonOutline
                label="WITHDRAW FROM THIS CONTEST"
                onPress={() => setConfirmWithdrawal(true)}
                tone="red"
              />
            )}
          </HUDBorderBox>
        ) : null}

        <HUDBorderBox style={styles.accountActionCard} tone="muted">
          <TerminalText tone="text" variant="label">
            RESET APP ON THIS DEVICE
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Signs out and clears this device. Your account and Contest history stay saved.
          </TerminalText>
          {confirmReset ? (
            <View style={styles.confirmActions}>
              <CyberButtonOutline
                disabled={resettingApp}
                label="CANCEL"
                onPress={() => setConfirmReset(false)}
                style={styles.confirmButton}
              />
              <CyberButtonOutline
                disabled={resettingApp}
                label={resettingApp ? 'RESETTING...' : 'CONFIRM RESET & SIGN OUT'}
                onPress={() => void performAppReset()}
                style={styles.confirmButton}
                tone="red"
              />
            </View>
          ) : (
            <CyberButtonOutline
              label="RESET APP & SIGN OUT"
              onPress={() => setConfirmReset(true)}
              tone="red"
            />
          )}
        </HUDBorderBox>

        {accountActionMessage ? (
          <AuthStatusNotice
            message={accountActionMessage}
            tone={accountActionMessage.includes('COULD NOT') ? 'red' : 'green'}
          />
        ) : null}

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
      style={({ pressed }) => [styles.settingsRow, pressed && isPressable ? styles.pressed : null]}
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
    paddingBottom: 132,
    backgroundColor: colors.transparent
  },
  sectionToggle: {
    marginBottom: spacing.md
  },
  profileHeader: {
    alignItems: 'stretch',
    marginBottom: 22
  },
  profileIdentityRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingLeft: 14,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan
  },
  profileName: {
    fontFamily: fontFamilies.display
  },
  profileAlias: {
    minWidth: 0,
    flex: 1,
    justifyContent: 'center'
  },
  editProfileButton: {
    width: '100%',
    marginTop: spacing.md
  },
  profileEditor: {
    width: '100%',
    alignItems: 'stretch',
    marginTop: spacing.sm
  },
  savedDeviceNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  savedDeviceCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
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
  legalCard: {
    marginTop: spacing.sm
  },
  accountActionCard: {
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  confirmButton: {
    flex: 1
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
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }]
  }
});
