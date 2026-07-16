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
import { UserAlias } from '@/components/streakRewards';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useMyStreaks } from '@/data/appDataHooks';
import {
  useFriendRequests,
  useFriends,
  useRespondToFriendRequest
} from '@/data/socialHooks';
import { getPublicInitials } from '@/domain/profile';
import { useProfileImagePicker } from '@/hooks/useProfileImagePicker';
import { useAuth } from '@/state/auth';
import {
  getVerificationPreference,
  getPreferenceOwnerId,
  type VerificationPreference
} from '@/state/onboardingPreferences';
import { useProfile } from '@/state/profile';
import { useCompetitionRegion } from '@/state/competitionRegion';
import { useWorkoutProgress } from '@/state/workoutProgress';

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
};

function getSettingsRows(
  verificationSourceLabel: string
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
        subtitle: 'GOALS, WEEKLY CHALLENGES AND PRIZE DRAW ENTRIES',
        tone: 'cyan',
        route: '/how-it-works?from=profile' as Href
      },
      {
        title: 'MY REWARDS',
        subtitle: 'CLAIM PHYSICAL PRIZES AND COUPON CODES',
        tone: 'green',
        route: '/rewards/awards' as Href
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
        title: 'DEVICE PRESENCE / QR CAMERA CONSENT',
        subtitle: 'LOCAL CHECKS // NO BIOMETRIC OR QR IMAGERY STORED',
        tone: 'muted',
        route: '/biometric-camera-consent' as Href
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
  const { signOutUser, user } = useAuth();
  const preferenceOwnerId = getPreferenceOwnerId(user?.uid);
  const { publicName } = useProfile();
  const { data: streakSummary } = useMyStreaks();
  const friendsQuery = useFriends();
  const friendRequestsQuery = useFriendRequests();
  const respondToFriendRequest = useRespondToFriendRequest();
  const { competitionRegion, regionVerification } = useCompetitionRegion();
  const publicInitials = getPublicInitials(publicName);
  const {
    currentStreak,
    remindersEnabled,
    setCompetitionRemindersEnabled,
    totalEntries,
    verifiedSessionCount
  } = useWorkoutProgress();
  const [verificationPreference, setVerificationPreference] =
    useState<VerificationPreference>({
      method: 'heartRate',
      sourceKey: 'heartRateDevice',
      sourceLabel: 'HEART-RATE DEVICE'
    });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const [showLegal, setShowLegal] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string>();
  const [friendMessage, setFriendMessage] = useState<string>();
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
  const settingsGroups = getSettingsRows(verificationPreference.sourceLabel);
  const providerLabel = formatProviderLabel(user?.providerIds ?? []);
  const friends = friendsQuery.data ?? [];
  const incomingFriendRequests = (friendRequestsQuery.data ?? []).filter(
    ({ direction }) => direction === 'incoming'
  );

  useEffect(() => {
    let mounted = true;

    if (!preferenceOwnerId) {
      return () => {
        mounted = false;
      };
    }

    void getVerificationPreference(preferenceOwnerId).then((preference) => {
      if (mounted) {
        setVerificationPreference(preference);
      }
    });
    return () => {
      mounted = false;
    };
  }, [preferenceOwnerId]);

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

  async function respondToRequest(requestId: string, decision: 'accepted' | 'declined') {
    setFriendMessage(undefined);
    try {
      await respondToFriendRequest.mutateAsync({ decision, requestId });
      setFriendMessage(
        decision === 'accepted' ? 'FRIEND REQUEST ACCEPTED.' : 'FRIEND REQUEST DECLINED.'
      );
    } catch {
      setFriendMessage('FRIEND REQUEST COULD NOT BE UPDATED. TRY AGAIN.');
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
          <ProfileAvatar
            imageUri={profileImageUri}
            initials={publicInitials}
            showStatus={Boolean(user?.emailVerified)}
          />
          <UserAlias
            alias={publicName}
            glow
            streaks={streakSummary?.streaks}
            style={styles.profileAlias}
            textStyle={styles.profileName}
            tone="cyan"
            variant="title"
          />
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
            <TerminalText live="polite" style={styles.profileImageMessage} tone="muted" variant="caption">
              {profileImageMessage}
            </TerminalText>
          ) : null}
          {profileImageStatus === 'pending_review' ? (
            <TerminalText live="polite" style={styles.profileImageMessage} tone="amber" variant="caption">
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
                {user?.email ?? 'PREVIEW ACCOUNT'}
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

        <TerminalText style={styles.sectionLabel} tone="dim" variant="label">
          FRIENDS
        </TerminalText>
        <HUDBorderBox style={styles.friendsCard} tone="muted">
          <View style={styles.friendsHeader}>
            <View style={styles.friendsHeaderCopy}>
              <TerminalText glow tone="cyan" variant="label">
                YOUR FRIENDS // {friends.length}
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Accept requests here or find someone by their GoGymGo alias.
              </TerminalText>
            </View>
            {incomingFriendRequests.length > 0 ? (
              <View style={styles.requestCount}>
                <TerminalText glow tone="pink" variant="micro">
                  {incomingFriendRequests.length} NEW
                </TerminalText>
              </View>
            ) : null}
          </View>

          {incomingFriendRequests.map((request) => (
            <View key={request.id} style={styles.friendRequestRow}>
              <UserAlias
                alias={request.user.screenName}
                prefix="@"
                streaks={request.user.streaks}
                style={styles.friendIdentity}
              />
              <View style={styles.friendActions}>
                <ProfileFriendAction
                  disabled={respondToFriendRequest.isPending}
                  label="ACCEPT"
                  onPress={() => void respondToRequest(request.id, 'accepted')}
                  tone="green"
                />
                <ProfileFriendAction
                  disabled={respondToFriendRequest.isPending}
                  label="DECLINE"
                  onPress={() => void respondToRequest(request.id, 'declined')}
                  tone="muted"
                />
              </View>
            </View>
          ))}

          {friends.map((friend) => (
            <View key={friend.userId} style={styles.friendRow}>
              <UserAlias
                alias={friend.screenName}
                prefix="@"
                streaks={friend.streaks}
                style={styles.friendIdentity}
              />
              <TerminalText tone="green" variant="micro">
                FRIEND
              </TerminalText>
            </View>
          ))}

          {!friendsQuery.isPending && friends.length === 0 && incomingFriendRequests.length === 0 ? (
            <TerminalText tone="dim" uppercase={false} variant="body">
              No friends yet. Search by alias or send a private challenge invitation.
            </TerminalText>
          ) : null}
          {friendsQuery.isPending || friendRequestsQuery.isPending ? (
            <TerminalText live="polite" tone="dim" variant="micro">
              LOADING FRIENDS...
            </TerminalText>
          ) : null}
          {friendMessage ? (
            <TerminalText live="polite" tone="cyan" variant="micro">
              {friendMessage}
            </TerminalText>
          ) : null}
          <CyberButtonOutline
            label="FIND + INVITE FRIENDS ->"
            onPress={() => router.push('/squad/social' as Href)}
          />
        </HUDBorderBox>

        <HUDBorderBox style={styles.regionCard} tone="cyan">
          <View style={styles.regionCopy}>
            <TerminalText tone="dim" variant="label">
              COMPETITION REGION
            </TerminalText>
            <TerminalText glow tone="cyan" variant="body">
              {competitionRegion.label}
            </TerminalText>
            <TerminalText tone={regionVerification?.status === 'verified' ? 'green' : 'amber'} variant="caption">
              {regionVerification
                ? regionVerification.status === 'verified'
                  ? 'VERIFIED BY DEVICE LOCATION'
                  : 'POSTAL MATCH // LOCATION RECHECK REQUIRED'
                : 'LOCATION VERIFICATION REQUIRED'}
            </TerminalText>
          </View>
          <CyberButtonOutline
            label="REVERIFY"
            onPress={() => router.push('/region?source=profile' as Href)}
            style={styles.regionButton}
          />
        </HUDBorderBox>

        <TerminalText style={styles.sectionLabel} tone="dim" variant="label">
          COMPETITION
        </TerminalText>
        <HUDBorderBox style={[styles.settingsCard, styles.settingsGroup]} tone="muted">
          {settingsGroups.competition.map((row) => (
            <SettingsItem key={row.title} row={row} />
          ))}
        </HUDBorderBox>

        <Pressable
          accessibilityHint="Turn Weekly Goal, Weekly Challenge and Bonus Day alerts on or off"
          accessibilityLabel="Competition reminders"
          accessibilityRole="switch"
          accessibilityState={{ checked: remindersEnabled, disabled: notificationBusy }}
          disabled={notificationBusy}
          onPress={() => void updateNotifications(!remindersEnabled)}
          style={({ pressed }) => pressed ? styles.pressed : null}
        >
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
              trackColor={{ false: colors.panelSoft, true: colors.surfaceCyanActive }}
              value={remindersEnabled}
            />
          </HUDBorderBox>
        </Pressable>
        {notificationMessage ? (
          <TerminalText live="assertive" style={styles.notificationMessage} tone="amber" uppercase={false} variant="caption">
            {notificationMessage}
          </TerminalText>
        ) : null}

        <CyberButtonOutline
          label="PARTNER WITH GOGYMGO ->"
          onPress={() => router.push('/partner' as Href)}
          style={styles.partnerToggle}
        />

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

function ProfileFriendAction({
  disabled,
  label,
  onPress,
  tone
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  tone: 'green' | 'muted';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.friendAction,
        tone === 'green' ? styles.friendActionAccept : styles.friendActionMuted,
        disabled ? styles.friendActionDisabled : null,
        pressed ? styles.pressed : null
      ]}
    >
      <TerminalText glow={tone === 'green'} tone={tone} variant="micro">
        {label}
      </TerminalText>
    </Pressable>
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
  profileHeader: {
    alignItems: 'center',
    marginBottom: 22
  },
  profileName: {
    fontFamily: fontFamilies.display
  },
  profileAlias: {
    justifyContent: 'center',
    marginTop: spacing.md
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
  friendsCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  friendsHeaderCopy: {
    flex: 1,
    gap: spacing.xs
  },
  requestCount: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderPinkGlow,
    borderRadius: 6,
    backgroundColor: colors.surfacePink
  },
  friendRequestRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.whiteAlpha05
  },
  friendRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  friendIdentity: {
    flex: 1
  },
  friendActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  friendAction: {
    minWidth: 82,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: 6
  },
  friendActionAccept: {
    borderColor: colors.borderSuccessGlow,
    backgroundColor: colors.surfaceSuccess
  },
  friendActionMuted: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelSoft
  },
  friendActionDisabled: {
    opacity: 0.5
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
    marginBottom: spacing.md
  },
  legalCard: {
    marginTop: spacing.sm
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
