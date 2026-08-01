import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

export default function SquadLayout() {
  const reduceMotion = useReducedMotionPreference();

  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: {
        backgroundColor: colors.background
      },
      animation: reduceMotion ? 'none' : 'slide_from_right'
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="gym" />
      <Stack.Screen name="social" />
    </Stack>
  );
}
