import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

export default function PublicLayout() {
  const reduceMotion = useReducedMotionPreference();

  return (
    <Stack screenOptions={{
      animation: reduceMotion ? 'none' : 'slide_from_right',
      contentStyle: {
        backgroundColor: colors.background
      },
      headerShown: false
    }}>
      <Stack.Screen name="join" />
      <Stack.Screen name="creator/apply" />
      <Stack.Screen name="gym/register" />
      <Stack.Screen name="sponsor/apply" />
    </Stack>
  );
}
