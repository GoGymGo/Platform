import type { PublicIdentity } from '@/domain/profile';
import type { ApiClient } from '@/services/api/client';
import { requireApiClient } from '@/services/api/availability';

export type AccountProfileResponse = {
  callsign: string;
  email: string | null;
  emailVerified: boolean;
  id: string;
  privacySettings: {
    showRegion: boolean;
    showStats: boolean;
  };
  publicIdentityMode: 'alias' | 'private' | 'real_name';
  publicName: string | null;
  roles: string[];
  status: 'active' | 'deleted' | 'suspended';
  version: number;
};

export function getAccountProfile(api: ApiClient | null) {
  return requireApiClient(api).request<AccountProfileResponse>('/v1/me');
}

export function updateAccountPublicIdentity(
  api: ApiClient | null,
  identity: PublicIdentity
) {
  return requireApiClient(api).request<
    AccountProfileResponse,
    { publicIdentityMode: 'alias' | 'private' | 'real_name'; publicName: string | null }
  >('/v1/me', {
    body: {
      publicIdentityMode: toApiIdentityMode(identity.mode),
      publicName: identity.mode === 'private' ? null : identity.displayName
    },
    method: 'PATCH'
  });
}

export function toPublicIdentity(profile: AccountProfileResponse): PublicIdentity {
  return {
    callsign: profile.callsign,
    displayName: profile.publicName ?? '',
    mode: profile.publicIdentityMode === 'real_name'
      ? 'real'
      : profile.publicIdentityMode
  };
}

function toApiIdentityMode(mode: PublicIdentity['mode']) {
  return mode === 'real' ? 'real_name' : mode;
}
