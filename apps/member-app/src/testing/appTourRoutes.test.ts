import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appTourRoutes,
  buildAppTourHref,
  findAppTourRouteIndex,
  publicDemoRoutes
} from './appTourRoutes';

test('App Tour routes are unique and resolve to stable screen positions', () => {
  const routeNames = appTourRoutes.map(({ route }) => route);

  assert.equal(new Set(routeNames).size, routeNames.length);
  assert.equal(routeNames.some((route) => route.startsWith('/verification')), false);
  assert.equal(findAppTourRouteIndex('/sign-up'), routeNames.indexOf('/sign-up'));
  assert.equal(
    findAppTourRouteIndex('/workouts/app-tour-workout'),
    routeNames.indexOf('/workouts/app-tour-workout')
  );
  assert.equal(findAppTourRouteIndex(['', 'not-a-screen'].join('/')), -1);
});

test('the public demo exposes the first ten reviewed product destinations', () => {
  assert.equal(publicDemoRoutes.length, 10);
  assert.deepEqual(
    publicDemoRoutes.map(({ route }) => route),
    [
      '/home',
      '/calendar',
      '/session',
      '/leaderboard',
      '/winners-circle',
      '/leaderboard/rewards',
      '/rewards/awards',
      '/squad',
      '/squad/social',
      '/profile'
    ]
  );
});

test('the pilot tour hides version 2 verification and permission routes', () => {
  const routeNames = appTourRoutes.map(({ route }) => route);

  assert.equal(routeNames.includes('/workout/check-in'), false);
  assert.equal(routeNames.includes('/workout/active'), false);
  assert.equal(routeNames.includes('/workout/ping'), false);
  assert.equal(routeNames.includes('/workout/ping-success'), false);
  assert.equal(routeNames.some((route) => route.startsWith('/workout/identity-check?')), false);
  assert.equal(routeNames.includes('/consent-settings'), false);
  assert.equal(routeNames.includes('/biometric-camera-consent'), false);
});

test('App Tour links preserve route parameters and apply the required mode', () => {
  const verifyEmailRoute = appTourRoutes.find(
    ({ route }) => route === '/verify-email?next=region'
  );

  assert.ok(verifyEmailRoute);
  assert.equal(
    buildAppTourHref(verifyEmailRoute),
    '/verify-email?next=region&appTour=1&tourScenario=ready'
  );
  assert.equal(
    buildAppTourHref(verifyEmailRoute, 'demo'),
    '/verify-email?next=region&demo=1&tourScenario=ready'
  );
});
