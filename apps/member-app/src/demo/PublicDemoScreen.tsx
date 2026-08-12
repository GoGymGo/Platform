import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { GoGymGoWordmark } from '@/components/brandWordmark';
import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { useAppTour } from '@/state/appTour';
import {
  buildAppTourHref,
  publicDemoRoutes,
  type AppTourRoute
} from '@/testing/appTourRoutes';

export default function PublicDemoScreen() {
  const router = useRouter();
  const { enterTour, exitTour } = useAppTour();
  const startRoute = publicDemoRoutes[0];

  function openRoute(route: AppTourRoute) {
    enterTour(route.scenario ?? 'ready');
    router.push(buildAppTourHref(route, 'demo'));
  }

  function joinBeta() {
    exitTour();
    router.replace('/join');
  }

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandRow}>
          <GoGymGoWordmark compact glow />
          <TerminalText glow tone="green" variant="micro">
            INTERACTIVE DEMO
          </TerminalText>
        </View>

        <View style={styles.hero}>
          <TerminalText glow tone="pink" variant="label">
            THE REAL APP UI // READ-ONLY SHOWCASE
          </TerminalText>
          <TerminalText glow style={styles.title} tone="cyan" variant="title">
            EXPLORE GOGYMGO
          </TerminalText>
          <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
            Tour ten core product screens built from the same components used by
            the browser, iPhone and Android apps. Demo actions use isolated sample
            data and never create an account or contact live GoGymGo services.
          </TerminalText>
        </View>

        <HUDBorderBox glow style={styles.startPanel} tone="cyan">
          <View style={styles.startCopy}>
            <TerminalText tone="cyan" variant="micro">
              RECOMMENDED START
            </TerminalText>
            <TerminalText glow tone="text" variant="label">
              {"HOME // TODAY'S OBJECTIVE"}
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              See weekly progress, the next Verified workout action and the
              contest snapshot in the updated interface.
            </TerminalText>
          </View>
          <CyberButtonPrimary
            disabled={!startRoute}
            label="START THE DEMO ->"
            onPress={() => startRoute && openRoute(startRoute)}
          />
        </HUDBorderBox>

        <View style={styles.directoryHeading}>
          <View style={styles.directoryCopy}>
            <TerminalText glow tone="green" variant="label">
              SCREEN DIRECTORY
            </TerminalText>
            <TerminalText tone="muted" uppercase={false} variant="caption">
              Open any destination. The demo bar provides previous, next and menu controls.
            </TerminalText>
          </View>
          <TerminalText glow tone="cyan" variant="label">
            {publicDemoRoutes.length} SCREENS
          </TerminalText>
        </View>

        <HUDBorderBox style={styles.routeList} tone="muted">
          {publicDemoRoutes.map((route, index) => (
            <Pressable
              accessibilityHint={`Open the ${route.label} demo screen`}
              accessibilityRole="button"
              key={route.route}
              onPress={() => openRoute(route)}
              style={({ pressed }) => [
                styles.routeRow,
                index < publicDemoRoutes.length - 1 ? styles.routeDivider : null,
                pressed ? styles.pressed : null
              ]}
            >
              <TerminalText glow style={styles.routeNumber} tone="cyan" variant="micro">
                {String(index + 1).padStart(2, '0')}
              </TerminalText>
              <View style={styles.routeCopy}>
                <TerminalText tone="text" uppercase={false} variant="body">
                  {route.label}
                </TerminalText>
                <TerminalText tone="dim" uppercase={false} variant="micro">
                  {route.route}
                </TerminalText>
              </View>
              <TerminalText glow tone="cyan" variant="button">
                →
              </TerminalText>
            </Pressable>
          ))}
        </HUDBorderBox>

        <HUDBorderBox style={styles.safetyPanel} tone="green">
          <TerminalText glow tone="green" variant="label">
            SAFE SHOWCASE MODE
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="caption">
            Firebase, the GoGymGo API, camera and device location are disabled
            throughout this public demo. Real registration starts separately.
          </TerminalText>
        </HUDBorderBox>

        <CyberButtonOutline
          label="LEAVE DEMO + JOIN BETA ->"
          onPress={joinBeta}
          tone="pink"
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  hero: {
    gap: spacing.sm
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle
  },
  body: {
    maxWidth: 620
  },
  startPanel: {
    gap: spacing.lg,
    padding: spacing.lg
  },
  startCopy: {
    gap: spacing.sm
  },
  directoryHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  directoryCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  routeList: {
    padding: 0,
    overflow: 'hidden'
  },
  routeRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg
  },
  routeDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted
  },
  routeNumber: {
    width: 26
  },
  routeCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  pressed: {
    backgroundColor: colors.surfaceCyanSoft
  },
  safetyPanel: {
    gap: spacing.sm,
    padding: spacing.lg
  }
});
