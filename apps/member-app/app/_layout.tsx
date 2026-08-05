import { Rajdhani_500Medium } from '@expo-google-fonts/rajdhani/500Medium';
import { Rajdhani_600SemiBold } from '@expo-google-fonts/rajdhani/600SemiBold';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, goGymGoTheme } from '@/constants/theme';
import { ScreenLoadingState } from '@/components/cyber';
import { GymScanCompletionPrompt } from '@/components/GymScanCompletionPrompt';
import { AppDataProvider } from '@/data/appDataHooks';
import { DemoModeBanner } from '@/demo/DemoModeBanner';
import { AuthProvider, useAuth } from '@/state/auth';
import { ApiProvider } from '@/state/api';
import { AppTourProvider, useAppTour } from '@/state/appTour';
import { ProfileProvider, useProfile } from '@/state/profile';
import { CompetitionRegionProvider } from '@/state/competitionRegion';
import { WorkoutProgressProvider, useWorkoutProgress } from '@/state/workoutProgress';
import { useMidSessionNotificationNavigation } from '@/hooks/useMidSessionNotificationNavigation';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { AppTourModeBanner } from '@/testing/AppTourModeBanner';

const screenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  }
} as const;

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const reduceMotion = useReducedMotionPreference();
  const [loaded, error] = useFonts({
    'Rajdhani-Medium': Rajdhani_500Medium,
    'Rajdhani-SemiBold': Rajdhani_600SemiBold,
    'Orbitron-Bold': require('../assets/fonts/Orbitron-Bold.ttf'),
    'ShareTechMono-Regular': require('../assets/fonts/ShareTechMono-Regular.ttf')
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [error, loaded]);

  if (error) {
    return (
      <View accessibilityLiveRegion="assertive" style={styles.bootScreen}>
        <Text allowFontScaling maxFontSizeMultiplier={2} style={styles.bootErrorLabel}>GOGYMGO COULD NOT START</Text>
        <Text allowFontScaling maxFontSizeMultiplier={2} style={styles.bootErrorBody}>Close and reopen the app. Your account and workout history are safe.</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.bootScreen}>
        <ActivityIndicator color={colors.cyan} size="large" />
        <Text allowFontScaling maxFontSizeMultiplier={2} style={styles.bootLabel}>LOADING GOGYMGO</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={goGymGoTheme}>
          <AppTourProvider>
            <AppRuntime reduceMotion={reduceMotion} />
          </AppTourProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppRuntime({ reduceMotion }: { reduceMotion: boolean }) {
  const { active } = useAppTour();

  return (
    <AuthProvider key={active ? 'tour' : 'app'}>
      <AuthenticatedApp reduceMotion={reduceMotion} />
    </AuthProvider>
  );
}

function AuthenticatedApp({ reduceMotion }: { reduceMotion: boolean }) {
  const { user } = useAuth();
  const accountKey = user?.uid ?? 'signed-out';
  useMidSessionNotificationNavigation();

  return (
    <ApiProvider>
      <AppDataProvider key={accountKey}>
        <ProfileProvider>
          <CompetitionRegionProvider>
            <WorkoutProgressProvider>
              <ReadyAppNavigation reduceMotion={reduceMotion} />
            </WorkoutProgressProvider>
          </CompetitionRegionProvider>
        </ProfileProvider>
      </AppDataProvider>
    </ApiProvider>
  );
}

function ReadyAppNavigation({ reduceMotion }: { reduceMotion: boolean }) {
  const { profileReady } = useProfile();
  const { progressReady } = useWorkoutProgress();

  if (!profileReady || !progressReady) {
    return <ScreenLoadingState body="Preparing your account and workout history." />;
  }

  return (
    <View style={styles.navigationRoot}>
      <StatusBar style="light" />
      <DemoModeBanner />
      <AppTourModeBanner />
      <View style={styles.stackRoot}>
        <Stack
          initialRouteName="index"
          screenOptions={{
            ...screenOptions,
            animation: reduceMotion ? 'none' : 'slide_from_right'
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="app-tour" />
          <Stack.Screen name="demo" />
          <Stack.Screen name="test-preview" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(public)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="winners-circle" />
          <Stack.Screen name="rewards/awards" />
          <Stack.Screen name="workout" />
          <Stack.Screen
            name="(modals)"
            options={{
              presentation: 'modal'
            }}
          />
        </Stack>
      </View>
      <GymScanCompletionPrompt />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  navigationRoot: {
    flex: 1,
    backgroundColor: colors.background
  },
  stackRoot: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: colors.background
  },
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.background
  },
  bootLabel: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.6
  },
  bootErrorLabel: {
    color: colors.statusError,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.4
  },
  bootErrorBody: {
    maxWidth: 320,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center'
  }
});
