import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { AuthTextField } from '@/components/auth';
import {
  ActionFeedback,
  RecoverableError
} from '@/components/reliability';
import { ChallengeHub } from '@/components/socialChallenges';
import { UserAlias } from '@/components/streakRewards';
import {
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { useAppData } from '@/data/appDataHooks';
import {
  useChallengeCheckIn,
  useCreateSocialChallenge,
  useFriendRequests,
  useFriends,
  useInviteContactToChallenge,
  useInviteFriendToChallenge,
  useJoinRegionalChallenge,
  useMySocialProfile,
  useRespondToChallengeInvitation,
  useRespondToFriendRequest,
  useRegionalChallengeDiscovery,
  useSendFriendRequest,
  useSocialChallenges,
  useSocialUserSearch
} from '@/data/socialHooks';
import {
  type ChallengeInviteContact,
  type CreateSocialChallengeInput,
  type FriendRequestDecision,
  type SocialChallenge,
  type SocialUser,
  type SocialUserSearchResult
} from '@/domain/social';
import {
  colors,
  fontFamilies,
  fontSizes,
  radii,
  spacing
} from '@/constants/theme';
import { goBackOrReplace } from '@/navigation/goBack';
import { useScreenMemory } from '@/hooks/useScreenMemory';
import { recordFlowMetric } from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';
import { useCompetitionRegion } from '@/state/competitionRegion';

type Feedback = {
  message: string;
  tone: 'amber' | 'cyan' | 'green' | 'red';
};

type SocialSection = 'friends' | 'requests' | 'challenges';

export default function SocialChallengesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { mode } = useAppData();
  const { competitionRegion, regionVerification } = useCompetitionRegion();
  const regionCode = regionVerification?.regionCode ?? '';
  const profileQuery = useMySocialProfile();
  const friendsQuery = useFriends();
  const requestsQuery = useFriendRequests();
  const challengesQuery = useSocialChallenges();
  const regionalChallengesQuery = useRegionalChallengeDiscovery(regionCode);
  const sendFriendRequest = useSendFriendRequest();
  const respondToFriendRequest = useRespondToFriendRequest();
  const createChallenge = useCreateSocialChallenge();
  const inviteFriend = useInviteFriendToChallenge();
  const inviteContact = useInviteContactToChallenge();
  const joinRegionalChallenge = useJoinRegionalChallenge();
  const challengeCheckIn = useChallengeCheckIn();
  const respondToChallenge = useRespondToChallengeInvitation();
  const [searchValue, setSearchValue] = useScreenMemory(
    'social-challenges:search',
    ''
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeSection, setActiveSection] = useScreenMemory<SocialSection>(
    'social-challenges:section',
    'friends'
  );
  const debouncedSearch = useDebouncedValue(searchValue, 300);
  const searchQuery = useSocialUserSearch(debouncedSearch);
  const friends = friendsQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const challenges = challengesQuery.data ?? [];
  const regionalChallenges = regionalChallengesQuery.data ?? [];
  const incomingRequests = requests.filter(({ direction }) => direction === 'incoming');
  const outgoingRequests = requests.filter(({ direction }) => direction === 'outgoing');
  const loading = [
    profileQuery,
    friendsQuery,
    requestsQuery,
    challengesQuery,
    regionalChallengesQuery
  ]
    .some(({ isLoading }) => isLoading);
  const dataError = profileQuery.error ?? friendsQuery.error ??
    requestsQuery.error ?? challengesQuery.error ??
    regionalChallengesQuery.error ?? searchQuery.error;

  const addFriend = async (result: SocialUserSearchResult) => {
    try {
      await sendFriendRequest.mutateAsync(result.userId);
      setFeedback({ message: `Friend request sent to @${result.screenName}.`, tone: 'green' });
    } catch (mutationError) {
      setFeedback({ message: getErrorMessage(mutationError), tone: 'red' });
    }
  };

  const decideFriendRequest = async (
    requestId: string,
    screenNameValue: string,
    decision: FriendRequestDecision
  ) => {
    try {
      await respondToFriendRequest.mutateAsync({ decision, requestId });
      setFeedback({
        message: decision === 'accepted'
          ? `@${screenNameValue} is now your friend.`
          : `Friend request from @${screenNameValue} declined.`,
        tone: decision === 'accepted' ? 'green' : 'cyan'
      });
    } catch (mutationError) {
      setFeedback({ message: getErrorMessage(mutationError), tone: 'red' });
    }
  };

  const submitChallenge = async (
    input: CreateSocialChallengeInput,
    contacts: readonly ChallengeInviteContact[]
  ) => {
    try {
      const challenge = await createChallenge.mutateAsync(input);
      for (const contact of contacts) {
        const invitation = await inviteContact.mutateAsync({
          challengeId: challenge.id,
          contact
        });
        const invitationMessage = [
          `I challenged you to ${challenge.name} on GoGymGo.`,
          `Join here: ${invitation.joinUrl}`
        ].join('\n\n');
        const composerUrl = contact.channel === 'email'
          ? `mailto:${encodeURIComponent(contact.destination)}?subject=${encodeURIComponent(`GoGymGo challenge: ${challenge.name}`)}&body=${encodeURIComponent(invitationMessage)}`
          : `sms:${encodeURIComponent(contact.destination)}?body=${encodeURIComponent(invitationMessage)}`;
        await Linking.openURL(composerUrl);
      }
      setFeedback({
        message: challenge.challengeType === 'friend'
          ? `${challenge.name} created. ${contacts.length > 0 ? 'Your phone opened the invitation composer.' : 'Your in-app friend invitation is on its way.'}`
          : `${challenge.name} is now open in ${challenge.regionName ?? competitionRegion.label}.`,
        tone: 'green'
      });
      return true;
    } catch (mutationError) {
      setFeedback({ message: getErrorMessage(mutationError), tone: 'red' });
      return false;
    }
  };

  const invite = async (
    challengeId: string,
    friendUserId: string,
    friendScreenName: string
  ) => {
    try {
      await inviteFriend.mutateAsync({ challengeId, friendUserId });
      setFeedback({ message: `Challenge invitation sent to @${friendScreenName}.`, tone: 'green' });
    } catch (mutationError) {
      setFeedback({ message: getErrorMessage(mutationError), tone: 'red' });
    }
  };

  const decideChallenge = async (
    challenge: SocialChallenge,
    decision: FriendRequestDecision
  ) => {
    try {
      await respondToChallenge.mutateAsync({ challengeId: challenge.id, decision });
      setFeedback({
        message: decision === 'accepted'
          ? `You joined ${challenge.name}.`
          : `${challenge.name} invitation declined.`,
        tone: decision === 'accepted' ? 'green' : 'cyan'
      });
    } catch (mutationError) {
      setFeedback({ message: getErrorMessage(mutationError), tone: 'red' });
    }
  };

  const joinChallenge = async (challenge: SocialChallenge) => {
    try {
      await joinRegionalChallenge.mutateAsync(challenge.id);
      setFeedback({ message: `You joined ${challenge.name}.`, tone: 'green' });
    } catch (mutationError) {
      setFeedback({ message: getErrorMessage(mutationError), tone: 'red' });
    }
  };

  const checkIn = async (challenge: SocialChallenge) => {
    try {
      await challengeCheckIn.mutateAsync(challenge.id);
      setFeedback({ message: `Today's ${challenge.activityLabel.toLowerCase()} check-in was recorded.`, tone: 'green' });
    } catch (mutationError) {
      setFeedback({ message: getErrorMessage(mutationError), tone: 'red' });
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          memoryKey="social-challenges"
          showsVerticalScrollIndicator={false}
        >
        <Pressable
          accessibilityLabel="Back to Squad"
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, '/squad')}
          style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
        >
          <TerminalText glow tone="cyan" variant="button">
            {'<'} SQUAD
          </TerminalText>
        </Pressable>

        <View style={styles.header}>
          <TerminalText glow tone="pink" variant="label">
            FRIENDS + LOCAL ACTIVITIES
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            CHALLENGE YOUR CREW
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Challenge a friend to a monthly goal, or join a scheduled activity challenge in your region.
          </TerminalText>
        </View>

        {mode === 'unavailable' ? (
          <StatusCard
            message="The social service is offline. Connect Firebase and the GoGymGo API to use friends and challenges."
            tone="amber"
          />
        ) : null}
        {feedback ? (
          <ActionFeedback message={feedback.message} tone={feedback.tone} />
        ) : null}
        {dataError ? (
          <RecoverableError
            body={getErrorMessage(dataError)}
            onRetry={() => {
              void recordFlowMetric(
                user?.uid,
                'flow-retry',
                'weekly-challenge'
              );
              void Promise.all([
                profileQuery.refetch(),
                friendsQuery.refetch(),
                requestsQuery.refetch(),
                challengesQuery.refetch(),
                regionalChallengesQuery.refetch(),
                ...(searchQuery.isError ? [searchQuery.refetch()] : [])
              ]);
            }}
            retrying={[
              profileQuery,
              friendsQuery,
              requestsQuery,
              challengesQuery,
              regionalChallengesQuery,
              searchQuery
            ].some(({ isFetching }) => isFetching)}
            title="COULD NOT LOAD SOCIAL DATA"
          />
        ) : null}

        <SocialSectionTabs
          activeSection={activeSection}
          challengeCount={challenges.length}
          friendCount={friends.length}
          requestCount={incomingRequests.length}
          onSelect={setActiveSection}
        />

        {activeSection === 'friends' ? (
          <>
        <Section eyebrow="YOUR IDENTITY" title="YOUR ALIAS">
          <TerminalText style={styles.sectionCopy} tone="muted" uppercase={false} variant="body">
            Your alias is used throughout GoGymGo and is how friends find you. Aliases are case-insensitive.
          </TerminalText>
          {profileQuery.data ? (
            <UserAlias
              alias={profileQuery.data.screenName}
              prefix="@"
              streaks={profileQuery.data.streaks}
            />
          ) : null}
          <CyberButtonPrimary
            disabled={mode === 'unavailable' || profileQuery.isLoading}
            label="EDIT ALIAS"
            onPress={() => router.push('/identity?source=social')}
          />
        </Section>

        <Section eyebrow="DISCOVERY" title="FIND FRIENDS">
          <AuthTextField
            autoCapitalize="characters"
            autoCorrect={false}
            editable={mode !== 'unavailable'}
            label="SEARCH BY ALIAS"
            maxLength={24}
            onChangeText={setSearchValue}
            placeholder="ENTER AT LEAST 2 CHARACTERS"
            value={searchValue}
          />
          {debouncedSearch.length > 0 && debouncedSearch.length < 2 ? (
            <TerminalText tone="amber" uppercase={false} variant="micro">
              Enter at least 2 characters to search.
            </TerminalText>
          ) : null}
          {searchQuery.isFetching ? (
            <TerminalText tone="dim" variant="micro">SEARCHING...</TerminalText>
          ) : null}
          {searchQuery.data?.map((result) => (
            <UserResultRow
              busy={sendFriendRequest.isPending}
              key={result.userId}
              onAdd={() => addFriend(result)}
              result={result}
            />
          ))}
          {searchQuery.data && searchQuery.data.length === 0 ? (
            <EmptyState>No aliases matched that search.</EmptyState>
          ) : null}
        </Section>
          </>
        ) : null}

        {activeSection === 'requests' ? (
          <Section eyebrow="CONSENT QUEUE" title="FRIEND REQUESTS">
          {incomingRequests.length > 0 ? (
            <TerminalText tone="cyan" variant="micro">INCOMING</TerminalText>
          ) : null}
          {incomingRequests.map((request) => (
            <View key={request.id} style={styles.requestRow}>
              <UserIdentity screenName={request.user.screenName} streaks={request.user.streaks} />
              <View style={styles.actionRow}>
                <CompactButton
                  disabled={respondToFriendRequest.isPending}
                  label="ACCEPT"
                  onPress={() => decideFriendRequest(request.id, request.user.screenName, 'accepted')}
                  tone="green"
                />
                <CompactButton
                  disabled={respondToFriendRequest.isPending}
                  label="DECLINE"
                  onPress={() => decideFriendRequest(request.id, request.user.screenName, 'declined')}
                  tone="muted"
                />
              </View>
            </View>
          ))}
          {outgoingRequests.length > 0 ? (
            <TerminalText style={styles.subsectionLabel} tone="dim" variant="micro">
              SENT
            </TerminalText>
          ) : null}
          {outgoingRequests.map((request) => (
            <View key={request.id} style={styles.requestRow}>
              <UserIdentity screenName={request.user.screenName} streaks={request.user.streaks} />
              <TerminalText tone="amber" variant="micro">PENDING</TerminalText>
            </View>
          ))}
          {requests.length === 0 ? (
            <EmptyState>No pending friend requests.</EmptyState>
          ) : null}
          </Section>
        ) : null}

        {activeSection === 'friends' ? (
          <Section eyebrow="CONNECTED" title={`FRIENDS // ${friends.length}`}>
          <View style={styles.friendGrid}>
            {friends.map((friend) => (
              <View key={friend.userId} style={styles.friendChip}>
                <UserIdentity screenName={friend.screenName} streaks={friend.streaks} />
                <TerminalText tone="green" variant="micro">FRIEND</TerminalText>
              </View>
            ))}
          </View>
          {friends.length === 0 ? (
            <EmptyState>Accept a friend request before sending challenge invitations.</EmptyState>
          ) : null}
          </Section>
        ) : null}

        {activeSection === 'challenges' ? (
          <ChallengeHub
            busy={
              createChallenge.isPending ||
              inviteContact.isPending ||
              inviteFriend.isPending ||
              respondToChallenge.isPending ||
              joinRegionalChallenge.isPending ||
              challengeCheckIn.isPending
            }
            challenges={challenges}
            disabled={mode === 'unavailable'}
            discoveredChallenges={regionalChallenges}
            friends={friends}
            onCheckIn={checkIn}
            onCreate={submitChallenge}
            onDecision={decideChallenge}
            onInvite={(challenge, friendUserId, friendScreenName) =>
              invite(challenge.id, friendUserId, friendScreenName)
            }
            onJoin={joinChallenge}
            regionCode={regionCode}
          />
        ) : null}
        {loading ? (
          <TerminalText style={styles.loading} tone="dim" variant="micro">
            LOADING SOCIAL DATA...
          </TerminalText>
        ) : null}
        </ScreenScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function SocialSectionTabs({
  activeSection,
  challengeCount,
  friendCount,
  onSelect,
  requestCount
}: {
  activeSection: SocialSection;
  challengeCount: number;
  friendCount: number;
  onSelect: (section: SocialSection) => void;
  requestCount: number;
}) {
  const sections: readonly { count: number; label: string; value: SocialSection }[] = [
    { count: friendCount, label: 'FRIENDS', value: 'friends' },
    { count: requestCount, label: 'REQUESTS', value: 'requests' },
    { count: challengeCount, label: 'CHALLENGES', value: 'challenges' }
  ];

  return (
    <View accessibilityRole="tablist" style={styles.sectionTabs}>
      {sections.map((section) => {
        const selected = section.value === activeSection;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={section.value}
            onPress={() => onSelect(section.value)}
            style={[styles.sectionTab, selected ? styles.sectionTabActive : null]}
          >
            <TerminalText
              glow={selected}
              style={styles.sectionTabLabel}
              tone={selected ? 'cyan' : 'muted'}
              variant="button"
            >
              {section.label}
            </TerminalText>
            <TerminalText tone={selected ? 'green' : 'dim'} variant="micro">
              {section.count}
            </TerminalText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({
  children,
  eyebrow,
  title,
  tone = 'cyan'
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  tone?: 'cyan' | 'pink';
}) {
  return (
    <HUDBorderBox style={styles.section} tone={tone}>
      <TerminalText tone={tone} variant="micro">{eyebrow}</TerminalText>
      <TerminalText glow style={styles.sectionTitle} tone={tone} variant="label">
        {title}
      </TerminalText>
      {children}
    </HUDBorderBox>
  );
}

function UserResultRow({
  busy,
  onAdd,
  result
}: {
  busy: boolean;
  onAdd: () => void;
  result: SocialUserSearchResult;
}) {
  const button = {
    friend: { label: 'FRIEND', tone: 'green' as const },
    incoming_request: { label: 'REVIEW REQUEST', tone: 'amber' as const },
    none: { label: 'ADD FRIEND', tone: 'cyan' as const },
    outgoing_request: { label: 'REQUEST SENT', tone: 'amber' as const }
  }[result.relationship];

  return (
    <View style={styles.resultRow}>
      <UserIdentity screenName={result.screenName} streaks={result.streaks} />
      <CompactButton
        disabled={busy || result.relationship !== 'none'}
        label={button.label}
        onPress={onAdd}
        tone={button.tone}
      />
    </View>
  );
}

function UserIdentity({ screenName, streaks }: Pick<SocialUser, 'screenName' | 'streaks'>) {
  return (
    <View style={styles.identity}>
      <View style={styles.avatar}>
        <TerminalText tone="cyan" variant="button">
          {screenName.split('_').map((part) => part[0]).join('').slice(0, 2)}
        </TerminalText>
      </View>
      <UserAlias
        alias={screenName}
        prefix="@"
        streaks={streaks}
        style={styles.identityAlias}
        textStyle={styles.identityName}
      />
    </View>
  );
}

function CompactButton({
  disabled = false,
  label,
  onPress,
  style,
  tone
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  tone: 'amber' | 'cyan' | 'green' | 'muted';
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactButton,
        compactButtonToneStyles[tone],
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style
      ]}
    >
      <TerminalText glow={!disabled} tone={tone === 'muted' ? 'muted' : tone} variant="micro">
        {label}
      </TerminalText>
    </Pressable>
  );
}

function StatusCard({ message, tone }: Feedback) {
  return (
    <HUDBorderBox style={styles.statusCard} tone={tone}>
      <TerminalText tone={tone} uppercase={false} variant="body">{message}</TerminalText>
    </HUDBorderBox>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <TerminalText style={styles.emptyState} tone="dim" uppercase={false} variant="body">
      {children}
    </TerminalText>
  );
}

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(handle);
  }, [delay, value]);

  return debounced;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'That action could not be completed.';
}

const compactButtonToneStyles = {
  amber: {
    borderColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
  },
  cyan: {
    borderColor: colors.borderCyanButton,
    backgroundColor: colors.surfaceCyanGhost
  },
  green: {
    borderColor: colors.borderSuccess,
    backgroundColor: colors.surfaceSuccess
  },
  muted: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.panelSoft
  }
} as const;

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 132,
    backgroundColor: colors.background
  },
  sponsorRail: {
    marginBottom: spacing.lg
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderCyanButton,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanGhost
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xl
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle
  },
  statusCard: {
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg
  },
  sectionTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg
  },
  sectionTab: {
    minWidth: 0,
    minHeight: 52,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  sectionTabActive: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  sectionTabLabel: {
    fontFamily: fontFamilies.terminal,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.45
  },
  sectionTitle: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.cardTitle
  },
  sectionCopy: {
    fontFamily: fontFamilies.body
  },
  subsectionLabel: {
    marginTop: spacing.sm
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderCyanHairline
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCyanHairline
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderCyanStrong,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceCyanSelected
  },
  identityName: {
    flexShrink: 1,
    fontFamily: fontFamilies.terminal
  },
  identityAlias: {
    flex: 1
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  compactButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.sm
  },
  pressed: {
    opacity: 0.7
  },
  disabled: {
    opacity: 0.42
  },
  friendGrid: {
    gap: spacing.sm
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha45
  },
  emptyState: {
    paddingVertical: spacing.sm,
    textAlign: 'center'
  },
  loading: {
    marginTop: spacing.lg,
    textAlign: 'center'
  }
});
