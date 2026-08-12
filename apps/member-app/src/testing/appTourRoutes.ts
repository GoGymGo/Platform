import type { Href } from 'expo-router';

import {
  devicePresenceVerificationAvailable,
  heartRateTelemetryAvailable,
  legacyTimedWorkoutFlowAvailable,
  midSessionPresenceVerificationAvailable
} from '@/config/workoutVerification';
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

export const appTourRouteGroups: readonly AppTourRouteGroup[] = [
  {
    title: 'START + ACCOUNT',
    routes: [
      { label: 'App Entry', route: '/' },
      { label: 'Welcome', route: '/welcome' },
      { label: 'Choose How to Join', route: '/join' },
      { label: 'Sign Up', route: '/sign-up' },
      { label: 'Sign In', route: '/sign-in' },
      { label: 'Verify Email', route: '/verify-email?next=region' },
      { label: 'Forgot Password', route: '/forgot-password' }
    ]
  },
  {
    title: 'REQUIRED SETUP',
    routes: [
      { label: 'Region + Agreements', route: '/region' },
      { label: 'Weekly Goal', route: '/commitment' }
    ]
  },
  {
    title: 'OPTIONAL SETUP',
    routes: [
      { label: 'Public Alias', route: '/identity' },
      { label: 'Contest Guide', route: '/how-it-works' }
    ]
  },
  {
    title: 'MAIN APP',
    routes: [
      { label: 'Home', route: '/home' },
      { label: 'Workout Calendar', route: '/calendar' },
      { label: 'Train', route: '/session' },
      { label: 'Contest Overview', route: '/leaderboard' },
      { label: 'Leaderboard / Winners', route: '/leaderboard/standings' },
      { label: 'Winners Circle', route: '/winners-circle' },
      { label: 'Rewards', route: '/leaderboard/rewards' },
      { label: 'My Awards', route: '/rewards/awards' },
      { label: 'Weekly Challenge', route: '/squad' },
      { label: 'Social Challenges', route: '/squad/social' },
      { label: 'Challenge Gym', route: '/squad/gym' },
      { label: 'Profile', route: '/profile' },
      { label: 'Account Data', route: '/account-data' }
    ]
  },
  {
    title: 'WORKOUT FLOW',
    routes: [
      { label: 'Choose Method', route: '/workout/method' },
      ...(heartRateTelemetryAvailable
        ? [{ label: 'Heart-Rate Verification', route: '/workout/check-in' }]
        : []),
      { label: 'Gym Location', route: '/qr-scanner' },
      ...(devicePresenceVerificationAvailable
        ? [{
            label: 'Partner Gym Presence',
            route: '/workout/identity-check?qrPayload=gogymgo:gym:entry:app-tour'
          }]
        : []),
      ...(legacyTimedWorkoutFlowAvailable
        ? [{
            label: 'Active Timer',
            route: '/workout/active',
            scenario: 'active-workout' as AppTourScenario
          }]
        : []),
      ...(midSessionPresenceVerificationAvailable
        ? [
            {
              label: 'Presence Check',
              route: '/workout/ping',
              scenario: 'presence-check' as AppTourScenario
            },
            {
              label: 'Presence Confirmed',
              route: '/workout/ping-success',
              scenario: 'workout-complete' as AppTourScenario
            }
          ]
        : []),
      ...(legacyTimedWorkoutFlowAvailable
        ? [{
            label: 'Completion Verification',
            route: '/workout/check-out',
            scenario: 'workout-complete' as AppTourScenario
          }]
        : []),
      {
        label: 'Workout Complete',
        route: '/workout/complete',
        scenario: 'workout-complete'
      }
    ]
  },
  {
    title: 'CREATORS + PARTNERS',
    routes: [
      { label: 'Creator Workouts', route: '/workouts' },
      { label: 'Workout Detail', route: '/workouts/app-tour-workout' },
      { label: 'Creator Application', route: '/creator/apply' },
      { label: 'Creator Submission', route: '/creator/submit' },
      { label: 'Partner Hub', route: '/partner' },
      { label: 'Sponsor Application', route: '/sponsor/apply' },
      { label: 'Gym Registration', route: '/gym/register' }
    ]
  },
  {
    title: 'RULES + PRIVACY',
    routes: [
      { label: 'Contest Rules', route: '/commitment-rules' },
      { label: 'Official Contest Rules', route: '/official-rules' },
      { label: 'Bonus Rules', route: '/bonus-rules' },
      { label: 'Privacy Policy', route: '/privacy-policy' },
      { label: 'Terms of Service', route: '/terms-of-service' },
      ...(devicePresenceVerificationAvailable
        ? [
            { label: 'Consent Settings', route: '/consent-settings' },
            { label: 'Presence Notice', route: '/biometric-camera-consent' }
          ]
        : [])
    ]
  }
];

export const appTourRoutes = appTourRouteGroups.flatMap(({ routes }) => routes);

const publicDemoRouteNames = new Set([
  '/home',
  '/calendar',
  '/leaderboard',
  '/leaderboard/standings',
  '/winners-circle',
  '/leaderboard/rewards',
  '/rewards/awards',
  '/squad',
  '/squad/social',
  '/profile',
  '/workouts'
]);

export const publicDemoRoutes = appTourRoutes.filter(({ route }) =>
  publicDemoRouteNames.has(route)
);

export function buildAppTourHref(
  route: AppTourRoute,
  mode: 'demo' | 'review' = 'review'
): Href {
  const scenario = route.scenario ?? 'ready';
  const join = route.route.includes('?') ? '&' : '?';
  const modeParam = mode === 'demo' ? 'demo=1' : 'appTour=1';

  return `${route.route}${join}${modeParam}&tourScenario=${scenario}` as Href;
}

export function findAppTourRouteIndex(pathname: string) {
  return appTourRoutes.findIndex(({ route }) => route.split('?', 1)[0] === pathname);
}
