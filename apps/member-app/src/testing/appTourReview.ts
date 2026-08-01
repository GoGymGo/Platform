import AsyncStorage from '@react-native-async-storage/async-storage';

import { appTourRoutes } from '@/testing/appTourRoutes';

const appTourReviewStorageKey = '@gogymgo/app-tour/review-progress-v1';
const validAppTourRouteNames = new Set(appTourRoutes.map(({ route }) => route));
const visitedAppTourRoutes = new Set<string>();

let hydrated = false;
let lastOpenedAppTourRoute: string | null = null;

export type AppTourReviewSnapshot = {
  lastOpenedRoute: string | null;
  visitedRoutes: ReadonlySet<string>;
};

export function getAppTourReviewSnapshot(): AppTourReviewSnapshot {
  return {
    lastOpenedRoute: lastOpenedAppTourRoute,
    visitedRoutes: new Set(visitedAppTourRoutes)
  };
}

export async function hydrateAppTourReview() {
  if (hydrated) {
    return getAppTourReviewSnapshot();
  }

  hydrated = true;
  try {
    const value = await AsyncStorage.getItem(appTourReviewStorageKey);
    const storedReview = parseStoredAppTourReview(value);
    if (storedReview) {
      visitedAppTourRoutes.clear();
      storedReview.visitedRoutes.forEach((route) => visitedAppTourRoutes.add(route));
      lastOpenedAppTourRoute = storedReview.lastOpenedRoute;
    }
  } catch {
    // In-memory review tracking remains available when local persistence fails.
  }

  return getAppTourReviewSnapshot();
}

export async function recordAppTourVisit(route: string) {
  if (!validAppTourRouteNames.has(route)) {
    return getAppTourReviewSnapshot();
  }

  visitedAppTourRoutes.add(route);
  lastOpenedAppTourRoute = route;
  const snapshot = getAppTourReviewSnapshot();

  try {
    await AsyncStorage.setItem(
      appTourReviewStorageKey,
      JSON.stringify({
        lastOpenedRoute: snapshot.lastOpenedRoute,
        visitedRoutes: [...snapshot.visitedRoutes]
      })
    );
  } catch {
    // A failed write must not block local screen review navigation.
  }

  return snapshot;
}

export async function resetAppTourReview() {
  visitedAppTourRoutes.clear();
  lastOpenedAppTourRoute = null;

  try {
    await AsyncStorage.removeItem(appTourReviewStorageKey);
  } catch {
    // The current in-memory review state is already reset.
  }

  return getAppTourReviewSnapshot();
}

function parseStoredAppTourReview(value: string | null): {
  lastOpenedRoute: string | null;
  visitedRoutes: readonly string[];
} | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      lastOpenedRoute?: unknown;
      visitedRoutes?: unknown;
    };
    const visitedRoutes = Array.isArray(parsed.visitedRoutes)
      ? parsed.visitedRoutes.filter(
        (route): route is string =>
          typeof route === 'string' && validAppTourRouteNames.has(route)
      )
      : [];
    const lastOpenedRoute =
      typeof parsed.lastOpenedRoute === 'string' &&
      validAppTourRouteNames.has(parsed.lastOpenedRoute)
        ? parsed.lastOpenedRoute
        : null;

    return { lastOpenedRoute, visitedRoutes };
  } catch {
    return null;
  }
}
