import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDemoHref,
  demoRoutes,
  findDemoRouteIndex
} from './demoRoutes';

test('public Demo uses the real member-app destinations in a stable order', () => {
  const routes = demoRoutes.map(({ route }) => route);

  assert.deepEqual(routes, [
    '/home',
    '/calendar',
    '/session',
    '/workout/active',
    '/leaderboard',
    '/winners-circle',
    '/leaderboard/rewards',
    '/rewards/awards',
    '/squad',
    '/squad/social',
    '/squad/gym',
    '/profile',
    '/account-data'
  ]);
  assert.equal(new Set(routes).size, routes.length);
  assert.equal(findDemoRouteIndex('/workout/active'), 3);
  assert.equal(findDemoRouteIndex(['', 'not-a-demo-screen'].join('/')), -1);
});

test('public Demo links retain the isolated dummy-data mode', () => {
  const home = demoRoutes[0];
  const timer = demoRoutes.find(({ route }) => route === '/workout/active');

  assert.ok(home);
  assert.ok(timer);
  assert.equal(buildDemoHref(home), '/home?demo=1&tourScenario=ready');
  assert.equal(
    buildDemoHref(timer),
    '/workout/active?demo=1&tourScenario=active-workout'
  );
});
