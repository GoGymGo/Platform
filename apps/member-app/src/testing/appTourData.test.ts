import assert from 'node:assert/strict';
import test from 'node:test';

import { extractGymScanCredential } from '@/domain/gymScan';

import {
  createAppTourAccountReadinessRepository,
  createAppTourGymQrPayload,
  createAppTourPendingGymScan,
  createAppTourStartedGymLocationResult,
  createAppTourVerifiedGymLocationResult
} from './appTourData';

test('App Tour QR payloads pass through the production scanner contract', () => {
  for (const mode of ['entry', 'exit'] as const) {
    const payload = createAppTourGymQrPayload(mode);
    assert.equal(extractGymScanCredential(payload), payload);
  }
});

test('App Tour gym-location fixtures keep preview state outside production screens', () => {
  const now = Date.parse('2026-09-10T18:00:00.000Z');
  const active = createAppTourPendingGymScan('active-workout', now);
  const verified = createAppTourVerifiedGymLocationResult(now);
  const started = createAppTourStartedGymLocationResult(now);

  assert.equal(active.activeSession?.gymName, 'SKYGATE');
  assert.equal(active.activeSession?.minimumCompleteAt, '2026-09-10T18:22:00.000Z');
  assert.equal(verified.outcome, 'verified');
  assert.equal(started.outcome, 'started');
  assert.equal(started.remainingSeconds, 30 * 60);
  assert.equal(verified.gymName, 'SKYGATE');
  assert.equal(verified.remainingSeconds, 0);
});

test('new-player App Tour starts onboarding without completed setup', async () => {
  const account = createAppTourAccountReadinessRepository('new-player');

  assert.equal(await account.getCurrentRegionVerification(), null);
  assert.equal(await account.getCurrentEnrollment(), null);
  assert.equal((await account.getLegalReceiptStatus()).complete, false);
  assert.equal(
    (await account.getCurrentCompetition(undefined, 'preview-region'))?.monthKey,
    '2026-09'
  );
});

test('new-player App Tour records each onboarding milestone in memory', async () => {
  const account = createAppTourAccountReadinessRepository('new-player');
  const verification = await account.createRegionVerification({
    accuracyMeters: 8,
    latitude: 49.1659,
    longitude: -123.9401,
    method: 'device_location',
    observedAt: new Date().toISOString()
  });
  const legalBundle = await account.getCurrentLegalDocuments('CA-BC', 'en');
  const legalReceipt = await account.recordLegalReceipt(legalBundle);
  const competition = await account.getCurrentCompetition(
    '2026-08',
    verification.regionCode
  );

  assert.equal(
    (await account.getCurrentRegionVerification())?.id,
    verification.id
  );
  assert.equal(
    verification.regionCode,
    'vancouver-island-gulf-islands-bc'
  );
  assert.equal(legalReceipt.complete, true);
  assert.ok(legalReceipt.receiptBundleId);
  assert.deepEqual(
    legalBundle.documents.map(({ documentKey }) => documentKey),
    ['privacy_policy', 'terms_of_service']
  );
  assert.ok(competition);

  const enrollment = await account.enrollInCompetition(competition.id, {
    ageEligibilityAttested: true,
    goalDays: 4,
    gymPresence: {
      accuracyMeters: 5,
      credential: 'app-tour-gym-credential-000000000001',
      latitude: 49.2827,
      longitude: -123.1207
    },
    legalReceiptBundleId: legalReceipt.receiptBundleId,
    regionVerificationId: verification.id,
    rulesAccepted: true
  });

  assert.equal(enrollment.goalDays, 4);
  assert.equal((await account.getCurrentEnrollment())?.id, enrollment.id);
});
