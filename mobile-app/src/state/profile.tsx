import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import {
  createPrivateIdentity,
  normalizePublicIdentity,
  parseStoredPublicIdentity,
  publicIdentityFromAccountProfile,
  resolvePublicName,
  type IdentityMode,
  type PublicIdentity
} from '@/domain/profile';
import { useAppData } from '@/data/appDataHooks';
import type { AvatarMedia } from '@/domain/accountSettings';
import { createUserStorage } from '@/services/storage/userStorage';
import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';
import { appTourPublicIdentity } from '@/testing/appTourData';

type ProfileContextValue = {
  hasPublicIdentity: boolean;
  identityMode: IdentityMode;
  profileImageUri: string | null;
  profileImageStatus: AvatarMedia['status'] | 'local' | null;
  profileReady: boolean;
  publicIdentity: PublicIdentity;
  publicName: string;
  removeProfileImage: () => Promise<void>;
  setIdentityMode: (mode: IdentityMode) => Promise<void>;
  setProfileImage: (uri: string) => Promise<void>;
  setPublicIdentity: (identity: PublicIdentity) => Promise<void>;
};

const profileImageStorageKey = '@gogymgo/profile-image';
const publicIdentityStorageKey = '@gogymgo/public-identity';
const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { accountSettings, mode } = useAppData();
  const { active: appTourActive } = useAppTour();
  const { loading: authLoading, user } = useAuth();
  const userId = user?.uid ?? null;
  const userStorage = useMemo(
    () => userId ? createUserStorage(userId) : null,
    [userId]
  );
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileImageStatus, setProfileImageStatus] = useState<
    AvatarMedia['status'] | 'local' | null
  >(null);
  const [profileReady, setProfileReady] = useState(appTourActive);
  const [publicIdentity, setPublicIdentityState] = useState<PublicIdentity>(
    appTourActive ? appTourPublicIdentity : createPrivateIdentity(userId)
  );
  const [hasPublicIdentity, setHasPublicIdentity] = useState(appTourActive);

  useEffect(() => {
    let active = true;

    if (appTourActive) {
      return () => {
        active = false;
      };
    }

    if (authLoading) {
      return () => {
        active = false;
      };
    }

    if (!userStorage) {
      void Promise.resolve().then(() => {
        if (active) {
          setProfileReady(true);
        }
      });
      return () => {
        active = false;
      };
    }

    void Promise.all([
      userStorage.getItem(profileImageStorageKey),
      userStorage.getItem(publicIdentityStorageKey),
      mode === 'api'
        ? accountSettings.getAvatar().catch(() => null)
        : Promise.resolve(null),
      mode === 'api'
        ? accountSettings.getProfile().catch(() => null)
        : Promise.resolve(null)
    ])
      .then(([storedImage, storedIdentity, avatarState, accountProfile]) => {
        if (!active) {
          return;
        }

        if (mode === 'api') {
          setProfileImageUri(avatarState?.active?.readUrl ?? null);
          setProfileImageStatus(
            avatarState?.latest?.status ?? avatarState?.active?.status ?? null
          );
        } else if (storedImage) {
          setProfileImageUri(storedImage);
          setProfileImageStatus('local');
        }

        const serverIdentity = accountProfile
          ? publicIdentityFromAccountProfile(accountProfile)
          : null;
        const parsedIdentity = parseStoredPublicIdentity(storedIdentity);
        const restoredIdentity = serverIdentity ?? parsedIdentity;
        if (restoredIdentity) {
          setPublicIdentityState(restoredIdentity);
          setHasPublicIdentity(true);
          if (serverIdentity) {
            void userStorage.setItem(
              publicIdentityStorageKey,
              JSON.stringify(serverIdentity)
            ).catch(() => {
              // The server remains authoritative if the local cache cannot refresh.
            });
          }
        }
      })
      .catch(() => {
        // Generated profile defaults remain available when storage cannot be read.
      })
      .finally(() => {
        if (active) {
          setProfileReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [accountSettings, appTourActive, authLoading, mode, userStorage]);

  useEffect(() => {
    if (appTourActive || authLoading || mode !== 'api' || !userId) {
      return undefined;
    }

    let active = true;
    const synchronize = () => {
      void Promise.all([
        accountSettings.getProfile(),
        accountSettings.getAvatar().catch(() => null)
      ])
        .then(([profile, avatarState]) => {
          if (!active) return;
          const identity = publicIdentityFromAccountProfile(profile);
          setPublicIdentityState(identity);
          setHasPublicIdentity(true);
          if (avatarState) {
            setProfileImageUri(avatarState.active?.readUrl ?? null);
            setProfileImageStatus(
              avatarState.latest?.status ??
              avatarState.active?.status ??
              null
            );
          }
          void userStorage?.setItem(
            publicIdentityStorageKey,
            JSON.stringify(identity)
          ).catch(() => {
            // The active server identity remains available in memory.
          });
        })
        .catch(() => {
          // Keep the last synchronized identity while the API is unreachable.
        });
    };
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') synchronize();
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [
    accountSettings,
    appTourActive,
    authLoading,
    mode,
    userId,
    userStorage
  ]);

  const setProfileImage = useCallback(async (uri: string) => {
    const previousImage = profileImageUri;
    const previousStatus = profileImageStatus;
    setProfileImageUri(uri);

    try {
      if (mode === 'api') {
        const result = await accountSettings.uploadAvatar(uri);
        setProfileImageStatus(result.status);
        if (result.state.active?.readUrl) {
          setProfileImageUri(result.state.active.readUrl);
        }
      } else {
        setProfileImageStatus('local');
        await userStorage?.setItem(profileImageStorageKey, uri);
      }
    } catch (error) {
      setProfileImageUri(previousImage);
      setProfileImageStatus(previousStatus);
      throw error;
    }
  }, [accountSettings, mode, profileImageStatus, profileImageUri, userStorage]);

  const removeProfileImage = useCallback(async () => {
    try {
      if (mode === 'api') {
        await accountSettings.removeAvatar();
      } else {
        await userStorage?.removeItem(profileImageStorageKey);
      }
      setProfileImageUri(null);
      setProfileImageStatus(null);
    } catch (error) {
      throw error;
    }
  }, [accountSettings, mode, userStorage]);

  const setPublicIdentity = useCallback(async (identity: PublicIdentity) => {
    const normalized = normalizePublicIdentity(identity);
    const synchronized = mode === 'api'
      ? publicIdentityFromAccountProfile(
          await accountSettings.updateProfile({
            publicIdentityMode: normalized.mode,
            publicName:
              normalized.mode === 'private'
                ? null
                : normalized.displayName,
            ...(normalized.mode === 'alias'
              ? { screenName: normalized.displayName }
              : {})
          })
        )
      : normalized;
    setPublicIdentityState(synchronized);
    setHasPublicIdentity(true);
    void queryClient.invalidateQueries({
      queryKey: ['social', userId ?? 'anonymous']
    });

    try {
      await userStorage?.setItem(
        publicIdentityStorageKey,
        JSON.stringify(synchronized)
      );
    } catch {
      // Keep the selected identity for the active session if persistence fails.
    }
  }, [accountSettings, mode, queryClient, userId, userStorage]);

  const setIdentityMode = useCallback(async (nextMode: IdentityMode) => {
    const nextIdentity = normalizePublicIdentity({
      ...publicIdentity,
      mode: nextMode
    });
    const synchronized = mode === 'api'
      ? publicIdentityFromAccountProfile(
          await accountSettings.updateProfile({
            publicIdentityMode: nextIdentity.mode,
            publicName:
              nextIdentity.mode === 'private'
                ? null
                : nextIdentity.displayName
          })
        )
      : nextIdentity;
    setPublicIdentityState(synchronized);
    setHasPublicIdentity(true);
    void queryClient.invalidateQueries({
      queryKey: ['social', userId ?? 'anonymous']
    });

    try {
      await userStorage?.setItem(
        publicIdentityStorageKey,
        JSON.stringify(synchronized)
      );
    } catch {
      // Keep the selected mode for the active session if persistence fails.
    }
  }, [
    accountSettings,
    mode,
    publicIdentity,
    queryClient,
    userId,
    userStorage
  ]);

  const publicName = resolvePublicName(publicIdentity);
  const value = useMemo<ProfileContextValue>(
    () => ({
      hasPublicIdentity,
      identityMode: publicIdentity.mode,
      profileImageUri,
      profileImageStatus,
      profileReady,
      publicIdentity,
      publicName,
      removeProfileImage,
      setIdentityMode,
      setProfileImage,
      setPublicIdentity
    }),
    [
      hasPublicIdentity,
      profileImageUri,
      profileImageStatus,
      profileReady,
      publicIdentity,
      publicName,
      removeProfileImage,
      setIdentityMode,
      setProfileImage,
      setPublicIdentity
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error('useProfile must be used inside ProfileProvider');
  }

  return context;
}
