import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readEnrollmentGymPresence } from './enrollmentGymPresence';

test('starts the location request before asynchronous scan storage work', async () => {
  const events: string[] = [];
  let finishLocation: (() => void) | undefined;
  const locationReady = new Promise<void>((resolve) => {
    finishLocation = resolve;
  });

  const resultPromise = readEnrollmentGymPresence({
    readLocation: async () => {
      events.push('location-requested');
      await locationReady;
      return 'location';
    },
    readPendingScan: async () => {
      events.push('storage-requested');
      return 'scan';
    }
  });

  assert.deepEqual(events, ['location-requested', 'storage-requested']);
  finishLocation?.();
  assert.deepEqual(await resultPromise, {
    location: 'location',
    pendingScan: 'scan'
  });
});
