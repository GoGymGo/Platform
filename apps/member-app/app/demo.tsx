import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { buildDemoHref, demoRoutes } from '@/demo/demoRoutes';
import { useAppTour } from '@/state/appTour';

export default function DemoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ complete?: string | string[] }>();
  const { enterDemo, exitTour } = useAppTour();
  const complete = firstParam(params.complete) === '1';

  if (Platform.OS !== 'web') {
    return <Redirect href="/join" />;
  }

  function startDemo() {
    const firstRoute = demoRoutes[0];
    if (!firstRoute) {
      return;
    }

    enterDemo(firstRoute.scenario ?? 'ready');
    router.replace(buildDemoHref(firstRoute));
  }

  function leaveDemo() {
    exitTour();
    router.replace('/join');
  }

  return (
    <ScreenContainer>
      <View accessibilityRole="header" style={styles.demoBanner}>
        <TerminalText glow tone="pink" variant="label">
          DEMO // DUMMY DATA // NO ACCOUNT REQUIRED
        </TerminalText>
      </View>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <TerminalText glow tone={complete ? 'green' : 'cyan'} variant="label">
            {complete ? 'DEMO COMPLETE' : 'REAL MEMBER APP WALKTHROUGH'}
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            {complete ? 'YOU SAW GOGYMGO' : 'SEE THE ACTUAL APP'}
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            Every step opens the same production screen used by app.gogymgo.com.
            The only difference is that the account, workouts, rankings and
            rewards are filled with clearly marked sample data.
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.safety} tone="green">
          <TerminalText glow tone="green" variant="label">
            SAFE PUBLIC DEMO
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            No sign-in, account creation, camera, location or live GoGymGo data
            is used. Demo actions stay in memory and disappear when you leave.
          </TerminalText>
        </HUDBorderBox>

        <HUDBorderBox style={styles.directory} tone="cyan">
          <View style={styles.directoryHeader}>
            <TerminalText glow tone="cyan" variant="label">
              {demoRoutes.length} REAL APP SCREENS
            </TerminalText>
            <TerminalText tone="dim" variant="micro">
              USE NEXT ON EVERY SCREEN
            </TerminalText>
          </View>
          <View style={styles.routeList}>
            {demoRoutes.map((route, index) => (
              <View key={route.route} style={styles.routeRow}>
                <TerminalText tone="cyan" variant="micro">
                  {String(index + 1).padStart(2, '0')}
                </TerminalText>
                <TerminalText style={styles.routeLabel} tone="text" uppercase={false} variant="body">
                  {route.label}
                </TerminalText>
              </View>
            ))}
          </View>
        </HUDBorderBox>

        <View style={styles.actions}>
          <CyberButtonPrimary
            label={complete ? 'RUN DEMO AGAIN ->' : 'START WITH HOME ->'}
            onPress={startDemo}
            tone={complete ? 'green' : 'cyan'}
          />
          <CyberButtonOutline
            label="EXIT DEMO"
            onPress={leaveDemo}
            tone="amber"
          />
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  demoBanner: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPinkHeavy,
    backgroundColor: colors.surfacePinkSoft
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  intro: {
    alignItems: 'center',
    gap: spacing.sm
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle,
    textAlign: 'center'
  },
  body: {
    width: '100%',
    maxWidth: 520,
    textAlign: 'center'
  },
  safety: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    gap: spacing.sm,
    padding: spacing.lg
  },
  directory: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    gap: spacing.md,
    padding: spacing.lg
  },
  directoryHeader: {
    gap: spacing.xs
  },
  routeList: {
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted
  },
  routeRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted
  },
  routeLabel: {
    minWidth: 0,
    flex: 1
  },
  actions: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    gap: spacing.md
  }
});
