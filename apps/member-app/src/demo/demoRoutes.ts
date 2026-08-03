import type { Href } from 'expo-router';

import type { AppTourScenario } from '@/state/appTour';

export type DemoRoute = {
  label: string;
  route: string;
  scenario?: AppTourScenario;
};

export const demoRoutes: readonly DemoRoute[] = [
  { label: 'Home', route: '/home' },
  { label: 'Workout Calendar', route: '/calendar' },
  { label: 'Train', route: '/session' },
  {
    label: 'Active Workout Timer',
    route: '/workout/active',
    scenario: 'active-workout'
  },
  { label: 'Leaderboard', route: '/leaderboard' },
  { label: 'Winners Circle', route: '/winners-circle' },
  { label: 'Rewards', route: '/leaderboard/rewards' },
  { label: 'My Awards', route: '/rewards/awards' },
  { label: 'Weekly Challenge', route: '/squad' },
  { label: 'Social Challenges', route: '/squad/social' },
  { label: 'Challenge Gym', route: '/squad/gym' },
  { label: 'Profile', route: '/profile' },
  { label: 'Account Data', route: '/account-data' }
];

export function buildDemoHref(route: DemoRoute): Href {
  const join = route.route.includes('?') ? '&' : '?';
  const scenario = route.scenario ?? 'ready';

  return `${route.route}${join}demo=1&tourScenario=${scenario}` as Href;
}

export function findDemoRouteIndex(pathname: string) {
  return demoRoutes.findIndex(({ route }) => route.split('?', 1)[0] === pathname);
}
