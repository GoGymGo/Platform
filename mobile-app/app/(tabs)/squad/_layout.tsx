import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

const squadScreenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  },
  animation: 'slide_from_right'
} as const;

export default function SquadLayout() {
  return (
    <Stack screenOptions={squadScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="gym" />
      <Stack.Screen name="social" />
    </Stack>
  );
}
