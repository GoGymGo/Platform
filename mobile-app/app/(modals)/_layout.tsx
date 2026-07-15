import { Stack, useSegments } from 'expo-router';

import { AuthGate } from '@/components/auth';
import { colors } from '@/constants/theme';

const modalScreenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  },
  animation: 'slide_from_bottom'
} as const;

export default function ModalLayout() {
  const segments = useSegments();
  const activeRoute = segments[segments.length - 1];
  const stack = (
    <Stack screenOptions={modalScreenOptions}>
      <Stack.Screen name="bonus-rules" />
      <Stack.Screen name="biometric-camera-consent" />
      <Stack.Screen name="commitment-rules" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="qr-scanner" />
      <Stack.Screen name="sponsor-offer" />
      <Stack.Screen name="terms-of-service" />
    </Stack>
  );

  return activeRoute === 'qr-scanner' ? <AuthGate>{stack}</AuthGate> : stack;
}
