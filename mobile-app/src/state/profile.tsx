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
  defaultPublicIdentity,
  normalizePublicIdentity,
  parseStoredPublicIdentity,
  resolvePublicName,
  type IdentityMode,
  type PublicIdentity
} from '@/domain/profile';
import { createUserStorage } from '@/services/storage/userStorage';
import { useAuth } from '@/state/auth';

type ProfileContextValue = {
  hasPublicIdentity: boolean;
  identityMode: IdentityMode;
  profileImageUri: string | null;
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
  const { loading: authLoading, user } = useAuth();
  const userId = user?.uid ?? null;
  const userStorage = useMemo(
    () => userId ? createUserStorage(userId) : null,
    [userId]
  );
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [publicIdentity, setPublicIdentityState] = useState<PublicIdentity>(defaultPublicIdentity);
  const [hasPublicIdentity, setHasPublicIdentity] = useState(false);

  useEffect(() => {
    let active = true;

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
      userStorage.getItem(publicIdentityStorageKey)
    ])
      .then(([storedImage, storedIdentity]) => {
        if (!active) {
          return;
        }

        if (storedImage) {
          setProfileImageUri(storedImage);
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
  }, [authLoading, userStorage]);

  const setProfileImage = useCallback(async (uri: string) => {
    setProfileImageUri(uri);

    try {
      await userStorage?.setItem(profileImageStorageKey, uri);
    } catch {
      // Keep the selected image for the active session if persistence fails.
    }
  }, [userStorage]);

  const removeProfileImage = useCallback(async () => {
    setProfileImageUri(null);

    try {
      await userStorage?.removeItem(profileImageStorageKey);
    } catch {
      // The generated avatar is already restored for the active session.
    }
  }, [userStorage]);

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
