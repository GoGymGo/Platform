export type AppTourReviewSnapshot = {
  lastOpenedRoute: string | null;
  visitedRoutes: ReadonlySet<string>;
};

export function getAppTourReviewSnapshot(): AppTourReviewSnapshot {
  return {
    lastOpenedRoute: null,
    visitedRoutes: new Set()
  };
}

export async function hydrateAppTourReview() {
  return getAppTourReviewSnapshot();
}

export async function recordAppTourVisit(_route: string) {
  return getAppTourReviewSnapshot();
}

export async function resetAppTourReview() {
  return getAppTourReviewSnapshot();
}
