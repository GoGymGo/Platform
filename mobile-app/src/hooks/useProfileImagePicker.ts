import { useCallback, useState } from 'react';

import { pickProfileImage } from '@/services/profileImage';
import { useProfile } from '@/state/profile';

export function useProfileImagePicker() {
  const { profileImageUri, removeProfileImage, setProfileImage } = useProfile();
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [profileImageMessage, setProfileImageMessage] = useState<string | null>(null);

  const chooseProfileImage = useCallback(async () => {
    setIsPickingImage(true);
    setProfileImageMessage(null);

    const result = await pickProfileImage();

    if (result.status === 'selected') {
      await setProfileImage(result.uri);
      setProfileImageMessage('PROFILE PICTURE SAVED.');
    } else if (result.status === 'denied') {
      setProfileImageMessage('PHOTO ACCESS IS REQUIRED TO CHOOSE A PICTURE.');
    } else if (result.status === 'error') {
      setProfileImageMessage('PICTURE COULD NOT BE PREPARED. TRY ANOTHER PHOTO.');
    }

    setIsPickingImage(false);
  }, [setProfileImage]);

  const clearProfileImage = useCallback(async () => {
    await removeProfileImage();
    setProfileImageMessage('INITIALS AVATAR RESTORED.');
  }, [removeProfileImage]);

  return {
    chooseProfileImage,
    clearProfileImage,
    isPickingImage,
    profileImageMessage,
    profileImageUri
  };
}
