import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AppState } from 'react-native'

import {
  createPrivateIdentity,
  normalizePublicIdentity,
  parseStoredPublicIdentity,
  publicIdentityFromAccountProfile,
  resolvePublicName,
  type IdentityMode,
  type PublicIdentity
} from '@/domain/profile'
import { useAppData } from '@/data/appDataHooks'
import type { AccountSettingsRepository } from '@/data/accountSettingsRepository'
import type { AvatarCapabilities, AvatarMedia } from '@/domain/accountSettings'
import { createUserStorage } from '@/services/storage/userStorage'
import { useAppTour } from '@/state/appTour'
import { useAuth } from '@/state/auth'
import { appTourPublicIdentity } from '@/testing/appTourData'

type ProfileContextValue = {
  hasPublicIdentity: boolean
  identityMode: IdentityMode
  profileImageUri: string | null
  profileImageStatus: AvatarMedia['status'] | 'local' | null
  profileImageAvailability:
    AvatarCapabilities['status'] | 'loading' | 'unavailable'
  profileImageVersion: string | null
  profileReady: boolean
  publicIdentity: PublicIdentity
  publicName: string
  removeProfileImage: () => Promise<void>
  refreshProfileImage: () => Promise<void>
  setIdentityMode: (mode: IdentityMode) => Promise<void>
  setProfileImage: (uri: string) => Promise<void>
  setPublicIdentity: (identity: PublicIdentity) => Promise<void>
}

