import { Rajdhani_500Medium } from '@expo-google-fonts/rajdhani/500Medium';
import { Rajdhani_600SemiBold } from '@expo-google-fonts/rajdhani/600SemiBold';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, goGymGoTheme } from '@/constants/theme';
import { AppDataProvider } from '@/data/appDataHooks';
import { AuthProvider, useAuth } from '@/state/auth';
import { ApiProvider } from '@/state/api';
import { ProfileProvider } from '@/state/profile';
import { CompetitionRegionProvider } from '@/state/competitionRegion';
import { DemoEnrollmentProvider } from '@/state/demoEnrollment';
import { SponsorCampaignProvider } from '@/state/sponsorCampaign';
import { WorkoutProgressProvider } from '@/state/workoutProgress';

const screenOptions = {
  headerShown: false,
  contentStyle: {
    backgroundColor: colors.background
  },
  animation: 'slide_from_right'
} as const;

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Rajdhani-Medium': Rajdhani_500Medium,
    'Rajdhani-SemiBold': Rajdhani_600SemiBold,
    'Orbitron-Bold': require('../assets/fonts/Orbitron-Bold.ttf'),
    'ShareTechMono-Regular': require('../assets/fonts/ShareTechMono-Regular.ttf')
  });

  useEffect(() => {
    if (error) {
      throw error;
    }
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [error, loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={goGymGoTheme}>
          <AuthProvider>
            <AuthenticatedApp />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const accountKey = user?.uid ?? 'signed-out';

  return (
    <ApiProvider>
      <AppDataProvider key={accountKey}>
        <ProfileProvider key={`profile-${accountKey}`}>
          <CompetitionRegionProvider>
            <DemoEnrollmentProvider>
              <WorkoutProgressProvider>
                <SponsorCampaignProvider>
              <StatusBar style="light" />
              <Stack initialRouteName="index" screenOptions={screenOptions}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(public)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="winners-circle" />
                <Stack.Screen name="payout-winner" />
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
            </DemoEnrollmentProvider>
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
  }
});
