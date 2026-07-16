import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

const leaderboardScreenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  },
  animation: 'slide_from_right'
} as const;

export default function LeaderboardLayout() {
  return (
    <Stack screenOptions={leaderboardScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="rewards" />
    </Stack>
  );
}
