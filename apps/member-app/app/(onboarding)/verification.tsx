import { Redirect } from 'expo-router';
import { Platform } from 'react-native';

import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';

export default function RetiredVerificationSetupRedirect() {
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();

  return <Redirect href={mobileGymVerificationAvailable ? '/session' : '/home'} />;
}
