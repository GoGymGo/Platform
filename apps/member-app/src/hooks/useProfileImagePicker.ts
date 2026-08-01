import { useCallback, useState } from 'react';

import { pickProfileImage } from '@/services/profileImage';
import { useProfile } from '@/state/profile';

export function useProfileImagePicker() {
  const {
    profileImageStatus,
    profileImageUri,
    removeProfileImage,
    setProfileImage
  } = useProfile();
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [profileImageMessage, setProfileImageMessage] = useState<string | null>(null);

  const chooseProfileImage = useCallback(async () => {
    setIsPickingImage(true);
    setProfileImageMessage(null);

    try {
      const result = await pickProfileImage();

      if (result.status === 'selected') {
        await setProfileImage(result.uri);
        setProfileImageMessage('PROFILE PICTURE SUBMITTED. MODERATION STATUS WILL UPDATE HERE.');
      } else if (result.status === 'denied') {
        setProfileImageMessage('PHOTO ACCESS IS REQUIRED TO CHOOSE A PICTURE.');
      } else if (result.status === 'error') {
        setProfileImageMessage('PICTURE COULD NOT BE PREPARED. TRY ANOTHER PHOTO.');
      }
    } catch (error) {
      setProfileImageMessage(
        error instanceof Error
          ? error.message.toUpperCase()
          : 'PROFILE PICTURE COULD NOT BE UPLOADED. TRY AGAIN.'
      );
    } finally {
      setIsPickingImage(false);
    }
  }, [setProfileImage]);

  const clearProfileImage = useCallback(async () => {
    try {
      await removeProfileImage();
      setProfileImageMessage('INITIALS AVATAR RESTORED.');
    } catch (error) {
      setProfileImageMessage(
        error instanceof Error
          ? error.message.toUpperCase()
          : 'PROFILE PICTURE COULD NOT BE REMOVED. TRY AGAIN.'
      );
    }
  }, [removeProfileImage]);

  return {
    chooseProfileImage,
    clearProfileImage,
    isPickingImage,
    profileImageMessage,
    profileImageStatus,
    profileImageUri
  };
}
