import { Stack } from 'expo-router';

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
    <Stack initialRouteName="welcome" screenOptions={onboardingScreenOptions}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="identity" />
      <Stack.Screen name="creator/invite" />
      <Stack.Screen name="creator/index" />
      <Stack.Screen name="creator/guidelines" />
      <Stack.Screen name="creator/apply" />
      <Stack.Screen name="consents" />
      <Stack.Screen name="verification" />
      <Stack.Screen name="how-it-works" />
      <Stack.Screen name="commitment" />
      <Stack.Screen name="entry-confirmed" />
    </Stack>
  );
}
