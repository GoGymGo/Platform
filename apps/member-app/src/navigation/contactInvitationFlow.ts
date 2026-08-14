import type { Href } from 'expo-router';

const challengePrefix = 'challenge:';

export function contactInvitationNext(token: string): string {
  return `${challengePrefix}${token}`;
}

export function contactInvitationFromNext(
  next: string | undefined,
): string | null {
  if (!next?.startsWith(challengePrefix)) return null;
  const token = next.slice(challengePrefix.length).trim();
  return token.length > 0 ? token : null;
}

export function contactInvitationReviewRoute(token: string): Href {
  return { pathname: '/join', params: { challengeInvite: token } };
}

export function contactInvitationAuthRoute(
  pathname: '/sign-in' | '/sign-up' | '/forgot-password',
  token: string,
): Href {
  return { pathname, params: { challengeInvite: token } };
}
