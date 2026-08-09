import { Redirect, Stack, useSegments } from 'expo-router';
import { Platform } from 'react-native';

import { AuthGate } from '@/components/auth';
import { colors } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { gymScanAuthNext } from '@/navigation/gymScanFlow';
import { isMobileWebGymVerificationDevice } from '@/domain/mobileGymVerification';

export default function ModalLayout() {
  const reduceMotion = useReducedMotionPreference();
  const segments = useSegments();
  const activeRoute = segments[segments.length - 1];
  const mobileGymVerificationAvailable =
    Platform.OS !== 'web' || isMobileWebGymVerificationDevice();

  if (activeRoute === 'qr-scanner' && !mobileGymVerificationAvailable) {
    return <Redirect href="/home" />;
  }
  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background
        },
        animation: reduceMotion ? 'none' : 'slide_from_bottom'
      }}
    >
      <Stack.Screen name="bonus-rules" />
      <Stack.Screen name="biometric-camera-consent" />
      <Stack.Screen name="commitment-rules" />
      <Stack.Screen name="consent-settings" />
      <Stack.Screen name="official-rules" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="qr-scanner" />
      <Stack.Screen name="terms-of-service" />
    </Stack>
  );

  return activeRoute === 'qr-scanner' ? (
    <AuthGate
      signedOutHref={{ pathname: '/sign-in', params: { next: gymScanAuthNext } }}
      unverifiedHref={{ pathname: '/verify-email', params: { next: gymScanAuthNext } }}
    >
      {stack}
    </AuthGate>
  ) : stack;
}
