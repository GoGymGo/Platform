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

test('App Tour links preserve route parameters and apply the required scenario', () => {
  const verifiedPresenceRoute = appTourRoutes.find(
    ({ route }) => route === '/workout/ping-success'
  );
  const gymPresenceRoute = appTourRoutes.find(
    ({ route }) => route.startsWith('/workout/identity-check?')
  );

  assert.ok(verifiedPresenceRoute);
  assert.ok(gymPresenceRoute);
  assert.equal(
    buildAppTourHref(verifiedPresenceRoute),
    '/workout/ping-success?appTour=1&tourScenario=workout-complete'
  );
  assert.equal(
    buildAppTourHref(gymPresenceRoute),
    '/workout/identity-check?qrPayload=gogymgo:gym:entry:app-tour&appTour=1&tourScenario=ready'
  );
  assert.equal(
    buildAppTourHref(verifiedPresenceRoute, 'demo'),
    '/workout/ping-success?demo=1&tourScenario=workout-complete'
  );
});
