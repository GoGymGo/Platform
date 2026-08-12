import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';

import { colors } from '@/constants/theme';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

export default function WorkoutFlowLayout() {
  const reduceMotion = useReducedMotionPreference();
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();

  if (!mobileGymVerificationAvailable) {
    return <Redirect href="/home" />;
  }

  return (
    <Stack
      screenOptions={{
        animation: reduceMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        headerShown: false
      }}
    />
  );
}
