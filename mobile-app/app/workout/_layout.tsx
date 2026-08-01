import { Stack } from 'expo-router';

import { AuthGate } from '@/components/auth';
import { colors } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

export default function WorkoutLayout() {
  const reduceMotion = useReducedMotionPreference();

  return (
    <AuthGate>
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background
        },
        animation: reduceMotion ? 'none' : 'slide_from_right'
      }}>
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
