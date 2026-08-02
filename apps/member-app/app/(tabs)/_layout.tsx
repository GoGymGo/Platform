import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { AuthGate } from '@/components/auth';
import { colors, fontFamilies } from '@/constants/theme';

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
              title: 'Train',
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
      </View>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    backgroundColor: colors.background
  },
});
