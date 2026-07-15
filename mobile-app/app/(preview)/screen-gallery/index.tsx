import { Redirect, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenContainer, ScreenScrollView, TerminalText } from '@/components/cyber';
import { colors, fontFamilies, radii, spacing } from '@/constants/theme';

type GalleryScreen = {
  label: string;
  path: string;
};

type GalleryGroup = {
  screens: readonly GalleryScreen[];
  title: string;
};

const screenGroups: readonly GalleryGroup[] = [
  {
    title: 'START AND ACCOUNT',
    screens: [
      { label: 'Create Account Home', path: '/' },
      { label: 'Choose How to Join', path: '/join' },
      { label: 'Sign Up', path: '/sign-up' },
      { label: 'Sign In', path: '/sign-in' },
      { label: 'Verify Email', path: '/verify-email?next=identity' },
      { label: 'Forgot Password', path: '/forgot-password' }
    ]
  },
  {
    title: 'ONBOARDING',
    screens: [
      { label: 'Public Identity', path: '/identity' },
      { label: 'Competition Region', path: '/region' },
      { label: 'Permissions', path: '/consents' },
      { label: 'Workout Verification', path: '/verification' },
      { label: 'How Scoring Works', path: '/how-it-works' },
      { label: 'Commitment and Calculator', path: '/commitment' },
      { label: 'Entry Confirmed', path: '/entry-confirmed' }
    ]
  },
  {
    title: 'CREATOR',
    screens: [
      { label: 'Creator Application', path: '/creator/apply' },
      { label: 'Creator Workouts', path: '/workouts' },
      {
        label: 'Creator Workout Detail',
        path: '/workouts/toronto-creator-workout'
      }
    ]
  },
  {
    title: 'MAIN APP',
    screens: [
      { label: 'Home', path: '/home' },
      { label: 'Workout Calendar', path: '/calendar' },
      { label: 'Leaderboard', path: '/leaderboard' },
      { label: 'Winners Circle', path: '/winners-circle' },
      { label: 'Winner Payout Alert', path: '/payout-winner' },
      { label: 'Hyperwallet Payout Account', path: '/profile/payout' },
      { label: 'Prize Draw', path: '/leaderboard/draw' },
      { label: 'Start Session', path: '/session' },
      { label: 'Period Match', path: '/squad' },
      { label: 'Partner Gyms', path: '/squad/gym' },
      { label: 'Profile', path: '/profile' }
    ]
  },
  {
    title: 'WORKOUT FLOW',
    screens: [
      { label: 'Choose Verification Method', path: '/workout/method' },
      { label: 'Workout Check In', path: '/workout/check-in' },
      { label: 'Identity Check', path: '/workout/identity-check' },
      { label: 'Active Workout', path: '/workout/active' },
      { label: 'Random Verification', path: '/workout/ping' },
      { label: 'Verification Success', path: '/workout/ping-success' },
      { label: 'Workout Check Out', path: '/workout/check-out' },
      { label: 'Workout Complete', path: '/workout/complete' }
    ]
  },
  {
    title: 'RULES, OFFERS AND LEGAL',
    screens: [
      { label: 'Bonus Rules', path: '/bonus-rules' },
      { label: 'Commitment Rules', path: '/commitment-rules' },
      { label: 'Sponsor Offer', path: '/sponsor-offer' },
      { label: 'QR Scanner', path: '/qr-scanner' },
      { label: 'Camera Consent', path: '/biometric-camera-consent' },
      { label: 'Privacy Policy', path: '/privacy-policy' },
      { label: 'Terms of Service', path: '/terms-of-service' },
      { label: 'Sponsor Application', path: '/sponsor/apply' },
      { label: 'Gym QR Registration', path: '/gym/register' }
    ]
  }
];

export default function ScreenGallery() {
  const router = useRouter();

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TerminalText tone="dim" variant="micro">
            DESIGN PREVIEW // DEVELOPMENT ONLY
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            SCREEN GALLERY
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Open any GoGymGo screen directly. Use the Integrated Browser back button
            to return to this gallery.
          </TerminalText>
        </View>

        {screenGroups.map((group) => (
          <View key={group.title} style={styles.group}>
            <TerminalText glow tone="cyan" variant="label">
              {group.title}
            </TerminalText>
            <View style={styles.screenList}>
              {group.screens.map((screen) => (
                <Pressable
                  accessibilityRole="button"
                  key={screen.path}
                  onPress={() => router.push(screen.path as Href)}
                  style={({ pressed }) => [
                    styles.screenRow,
                    pressed ? styles.screenRowPressed : null
                  ]}
                >
                  <View style={styles.screenCopy}>
                    <TerminalText tone="text" uppercase={false} variant="body">
                      {screen.label}
                    </TerminalText>
                    <TerminalText tone="dim" uppercase={false} variant="micro">
                      {screen.path}
                    </TerminalText>
                  </View>
                  <TerminalText glow tone="cyan" variant="button">
                    {'->'}
                  </TerminalText>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  header: {
    gap: spacing.sm
  },
  title: {
    fontFamily: fontFamilies.display
  },
  group: {
    gap: spacing.sm
  },
  screenList: {
    borderTopWidth: 1,
    borderColor: colors.borderCyanSubtle
  },
  screenRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.borderCyanSubtle,
    borderRadius: radii.sm,
    backgroundColor: colors.panelAlpha70
  },
  screenRowPressed: {
    borderColor: colors.borderCyanBright,
    backgroundColor: colors.surfaceCyanActive
  },
  screenCopy: {
    flex: 1,
    gap: 2
  }
});
