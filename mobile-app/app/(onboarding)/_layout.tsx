import { Stack } from 'expo-router';

import { AuthGate } from '@/components/auth';
import { colors } from '@/constants/theme';

const onboardingScreenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  },
  animation: 'slide_from_right'
} as const;

export default function OnboardingLayout() {
  return (
    <AuthGate>
      <Stack initialRouteName="identity" screenOptions={onboardingScreenOptions}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="identity" />
        <Stack.Screen name="region" />
        <Stack.Screen name="consents" />
        <Stack.Screen name="verification" />
        <Stack.Screen name="how-it-works" />
        <Stack.Screen name="commitment" />
        <Stack.Screen name="entry-confirmed" />
      </Stack>
    </AuthGate>
  );
}
