import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import { browserTestPreviewBuildEnabled } from '@/config/browserTestPreview';
import { useAppTour } from '@/state/appTour';
import {
  appTourRoutes,
  buildAppTourHref,
  findAppTourRouteIndex,
  type AppTourRoute
} from '@/testing/appTourRoutes';
import { recordAppTourVisit } from '@/testing/appTourReview';

export function AppTourModeBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const { active, demoActive, enterTour } = useAppTour();
  const routeIndex = findAppTourRouteIndex(pathname);
  const currentRoute = routeIndex >= 0 ? appTourRoutes[routeIndex] : null;
  const previousRoute = routeIndex > 0 ? appTourRoutes[routeIndex - 1] : null;
  const nextRoute =
    routeIndex >= 0 && routeIndex < appTourRoutes.length - 1
      ? appTourRoutes[routeIndex + 1]
      : null;

  useEffect(() => {
    if (active && currentRoute) {
      void recordAppTourVisit(currentRoute.route);
    }
  }, [active, currentRoute]);

  if (
    !active ||
    demoActive ||
    pathname === '/app-tour' ||
    pathname === '/test-preview'
  ) {
    return null;
  }

  function openRoute(route: AppTourRoute) {
    void recordAppTourVisit(route.route);
    router.replace(buildAppTourHref(route));
  }

  return (
    <SafeAreaView
      accessibilityLabel="App Tour screen navigation"
      edges={['top']}
      style={styles.shortcut}
    >
      <TourStepButton
        disabled={!previousRoute}
        label="<"
        onPress={() => previousRoute && openRoute(previousRoute)}
        screenLabel={previousRoute?.label}
      />
      <Pressable
        accessibilityHint="Open the browser test screen directory"
        accessibilityLabel="Testing mode is active. Open App Tour."
        accessibilityRole="button"
        onPress={() => {
          enterTour('ready');
          router.replace(
            browserTestPreviewBuildEnabled
              ? '/test-preview?appTour=1'
              : '/app-tour?appTour=1'
          );
        }}
        style={({ pressed }) => [
          styles.directoryButton,
          pressed ? styles.pressed : null
        ]}
      >
        <View style={styles.copy}>
          <View style={styles.statusDot} />
          <Text allowFontScaling maxFontSizeMultiplier={1.5} style={styles.statusLabel}>
            TEST MODE // {routeIndex >= 0 ? `${routeIndex + 1} OF ${appTourRoutes.length}` : 'SCREEN REVIEW'}
          </Text>
        </View>
        <Text allowFontScaling maxFontSizeMultiplier={1.5} style={styles.actionLabel}>
          Screen directory
        </Text>
      </Pressable>
      <TourStepButton
        disabled={!nextRoute}
        label=">"
        onPress={() => nextRoute && openRoute(nextRoute)}
        screenLabel={nextRoute?.label}
      />
    </SafeAreaView>
  );
}

function TourStepButton({
  disabled,
  label,
  onPress,
  screenLabel
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  screenLabel?: string;
}) {
  return (
    <Pressable
      accessibilityHint={screenLabel ? `Open ${screenLabel}` : undefined}
      accessibilityLabel={
        label === '<' ? 'Previous App Tour screen' : 'Next App Tour screen'
      }
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepButton,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null
      ]}
    >
      <Text allowFontScaling maxFontSizeMultiplier={1.5} style={styles.stepLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shortcut: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderWarning,
    backgroundColor: colors.surfaceWarning
  },
  directoryButton: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  copy: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.statusWarning
  },
  statusLabel: {
    color: colors.statusWarning,
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.micro,
    letterSpacing: 0.8,
    lineHeight: 18
  },
  actionLabel: {
    color: colors.statusWarning,
    fontFamily: fontFamilies.bodyStrong,
    fontSize: fontSizes.micro,
    lineHeight: 16
  },
  stepButton: {
    width: 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepLabel: {
    color: colors.statusWarning,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.body,
    lineHeight: 20
  },
  disabled: {
    opacity: 0.24
  },
  pressed: {
    opacity: 0.72,
    backgroundColor: colors.surfaceWarningActive
  }
});
