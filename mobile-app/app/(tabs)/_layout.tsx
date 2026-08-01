import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { AuthGate } from '@/components/auth';
import { TerminalText } from '@/components/cyber';
import { colors, fontFamilies, spacing } from '@/constants/theme';
import { useWorkoutProgress } from '@/state/workoutProgress';

const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.cyan,
  tabBarInactiveTintColor: colors.dim,
  tabBarStyle: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 430 : undefined,
    alignSelf: 'center',
    height: 78,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceCyanActive,
    backgroundColor: colors.background
  },
  tabBarLabelStyle: {
    width: '100%',
    fontFamily: fontFamilies.terminal,
    fontSize: 9,
    letterSpacing: 0.2,
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  tabBarItemStyle: Platform.select({
    web: {
      minWidth: 0,
      paddingHorizontal: 0,
      outlineColor: colors.cyan
    } as unknown as ViewStyle,
    default: {
      minWidth: 0,
      paddingHorizontal: 0
    }
  })
} as const;

export default function TabsLayout() {
  const router = useRouter();
  const { activeSession } = useWorkoutProgress();

  return (
    <AuthGate>
      <View style={styles.layout}>
        <Tabs screenOptions={tabScreenOptions}>
          <Tabs.Screen
            name="home/index"
            options={{
              title: 'Home',
              tabBarAccessibilityLabel: 'Home tab',
              tabBarIcon: ({ color, focused, size }) => (
                <Ionicons color={color} name={focused ? 'home' : 'home-outline'} size={size} />
              )
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              title: 'Calendar',
              tabBarAccessibilityLabel: 'Workout calendar tab',
              tabBarIcon: ({ color, focused, size }) => (
                <Ionicons color={color} name={focused ? 'calendar' : 'calendar-outline'} size={size} />
              )
            }}
          />
          <Tabs.Screen
            name="session"
            options={{
              title: activeSession ? 'Active' : 'Train',
              tabBarBadge: activeSession ? 'LIVE' : undefined,
              tabBarBadgeStyle: styles.liveBadge,
              tabBarAccessibilityLabel: 'Training tab',
              tabBarIcon: ({ color, focused }) => (
                <Ionicons color={color} name={focused ? 'play-circle' : 'play-circle-outline'} size={30} />
              )
            }}
          />
          <Tabs.Screen
            name="leaderboard"
            options={{
              title: 'Compete',
              tabBarAccessibilityLabel: 'Competition tab',
              tabBarIcon: ({ color, focused, size }) => (
                <Ionicons color={color} name={focused ? 'trophy' : 'trophy-outline'} size={size} />
              )
            }}
          />
          <Tabs.Screen
            name="workouts"
            options={{
              href: null,
              title: 'Workouts'
            }}
          />
          <Tabs.Screen
            name="squad"
            options={{
              href: null,
              title: 'Weekly Challenge'
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Me',
              tabBarAccessibilityLabel: 'Profile tab',
              tabBarIcon: ({ color, focused, size }) => (
                <Ionicons color={color} name={focused ? 'person' : 'person-outline'} size={size} />
              )
            }}
          />
        </Tabs>
        {activeSession ? (
          <Pressable
            accessibilityHint="Return to the active workout timer"
            accessibilityRole="button"
            onPress={() => router.push('/workout/active')}
            style={({ pressed }) => [styles.activeBanner, pressed ? styles.pressed : null]}
          >
            <View style={styles.liveDot} />
            <View style={styles.activeCopy}>
              <TerminalText glow tone="green" variant="micro">
                SESSION ACTIVE
              </TerminalText>
              <TerminalText tone="text" uppercase={false} variant="body">
                Tap to return to your timer and verification status.
              </TerminalText>
            </View>
            <TerminalText glow tone="cyan" variant="button">
              -&gt;
            </TerminalText>
          </Pressable>
        ) : null}
      </View>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    backgroundColor: colors.background
  },
  liveBadge: {
    color: colors.textOnPrimary,
    backgroundColor: colors.statusSuccess,
    fontFamily: fontFamilies.terminal,
    fontSize: 9
  },
  activeBanner: {
    position: 'absolute',
    right: spacing.md,
    bottom: 82,
    left: spacing.md,
    zIndex: 20,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSuccessGlow,
    borderRadius: 12,
    backgroundColor: colors.panelAlpha84
  },
  activeCopy: {
    minWidth: 0,
    flex: 1
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.statusSuccess
  },
  pressed: {
    opacity: 0.72
  }
});
