import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthTextField } from '@/components/auth';
import {
  CyberButtonOutline,
  CyberButtonPrimary,
  HUDBorderBox,
  ScreenContainer,
  ScreenScrollView,
  TerminalText
} from '@/components/cyber';
import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { browserTestPreviewEnabled } from '@/config/browserTestPreview';
import {
  getFlowFunnelSummaries,
  getFlowMetrics,
  type FlowFunnelSummary
} from '@/services/flowMetrics';
import { useAuth } from '@/state/auth';
import { useAppTour } from '@/state/appTour';
import {
  appTourRouteGroups,
  appTourRoutes,
  buildAppTourHref,
  type AppTourRoute
} from '@/testing/appTourRoutes';
import {
  getAppTourReviewSnapshot,
  hydrateAppTourReview,
  recordAppTourVisit,
  resetAppTourReview
} from '@/testing/appTourReview';

export default function AppTourScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { enterTour, exitTour } = useAppTour();
  const [flowSummaries, setFlowSummaries] = useState<
    readonly FlowFunnelSummary[]
  >([]);
  const [query, setQuery] = useState('');
  const [visitedRoutes, setVisitedRoutes] = useState<ReadonlySet<string>>(
    () => getAppTourReviewSnapshot().visitedRoutes
  );
  const [lastOpenedRoute, setLastOpenedRoute] = useState<string | null>(
    () => getAppTourReviewSnapshot().lastOpenedRoute
  );
  const [showFlowDiagnostics, setShowFlowDiagnostics] = useState(false);
  const [showResetReviewConfirm, setShowResetReviewConfirm] = useState(false);

  useEffect(() => {
    void getFlowMetrics(user?.uid)
      .then((metrics) => setFlowSummaries(getFlowFunnelSummaries(metrics)));
  }, [user?.uid]);

  useEffect(() => {
    void hydrateAppTourReview()
      .then((snapshot) => {
        setVisitedRoutes(snapshot.visitedRoutes);
        setLastOpenedRoute(snapshot.lastOpenedRoute);
      })
      .catch(() => undefined);
  }, []);

  if (!browserTestPreviewEnabled) {
    return <Redirect href="/" />;
  }

  function openRoute(route: AppTourRoute) {
    const scenario = route.scenario ?? 'ready';
    const nextVisitedRoutes = new Set(
      getAppTourReviewSnapshot().visitedRoutes
    );
    nextVisitedRoutes.add(route.route);
    setVisitedRoutes(nextVisitedRoutes);
    setLastOpenedRoute(route.route);
    void recordAppTourVisit(route.route);
    enterTour(scenario);
    router.push(buildAppTourHref(route));
  }

  function exit() {
    exitTour();
    router.replace('/');
  }

  function startNewPlayerDemo() {
    enterTour('new-player');
    router.replace({
      pathname: '/',
      params: {
        appTour: '1',
        tourScenario: 'new-player'
      }
    });
  }

  function resetReviewProgress() {
    setVisitedRoutes(new Set());
    setLastOpenedRoute(null);
    setQuery('');
    setShowResetReviewConfirm(false);
    void resetAppTourReview();
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleRouteGroups = appTourRouteGroups
    .map((group) => ({
      ...group,
      routes: group.routes.filter((route) =>
        !normalizedQuery ||
        group.title.toLowerCase().includes(normalizedQuery) ||
        route.label.toLowerCase().includes(normalizedQuery) ||
        route.route.toLowerCase().includes(normalizedQuery)
      )
    }))
    .filter(({ routes }) => routes.length > 0);
  const lastOpenedRouteIndex = lastOpenedRoute
    ? appTourRoutes.findIndex(({ route }) => route === lastOpenedRoute)
    : -1;
  const resumeRoute = lastOpenedRouteIndex >= 0
    ? appTourRoutes[lastOpenedRouteIndex]
    : null;
  const previousRoute = lastOpenedRouteIndex > 0
    ? appTourRoutes[lastOpenedRouteIndex - 1]
    : null;
  const nextRoute = lastOpenedRouteIndex >= 0 &&
    lastOpenedRouteIndex < appTourRoutes.length - 1
      ? appTourRoutes[lastOpenedRouteIndex + 1]
      : lastOpenedRouteIndex === -1
        ? appTourRoutes[0]
        : null;

  return (
    <ScreenContainer>
      <ScreenScrollView
        bounces={false}
        contentContainerStyle={styles.screen}
        showsVerticalScrollIndicator={false}
      >
        <TerminalText glow tone="green" variant="label">
          WEB TEST PREVIEW
        </TerminalText>
        <TerminalText glow style={styles.title} tone="cyan" variant="title">
          GOGYMGO APP TOUR
        </TerminalText>
        <TerminalText style={styles.body} tone="muted" uppercase={false} variant="body">
          Test the complete new-player experience or inspect any screen with
          sample data. Preview actions stay in this browser and do not create
          real competition entries.
        </TerminalText>

        <HUDBorderBox glow style={styles.status} tone="green">
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <View style={styles.statusCopy}>
              <TerminalText glow tone="green" variant="label">
                APP TOUR ACTIVE
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Use the review bar to move to the previous or next screen, or
                return here to choose any destination.
              </TerminalText>
            </View>
          </View>
        </HUDBorderBox>

        <HUDBorderBox glow style={styles.guidedDemo} tone="pink">
          <TerminalText glow tone="pink" variant="label">
            COMPLETE NEW-PLAYER FLOW
          </TerminalText>
          <TerminalText tone="muted" uppercase={false} variant="body">
            Start signed out, create a sample account, verify its email, use
            the simulated location check, accept the agreements, choose a
            Weekly Goal and arrive at Home.
          </TerminalText>
          <CyberButtonPrimary
            label="START NEW PLAYER DEMO ->"
            onPress={startNewPlayerDemo}
          />
        </HUDBorderBox>

        <HUDBorderBox style={styles.reviewProgress} tone="cyan">
          <View style={styles.reviewProgressHeader}>
            <View style={styles.reviewProgressCopy}>
              <TerminalText glow tone="cyan" variant="label">
                SCREEN REVIEW
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Opened screens are marked complete for this testing session.
              </TerminalText>
            </View>
            <TerminalText glow tone="green" variant="label">
              {visitedRoutes.size}/{appTourRoutes.length}
            </TerminalText>
          </View>
          <View style={styles.reviewTrack}>
            <View
              style={[
                styles.reviewFill,
                {
                  width: `${Math.round(
                    (visitedRoutes.size / appTourRoutes.length) * 100
                  )}%` as `${number}%`
                }
              ]}
            />
          </View>

          {resumeRoute ? (
            <CyberButtonPrimary
              label="RESUME LAST SCREEN ->"
              onPress={() => openRoute(resumeRoute)}
            />
          ) : null}

          <View style={styles.routeNavigation}>
            <CyberButtonOutline
              disabled={!previousRoute}
              label="PREVIOUS"
              onPress={() => previousRoute && openRoute(previousRoute)}
              style={styles.routeNavigationButton}
            />
            <CyberButtonOutline
              disabled={!nextRoute}
              label={lastOpenedRouteIndex === -1 ? 'START TOUR ->' : 'NEXT ->'}
              onPress={() => nextRoute && openRoute(nextRoute)}
              style={styles.routeNavigationButton}
              tone="cyan"
            />
          </View>
          {lastOpenedRoute ? (
            <TerminalText tone="dim" uppercase={false} variant="caption">
              Last opened: {appTourRoutes[lastOpenedRouteIndex]?.label}
            </TerminalText>
          ) : null}

          {visitedRoutes.size > 0 ? (
            <>
              <CyberButtonOutline
                label={showResetReviewConfirm
                  ? 'CANCEL RESET'
                  : 'RESET REVIEW PROGRESS'}
                onPress={() => setShowResetReviewConfirm((visible) => !visible)}
                tone={showResetReviewConfirm ? 'cyan' : 'red'}
              />
              {showResetReviewConfirm ? (
                <HUDBorderBox style={styles.resetReviewPanel} tone="red">
                  <TerminalText glow tone="red" variant="label">
                    RESET SCREEN REVIEW?
                  </TerminalText>
                  <TerminalText tone="muted" uppercase={false} variant="caption">
                    This clears every DONE marker and your last-screen position.
                    It does not change test accounts or app data.
                  </TerminalText>
                  <CyberButtonOutline
                    label="YES, RESET REVIEW"
                    onPress={resetReviewProgress}
                    tone="red"
                  />
                </HUDBorderBox>
              ) : null}
            </>
          ) : null}
        </HUDBorderBox>

        <View style={styles.search}>
          <AuthTextField
            autoCapitalize="none"
            label="SEARCH SCREENS"
            onChangeText={setQuery}
            placeholder="Try leaderboard, privacy or workout"
            value={query}
          />
        </View>

        <View style={styles.diagnosticsSection}>
          <CyberButtonOutline
            label={showFlowDiagnostics
              ? 'HIDE TEST DIAGNOSTICS'
              : 'SHOW TEST DIAGNOSTICS'}
            onPress={() => setShowFlowDiagnostics((visible) => !visible)}
            tone={showFlowDiagnostics ? 'cyan' : 'amber'}
          />
          {showFlowDiagnostics ? (
            <HUDBorderBox style={styles.flowDiagnostics} tone="cyan">
              <TerminalText glow tone="cyan" variant="label">
                PRIVACY-SAFE FLOW COUNTERS
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="caption">
                Stored only on this device. No email, alias, location or raw activity
                history is recorded.
              </TerminalText>
              <View style={styles.flowList}>
                {flowSummaries.map((summary) => (
                  <View key={summary.label} style={styles.flowRow}>
                    <TerminalText style={styles.flowLabel} tone="text" variant="micro">
                      {summary.label}
                    </TerminalText>
                    <TerminalText tone="green" variant="micro">
                      {summary.completed} DONE
                    </TerminalText>
                    <TerminalText tone={summary.remaining > 0 ? 'amber' : 'dim'} variant="micro">
                      {summary.remaining} OPEN
                    </TerminalText>
                  </View>
                ))}
              </View>
            </HUDBorderBox>
          ) : null}
        </View>

        <View style={styles.groups}>
          {visibleRouteGroups.map((group) => (
            <View key={group.title} style={styles.group}>
              <TerminalText tone="dim" variant="micro">
                {group.title}
              </TerminalText>
              <HUDBorderBox style={styles.routeList} tone="muted">
                {group.routes.map((route, index) => (
                  <Pressable
                    accessibilityHint={`Open ${route.label} in App Tour`}
                    accessibilityRole="button"
                    key={`${group.title}-${route.label}`}
                    onPress={() => openRoute(route)}
                    style={({ pressed }) => [
                      styles.routeRow,
                      index < group.routes.length - 1 ? styles.routeDivider : null,
                      pressed ? styles.pressed : null
                    ]}
                  >
                    <View style={styles.routeCopy}>
                      <TerminalText tone="text" uppercase={false} variant="body">
                        {route.label}
                      </TerminalText>
                      <TerminalText tone="dim" uppercase={false} variant="micro">
                        {route.route}
                      </TerminalText>
                    </View>
                    <TerminalText
                      glow
                      tone={visitedRoutes.has(route.route) ? 'green' : 'cyan'}
                      variant={visitedRoutes.has(route.route) ? 'micro' : 'button'}
                    >
                      {visitedRoutes.has(route.route) ? 'DONE ✓' : '→'}
                    </TerminalText>
                  </Pressable>
                ))}
              </HUDBorderBox>
            </View>
          ))}
          {visibleRouteGroups.length === 0 ? (
            <HUDBorderBox style={styles.noResults} tone="muted">
              <TerminalText glow tone="amber" variant="label">
                NO MATCHING SCREENS
              </TerminalText>
              <TerminalText tone="muted" uppercase={false} variant="body">
                Try a screen name, route or section such as workout, account or privacy.
              </TerminalText>
            </HUDBorderBox>
          ) : null}
        </View>

        <CyberButtonOutline
          label="EXIT APP TOUR"
          onPress={exit}
          style={styles.exitButton}
          tone="amber"
        />
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background
  },
  title: {
    marginTop: spacing.sm,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.screenTitle
  },
  body: {
    marginTop: spacing.md
  },
  status: {
    marginTop: spacing.xl,
    padding: spacing.lg
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.statusSuccess
  },
  statusCopy: {
    flex: 1,
    gap: spacing.xs
  },
  reviewProgress: {
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  guidedDemo: {
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg
  },
  reviewProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  reviewProgressCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  reviewTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.whiteAlpha06
  },
  reviewFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.green
  },
  routeNavigation: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  routeNavigationButton: {
    minWidth: 0,
    flex: 1
  },
  resetReviewPanel: {
    gap: spacing.sm,
    padding: spacing.md
  },
  search: {
    marginTop: spacing.lg
  },
  diagnosticsSection: {
    gap: spacing.sm,
    marginTop: spacing.lg
  },
  flowDiagnostics: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  flowList: {
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  flowRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  flowLabel: {
    minWidth: 0,
    flex: 1
  },
  groups: {
    gap: spacing.xl,
    marginTop: spacing.xxl
  },
  group: {
    gap: spacing.sm
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
  routeCopy: {
    minWidth: 0,
    flex: 1,
    gap: spacing.xs
  },
  pressed: {
    backgroundColor: colors.surfaceCyanSoft
  },
  noResults: {
    gap: spacing.sm,
    padding: spacing.lg
  },
  exitButton: {
    marginTop: spacing.xxl
  }
});