const profileImageStorageKey = '@gogymgo/profile-image'
const publicIdentityStorageKey = '@gogymgo/public-identity'
const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const { accountSettings, mode } = useAppData()
  const { active: appTourActive } = useAppTour()
  const { loading: authLoading, user } = useAuth()
  const userId = user?.uid ?? null
  const userStorage = useMemo(
    () => (userId ? createUserStorage(userId) : null),
    [userId]
  )
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)
  const [profileImageStatus, setProfileImageStatus] = useState<
    AvatarMedia['status'] | 'local' | null
  >(null)
  const [profileImageAvailability, setProfileImageAvailability] = useState<
    ProfileContextValue['profileImageAvailability']
  >(appTourActive ? 'configured' : 'loading')
  const [profileImageVersion, setProfileImageVersion] = useState<string | null>(
    null
  )
  const [profileReady, setProfileReady] = useState(appTourActive)
  const [publicIdentity, setPublicIdentityState] = useState<PublicIdentity>(
    appTourActive ? appTourPublicIdentity : createPrivateIdentity(userId)
  )
  const [hasPublicIdentity, setHasPublicIdentity] = useState(appTourActive)

  useEffect(() => {
    let active = true

    if (appTourActive) {
      return () => {
        active = false
      }
    }

    if (authLoading) {
      return () => {
        active = false
      }
    }

    if (!userStorage) {
      void Promise.resolve().then(() => {
        if (active) {
          setProfileReady(true)
        }
      })
      return () => {
        active = false
      }
    }

    void Promise.all([
      userStorage.getItem(profileImageStorageKey),
      userStorage.getItem(publicIdentityStorageKey),
      mode === 'api'
        ? getProfileMediaSnapshot(accountSettings)
        : Promise.resolve(null),
      mode === 'api'
        ? accountSettings.getProfile().catch(() => null)
        : Promise.resolve(null)
    ])
      .then(([storedImage, storedIdentity, mediaSnapshot, accountProfile]) => {
        if (!active) {
          return
        }

        if (mode === 'api') {
          const avatarState = mediaSnapshot?.state ?? null
          setProfileImageUri(avatarState?.active?.readUrl ?? null)
          setProfileImageVersion(
            avatarState?.active
              ? `${avatarState.active.id}:${avatarState.active.version}`
              : null
          )
          setProfileImageStatus(
            avatarState?.latest?.status ?? avatarState?.active?.status ?? null
          )
          setProfileImageAvailability(
            mediaSnapshot?.availability ?? 'unavailable'
          )
        } else {
          setProfileImageUri(storedImage)
          setProfileImageStatus(storedImage ? 'local' : null)
          setProfileImageVersion(storedImage ? 'local' : null)
          setProfileImageAvailability('configured')
        }

        const serverIdentity = accountProfile
          ? publicIdentityFromAccountProfile(accountProfile)
          : null
        const parsedIdentity = parseStoredPublicIdentity(storedIdentity)
        const restoredIdentity = serverIdentity ?? parsedIdentity
        if (restoredIdentity) {
          setPublicIdentityState(restoredIdentity)
          setHasPublicIdentity(true)
          if (serverIdentity) {
            void userStorage
              .setItem(publicIdentityStorageKey, JSON.stringify(serverIdentity))
              .catch(() => {
                // The server remains authoritative if the local cache cannot refresh.
              })
          }
        }
      })
      .catch(() => {
        // Generated profile defaults remain available when storage cannot be read.
        setProfileImageAvailability('unavailable')
      })
      .finally(() => {
        if (active) {
          setProfileReady(true)
        }
      })

    return () => {
      active = false
    }
  }, [accountSettings, appTourActive, authLoading, mode, userStorage])

  useEffect(() => {
    if (appTourActive || authLoading || mode !== 'api' || !userId) {
      return undefined
    }

    let active = true
    const synchronize = () => {
      void Promise.all([
        accountSettings.getProfile().catch(() => null),
        getProfileMediaSnapshot(accountSettings)
      ])
        .then(([profile, mediaSnapshot]) => {
          if (!active) return
          if (profile) {
            const identity = publicIdentityFromAccountProfile(profile)
            setPublicIdentityState(identity)
            setHasPublicIdentity(true)
            void userStorage
              ?.setItem(publicIdentityStorageKey, JSON.stringify(identity))
              .catch(() => {
                // The active server identity remains available in memory.
              })
          }
          if (mediaSnapshot.state) {
            const avatarState = mediaSnapshot.state
            setProfileImageUri(avatarState.active?.readUrl ?? null)
            setProfileImageVersion(
              avatarState.active
                ? `${avatarState.active.id}:${avatarState.active.version}`
                : null
            )
            setProfileImageStatus(
              avatarState.latest?.status ?? avatarState.active?.status ?? null
            )
          }
          setProfileImageAvailability(mediaSnapshot.availability)
        })
        .catch(() => {
          // Keep the last synchronized identity while the API is unreachable.
        })
    }
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') synchronize()
    })

    return () => {
      active = false
      subscription.remove()
    }
  }, [accountSettings, appTourActive, authLoading, mode, userId, userStorage])

  const setProfileImage = useCallback(
    async (uri: string) => {
      if (mode === 'api') {
        if (profileImageAvailability !== 'configured') {
          throw new Error('Profile picture uploads are not available.')
        }
        const result = await accountSettings.uploadAvatar(uri)
        setProfileImageStatus(result.status)
        setProfileImageUri(result.state.active?.readUrl ?? null)
        setProfileImageVersion(
          result.state.active
            ? `${result.state.active.id}:${result.state.active.version}`
            : null
        )
      } else {
        setProfileImageStatus('local')
        setProfileImageUri(uri)
        setProfileImageVersion('local')
        await userStorage?.setItem(profileImageStorageKey, uri)
      }
    },
    [accountSettings, mode, profileImageAvailability, userStorage]
  )

  const removeProfileImage = useCallback(async () => {
    try {
      if (mode === 'api') {
        await accountSettings.removeAvatar()
      } else {
        await userStorage?.removeItem(profileImageStorageKey)
      }
      setProfileImageUri(null)
      setProfileImageStatus(null)
      setProfileImageVersion(null)
    } catch (error) {
      throw error
    }
  }, [accountSettings, mode, userStorage])

  const refreshProfileImage = useCallback(async () => {
    if (mode !== 'api') return
    setProfileImageAvailability('loading')
    try {
      const capabilities = await accountSettings.getAvatarCapabilities()
      const state = await accountSettings.getAvatar()
      setProfileImageAvailability(capabilities.status)
      setProfileImageUri(state.active?.readUrl ?? null)
      setProfileImageVersion(
        state.active ? `${state.active.id}:${state.active.version}` : null
      )
      setProfileImageStatus(
        state.latest?.status ?? state.active?.status ?? null
      )
    } catch (error) {
      setProfileImageAvailability('unavailable')
      throw error
    }
  }, [accountSettings, mode])

  const setPublicIdentity = useCallback(
    async (identity: PublicIdentity) => {
      const normalized = normalizePublicIdentity(identity)
      const synchronized =
        mode === 'api'
          ? publicIdentityFromAccountProfile(
              await accountSettings.updateProfile({
                publicIdentityMode: normalized.mode,
                publicName:
                  normalized.mode === 'private' ? null : normalized.displayName,
                ...(normalized.mode === 'alias'
                  ? { screenName: normalized.displayName }
                  : {})
              })
            )
          : normalized
      setPublicIdentityState(synchronized)
      setHasPublicIdentity(true)
      void queryClient.invalidateQueries({
        queryKey: ['social', userId ?? 'anonymous']
      })

      try {
        await userStorage?.setItem(
          publicIdentityStorageKey,
          JSON.stringify(synchronized)
        )
      } catch {
        // Keep the selected identity for the active session if persistence fails.
      }
    },
    [accountSettings, mode, queryClient, userId, userStorage]
  )

  const setIdentityMode = useCallback(
    async (nextMode: IdentityMode) => {
      const nextIdentity = normalizePublicIdentity({
        ...publicIdentity,
        mode: nextMode
      })
      const synchronized =
        mode === 'api'
          ? publicIdentityFromAccountProfile(
              await accountSettings.updateProfile({
                publicIdentityMode: nextIdentity.mode,
                publicName:
                  nextIdentity.mode === 'private'
                    ? null
                    : nextIdentity.displayName
              })
            )
          : nextIdentity
      setPublicIdentityState(synchronized)
      setHasPublicIdentity(true)
      void queryClient.invalidateQueries({
        queryKey: ['social', userId ?? 'anonymous']
      })

      try {
        await userStorage?.setItem(
          publicIdentityStorageKey,
          JSON.stringify(synchronized)
        )
      } catch {
        // Keep the selected mode for the active session if persistence fails.
      }
    },
    [accountSettings, mode, publicIdentity, queryClient, userId, userStorage]
  )

  const publicName = resolvePublicName(publicIdentity)
  const value = useMemo<ProfileContextValue>(
    () => ({
      hasPublicIdentity,
      identityMode: publicIdentity.mode,
      profileImageUri,
      profileImageStatus,
      profileImageAvailability,
      profileImageVersion,
      profileReady,
      publicIdentity,
      publicName,
      removeProfileImage,
      refreshProfileImage,
      setIdentityMode,
      setProfileImage,
      setPublicIdentity
    }),
    [
      hasPublicIdentity,
      profileImageUri,
      profileImageStatus,
      profileImageAvailability,
      profileImageVersion,
      profileReady,
      publicIdentity,
      publicName,
      removeProfileImage,
      refreshProfileImage,
      setIdentityMode,
      setProfileImage,
      setPublicIdentity
    ]
  )

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  )
}

async function getProfileMediaSnapshot(
  accountSettings: AccountSettingsRepository
): Promise<{
  availability: ProfileContextValue['profileImageAvailability']
  state: Awaited<ReturnType<AccountSettingsRepository['getAvatar']>> | null
}> {
  let capabilities
  try {
    capabilities = await accountSettings.getAvatarCapabilities()
  } catch {
    return { availability: 'unavailable', state: null }
  }
  try {
    return {
      availability: capabilities.status,
      state: await accountSettings.getAvatar()
    }
  } catch {
    return { availability: 'unavailable', state: null }
  }
}

export function useProfile() {
  const context = useContext(ProfileContext)

  if (!context) {
    throw new Error('useProfile must be used inside ProfileProvider')
  }

  return context
}
