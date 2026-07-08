import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

const profileScreenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  },
  animation: 'slide_from_right'
} as const;

export default function ProfileLayout() {
  return (
    <Stack screenOptions={profileScreenOptions}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
