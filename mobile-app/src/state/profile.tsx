import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

import {
  createPrivateIdentity,
  normalizePublicIdentity,
  parseStoredPublicIdentity,
  resolvePublicName,
  type IdentityMode,
  type PublicIdentity
} from '@/domain/profile';
import { useAppData } from '@/data/appDataHooks';
import type { AvatarMedia } from '@/domain/accountSettings';
import { createUserStorage } from '@/services/storage/userStorage';
import { useAppTour } from '@/state/appTour';
import { useAuth } from '@/state/auth';

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
const appTourPublicIdentity: PublicIdentity = {
  callsign: 'APP_TOUR_PLAYER',
  displayName: 'APP_TOUR_PLAYER',
  mode: 'alias'
};
const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
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
        : Promise.resolve(null)
    ])
      .then(([storedImage, storedIdentity, avatarState]) => {
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

        const parsedIdentity = parseStoredPublicIdentity(storedIdentity);
        if (parsedIdentity) {
          setPublicIdentityState(parsedIdentity);
          setHasPublicIdentity(true);
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
    setPublicIdentityState(normalized);
    setHasPublicIdentity(true);

    try {
      await userStorage?.setItem(publicIdentityStorageKey, JSON.stringify(normalized));
    } catch {
      // Keep the selected identity for the active session if persistence fails.
    }
  }, [userStorage]);

  const setIdentityMode = useCallback(async (mode: IdentityMode) => {
    const nextIdentity = normalizePublicIdentity({ ...publicIdentity, mode });
    setPublicIdentityState(nextIdentity);
    setHasPublicIdentity(true);

    try {
      await userStorage?.setItem(publicIdentityStorageKey, JSON.stringify(nextIdentity));
    } catch {
      // Keep the selected mode for the active session if persistence fails.
    }
  }, [publicIdentity, userStorage]);

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
