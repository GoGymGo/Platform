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
import { AppDataProvider } from '@/data/appDataHooks';
import { AuthProvider, useAuth } from '@/state/auth';
import { ApiProvider } from '@/state/api';
import { ProfileProvider } from '@/state/profile';
import { CompetitionRegionProvider } from '@/state/competitionRegion';
import { SponsorCampaignProvider } from '@/state/sponsorCampaign';
import { WorkoutProgressProvider } from '@/state/workoutProgress';
import { useMidSessionNotificationNavigation } from '@/hooks/useMidSessionNotificationNavigation';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';

const screenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  },
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
        <Text style={styles.bootErrorLabel}>GOGYMGO COULD NOT START</Text>
        <Text style={styles.bootErrorBody}>Close and reopen the app. Your account and workout history are safe.</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.bootScreen}>
        <ActivityIndicator color={colors.cyan} size="large" />
        <Text style={styles.bootLabel}>LOADING GOGYMGO</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={goGymGoTheme}>
          <AuthProvider>
            <AuthenticatedApp reduceMotion={reduceMotion} />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
              <SponsorCampaignProvider>
              <StatusBar style="light" />
              <Stack
                initialRouteName="index"
                screenOptions={{
                  ...screenOptions,
                  animation: reduceMotion ? 'none' : 'slide_from_right'
                }}
              >
                <Stack.Screen name="index" />
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
              </SponsorCampaignProvider>
            </WorkoutProgressProvider>
          </CompetitionRegionProvider>
        </ProfileProvider>
      </AppDataProvider>
    </ApiProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
