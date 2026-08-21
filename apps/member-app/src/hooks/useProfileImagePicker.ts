import { useCallback, useState } from 'react'

import { pickProfileImage } from '@/services/profileImage'
import { useProfile } from '@/state/profile'

export function useProfileImagePicker() {
  const {
    profileImageStatus,
    profileImageUri,
    profileImageAvailability,
    profileImageVersion,
    refreshProfileImage,
    removeProfileImage,
    setProfileImage
  } = useProfile()
  const [isPickingImage, setIsPickingImage] = useState(false)
  const [isRemovingImage, setIsRemovingImage] = useState(false)
  const [profileImageMessage, setProfileImageMessage] = useState<string | null>(
    null
  )

  const chooseProfileImage = useCallback(async () => {
    if (profileImageAvailability !== 'configured') {
      setProfileImageMessage(availabilityMessage(profileImageAvailability))
      return
    }
    setIsPickingImage(true)
    setProfileImageMessage(null)

    try {
      const result = await pickProfileImage()

      if (result.status === 'selected') {
        await setProfileImage(result.uri)
        setProfileImageMessage(
          'PROFILE PICTURE SUBMITTED. MODERATION STATUS WILL UPDATE HERE.'
        )
      } else if (result.status === 'denied') {
        setProfileImageMessage('PHOTO ACCESS IS REQUIRED TO CHOOSE A PICTURE.')
      } else if (result.status === 'error') {
        setProfileImageMessage(
          'PICTURE COULD NOT BE PREPARED. TRY ANOTHER PHOTO.'
        )
      }
    } catch (error) {
      setProfileImageMessage(
        error instanceof Error
          ? error.message.toUpperCase()
          : 'PROFILE PICTURE COULD NOT BE UPLOADED. TRY AGAIN.'
      )
    } finally {
      setIsPickingImage(false)
    }
  }, [profileImageAvailability, setProfileImage])

  const clearProfileImage = useCallback(async () => {
    setIsRemovingImage(true)
    setProfileImageMessage(null)
    try {
      await removeProfileImage()
      setProfileImageMessage('INITIALS AVATAR RESTORED.')
    } catch (error) {
      setProfileImageMessage(
        error instanceof Error
          ? error.message.toUpperCase()
          : 'PROFILE PICTURE COULD NOT BE REMOVED. TRY AGAIN.'
      )
    } finally {
      setIsRemovingImage(false)
    }
  }, [removeProfileImage])

  const retryProfileImage = useCallback(async () => {
    setProfileImageMessage(null)
    try {
      await refreshProfileImage()
    } catch {
      setProfileImageMessage('PROFILE PICTURE SERVICE IS STILL UNAVAILABLE.')
    }
  }, [refreshProfileImage])

  return {
    chooseProfileImage,
    clearProfileImage,
    isPickingImage,
    isRemovingImage,
    profileImageAvailability,
    profileImageMessage,
    profileImageStatus,
    profileImageUri,
    profileImageVersion,
    retryProfileImage
  }
}

function availabilityMessage(
  availability: ReturnType<typeof useProfile>['profileImageAvailability']
) {
  if (availability === 'loading') {
    return 'CHECKING PROFILE PICTURE AVAILABILITY.'
  }
  if (availability === 'unavailable') {
    return 'PROFILE PICTURE SERVICE COULD NOT BE REACHED. TRY AGAIN.'
  }
  return 'PROFILE PICTURE UPLOADS ARE NOT ENABLED IN THIS DEPLOYMENT.'
}
