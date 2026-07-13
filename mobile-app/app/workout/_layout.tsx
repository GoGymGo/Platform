import { Stack } from 'expo-router';

import { AuthGate } from '@/components/auth';
import { colors } from '@/constants/theme';

const workoutScreenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  },
  animation: 'slide_from_right'
} as const;

export default function WorkoutLayout() {
  return (
    <AuthGate>
      <Stack screenOptions={workoutScreenOptions}>
        <Stack.Screen name="method" />
        <Stack.Screen name="check-in" />
        <Stack.Screen name="identity-check" />
        <Stack.Screen name="active" />
        <Stack.Screen name="ping" />
        <Stack.Screen name="ping-success" />
        <Stack.Screen name="check-out" />
        <Stack.Screen name="complete" />
      </Stack>
    </AuthGate>
  );
}
