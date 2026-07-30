import { Stack, useSegments } from 'expo-router';

import { AuthGate } from '@/components/auth';
import { colors } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

export default function ModalLayout() {
  const reduceMotion = useReducedMotionPreference();
  const segments = useSegments();
  const activeRoute = segments[segments.length - 1];
  const stack = (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: {
        backgroundColor: colors.background
      },
      animation: reduceMotion ? 'none' : 'slide_from_bottom'
    }}>
      <Stack.Screen name="bonus-rules" />
      <Stack.Screen name="biometric-camera-consent" />
      <Stack.Screen name="commitment-rules" />
      <Stack.Screen name="consent-settings" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="qr-scanner" />
      <Stack.Screen name="sponsor-offer" />
      <Stack.Screen name="terms-of-service" />
    </Stack>
  );

  return activeRoute === 'qr-scanner' ? <AuthGate>{stack}</AuthGate> : stack;
}
