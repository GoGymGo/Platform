import { Stack } from 'expo-router';

import { AuthGate } from '@/components/auth';
import { colors } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

export default function OnboardingLayout() {
  const reduceMotion = useReducedMotionPreference();

  return (
    <AuthGate>
      <Stack
        initialRouteName="identity"
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background
          },
          animation: reduceMotion ? 'none' : 'slide_from_right'
        }}
      >
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
