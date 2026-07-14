import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

const publicScreenOptions = {
  animation: 'slide_from_right',
  contentStyle: {
    backgroundColor: colors.background
  },
  headerShown: false
} as const;

export default function PublicLayout() {
  return (
    <Stack screenOptions={publicScreenOptions}>
      <Stack.Screen name="join" />
      <Stack.Screen name="creator/apply" />
      <Stack.Screen name="gym/register" />
      <Stack.Screen name="sponsor/apply" />
    </Stack>
  );
}
