import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppData } from '@/data/appDataHooks';
import {
  normalizeChallengeInput,
  normalizeScreenName,
  type CreateSocialChallengeInput,
  type ChallengeInviteContact,
  type FriendRequestDecision
} from '@/domain/social';
import { useAuth } from '@/state/auth';

export function useMySocialProfile() {
  const context = useSocialContext();
  return useQuery({
    enabled: context.enabled,
    queryFn: () => context.social.getMyProfile(),
    queryKey: [...context.queryKey, 'profile']
  });
}

export function useSocialUserSearch(screenName: string) {
  const context = useSocialContext();
  const query = normalizeScreenName(screenName);
  const validQuery = query.length >= 2 && /^[A-Za-z0-9_]+$/.test(query);

  return useQuery({
    enabled: context.enabled && validQuery,
    queryFn: () => context.social.searchUsers(query),
    queryKey: [...context.queryKey, 'search', query.toLowerCase()]
  });
}

export function useFriends() {
  const context = useSocialContext();
  return useQuery({
    enabled: context.enabled,
    queryFn: () => context.social.listFriends(),
    queryKey: [...context.queryKey, 'friends']
  });
}

export function useFriendRequests() {
  const context = useSocialContext();
  return useQuery({
    enabled: context.enabled,
    queryFn: () => context.social.listFriendRequests(),
    queryKey: [...context.queryKey, 'friend-requests']
  });
}

export function useSocialChallenges() {
  const context = useSocialContext();
  return useQuery({
    enabled: context.enabled,
    queryFn: () => context.social.listChallenges(),
    queryKey: [...context.queryKey, 'challenges']
  });
}

export function useRegionalChallengeDiscovery(regionCode: string) {
  const context = useSocialContext();
  const normalizedRegionCode = regionCode.trim().toLowerCase();
  return useQuery({
    enabled: context.enabled && normalizedRegionCode.length >= 2,
    queryFn: () => context.social.discoverRegionalChallenges(normalizedRegionCode),
    queryKey: [...context.queryKey, 'challenges', 'discover', normalizedRegionCode]
  });
}

export function useUpdateScreenName() {
  const context = useSocialContext();
  return useSocialMutation(
    (screenName: string) => context.social.updateScreenName(normalizeScreenName(screenName)),
    context.queryKey
  );
}

export function useSendFriendRequest() {
  const context = useSocialContext();
  return useSocialMutation(
    (recipientUserId: string) => context.social.sendFriendRequest(recipientUserId),
    context.queryKey
  );
}

export function useRespondToFriendRequest() {
  const context = useSocialContext();
  return useSocialMutation(
    ({ decision, requestId }: { decision: FriendRequestDecision; requestId: string }) =>
      context.social.respondToFriendRequest(requestId, decision),
    context.queryKey
  );
}

export function useCreateSocialChallenge() {
  const context = useSocialContext();
  return useSocialMutation(
    (input: CreateSocialChallengeInput) =>
      context.social.createChallenge(normalizeChallengeInput(input)),
    context.queryKey
  );
}

export function useJoinRegionalChallenge() {
  const context = useSocialContext();
  return useSocialMutation(
    (challengeId: string) => context.social.joinRegionalChallenge(challengeId),
    context.queryKey
  );
}

export function useChallengeCheckIn() {
  const context = useSocialContext();
  return useSocialMutation(
    (challengeId: string) => context.social.checkInToChallenge(challengeId),
    context.queryKey
  );
}

export function useInviteFriendToChallenge() {
  const context = useSocialContext();
  return useSocialMutation(
    ({ challengeId, friendUserId }: { challengeId: string; friendUserId: string }) =>
      context.social.inviteFriendToChallenge(challengeId, friendUserId),
    context.queryKey
  );
}

export function useInviteContactToChallenge() {
  const context = useAppData();
  return useMutation({
    mutationFn: ({ challengeId, contact }: {
      challengeId: string;
      contact: ChallengeInviteContact;
    }) => context.social.inviteContactToChallenge(challengeId, contact)
  });
}

export function useRespondToChallengeInvitation() {
  const context = useSocialContext();
  return useSocialMutation(
    ({ challengeId, decision }: { challengeId: string; decision: FriendRequestDecision }) =>
      context.social.respondToChallengeInvitation(challengeId, decision),
    context.queryKey
  );
}

function useSocialContext() {
  const { authenticatedQueriesEnabled, mode, social } = useAppData();
  const { user } = useAuth();

  return {
    enabled: authenticatedQueriesEnabled && mode !== 'unavailable',
    queryKey: ['social', user?.uid ?? 'anonymous'] as const,
    social
  };
}

function useSocialMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  queryKey: readonly string[]
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...queryKey] })
  });
}
