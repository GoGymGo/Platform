import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

const authScreenOptions = {
  animation: 'slide_from_right',
  contentStyle: {
    backgroundColor: colors.background
  },
  headerShown: false
} as const;

export default function AuthLayout() {
  return (
    <Stack screenOptions={authScreenOptions}>
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
