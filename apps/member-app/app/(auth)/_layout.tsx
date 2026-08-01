import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

export default function AuthLayout() {
  const reduceMotion = useReducedMotionPreference();

  return (
    <Stack screenOptions={{
      animation: reduceMotion ? 'none' : 'slide_from_right',
      contentStyle: {
        backgroundColor: colors.background
      },
      headerShown: false
    }}>
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
