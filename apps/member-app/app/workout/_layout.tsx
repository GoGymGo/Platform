import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

export default function WorkoutFlowLayout() {
  const reduceMotion = useReducedMotionPreference();

  return (
    <Stack
      screenOptions={{
        animation: reduceMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        headerShown: false
      }}
    />
  );
}
