import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

const workoutsScreenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  },
  animation: 'slide_from_right'
} as const;

export default function WorkoutsLayout() {
  return (
    <Stack screenOptions={workoutsScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[workoutId]" />
    </Stack>
  );
}
