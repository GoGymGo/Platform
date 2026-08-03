import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontFamilies, fontSizes, spacing } from '@/constants/theme';
import {
  buildDemoHref,
  demoRoutes,
  findDemoRouteIndex,
  type DemoRoute
} from '@/demo/demoRoutes';
import { useAppTour } from '@/state/appTour';

export function DemoModeBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const { demoActive, enterDemo } = useAppTour();
  const routeIndex = findDemoRouteIndex(pathname);
  const currentRoute = routeIndex >= 0 ? demoRoutes[routeIndex] : null;
  const previousRoute = routeIndex > 0 ? demoRoutes[routeIndex - 1] : null;
  const nextRoute =
    routeIndex >= 0 && routeIndex < demoRoutes.length - 1
      ? demoRoutes[routeIndex + 1]
      : null;
  const isLastRoute = routeIndex === demoRoutes.length - 1;

  if (!demoActive || pathname === '/demo') {
    return null;
  }

  function openRoute(route: DemoRoute) {
    enterDemo(route.scenario ?? 'ready');
    router.replace(buildDemoHref(route));
  }

  function finishDemo() {
    enterDemo('ready');
    router.replace('/demo?complete=1');
  }

  return (
    <SafeAreaView
      accessibilityLabel="Demo screen navigation"
      edges={['top']}
      style={styles.banner}
    >
      <DemoStepButton
        disabled={!previousRoute}
        label="<"
        onPress={() => previousRoute && openRoute(previousRoute)}
        screenLabel={previousRoute?.label}
      />
      <Pressable
        accessibilityHint="Return to the Demo introduction"
        accessibilityLabel="Demo mode with sample data"
        accessibilityRole="button"
        onPress={() => router.replace('/demo')}
        style={({ pressed }) => [
          styles.summaryButton,
          pressed ? styles.pressed : null
        ]}
      >
        <View style={styles.summaryTopLine}>
          <View style={styles.statusDot} />
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.5}
            numberOfLines={1}
            style={styles.statusLabel}
          >
            DEMO // SAMPLE DATA
          </Text>
        </View>
        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.5}
          numberOfLines={1}
          style={styles.screenLabel}
        >
          {currentRoute
            ? `${routeIndex + 1} OF ${demoRoutes.length} // ${currentRoute.label}`
            : 'REAL APP SCREEN'}
        </Text>
      </Pressable>
      <DemoStepButton
        disabled={!nextRoute && !isLastRoute}
        label={isLastRoute ? '✓' : '>'}
        onPress={() => {
          if (nextRoute) {
            openRoute(nextRoute);
          } else if (isLastRoute) {
            finishDemo();
          }
        }}
        screenLabel={nextRoute?.label ?? (isLastRoute ? 'Finish Demo' : undefined)}
      />
    </SafeAreaView>
  );
}

function DemoStepButton({
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
        label === '<'
          ? 'Previous Demo screen'
          : label === '✓'
            ? 'Finish Demo'
            : 'Next Demo screen'
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
  banner: {
    width: '100%',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPinkHeavy,
    backgroundColor: colors.surfacePinkSoft
  },
  summaryButton: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  summaryTopLine: {
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
    backgroundColor: colors.pink
  },
  statusLabel: {
    color: colors.pink,
    fontFamily: fontFamilies.terminal,
    fontSize: fontSizes.micro,
    letterSpacing: 0.8,
    lineHeight: 18
  },
  screenLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodyStrong,
    fontSize: fontSizes.micro,
    lineHeight: 16
  },
  stepButton: {
    width: 54,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepLabel: {
    color: colors.cyan,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.body,
    lineHeight: 22
  },
  disabled: {
    opacity: 0.22
  },
  pressed: {
    opacity: 0.72,
    backgroundColor: colors.surfacePinkActive
  }
});
