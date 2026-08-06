import type { Href } from 'expo-router';

import type { AppTourScenario } from '@/state/appTour';

export type AppTourRoute = {
  label: string;
  route: string;
  scenario?: AppTourScenario;
};

export type AppTourRouteGroup = {
  routes: readonly AppTourRoute[];
  title: string;
};

export const appTourRouteGroups: readonly AppTourRouteGroup[] = [];
export const appTourRoutes: readonly AppTourRoute[] = [];
export const publicDemoRoutes: readonly AppTourRoute[] = [];

export function buildAppTourHref(
  _route: AppTourRoute,
  _mode: 'demo' | 'review' = 'review'
): Href {
  return '/' as Href;
}

export function findAppTourRouteIndex(_pathname: string) {
  return -1;
}
