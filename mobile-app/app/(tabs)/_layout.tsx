import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View, type ColorValue, type ViewStyle } from 'react-native';

import { AuthGate } from '@/components/auth';
import {
  borders,
  colors,
  componentSizes,
  fontFamilies,
  fontSizes,
  interactionStates,
  spacing
} from '@/constants/theme';

const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.cyan,
  tabBarInactiveTintColor: colors.dim,
  tabBarStyle: {
    height: componentSizes.tabBarHeight,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: borders.hairline,
    borderTopColor: colors.borderDefault,
    backgroundColor: colors.surfaceRaised,
    ...(Platform.select<ViewStyle>({
      web: {
        width: '100%',
        maxWidth: componentSizes.screenMaxWidth,
        alignSelf: 'center'
      },
      default: {}
    }) ?? {})
  },
  tabBarLabelStyle: {
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.micro,
    letterSpacing: 1.1,
    textTransform: 'uppercase'
  },
  tabBarItemStyle: Platform.select({
    web: interactionStates.webFocus as unknown as ViewStyle,
    default: { minHeight: componentSizes.minimumTouchTarget }
  }),
  tabBarActiveBackgroundColor: colors.surfaceCyanGhost
} as const;

export default function TabsLayout() {
  return (
    <AuthGate>
      <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabGlyph color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, focused }) => <TabGlyph color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: 'Session',
          tabBarIcon: ({ color, focused }) => (
            <SessionGlyph color={color} focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ color, focused }) => <TabGlyph color={color} focused={focused} />
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
          title: 'Period Match',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabGlyph color={color} focused={focused} />
        }}
      />
      </Tabs>
    </AuthGate>
  );
}

function TabGlyph({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View
      style={[
        styles.glyph,
        {
          backgroundColor: focused ? color : colors.transparent,
          borderColor: color
        }
      ]}
    />
  );
}

function SessionGlyph({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View
      style={[
        styles.sessionGlyph,
        focused ? styles.sessionGlyphActive : null,
        {
          borderColor: color
        }
      ]}
    >
      <View style={[styles.sessionGlyphCore, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    width: componentSizes.iconSmall,
    height: 5,
    borderWidth: 1,
    borderRadius: 5
  },
  sessionGlyph: {
    width: componentSizes.iconMedium,
    height: componentSizes.iconMedium,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: colors.surfaceCyanGhost
  },
  sessionGlyphActive: {
    backgroundColor: colors.surfaceCyanActive
  },
  sessionGlyphCore: {
    width: 9,
    height: 9,
    borderRadius: 5
  }
});
