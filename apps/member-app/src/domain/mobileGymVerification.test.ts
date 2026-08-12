import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAuthenticatedHomeRoute,
  getGymVerificationHomeState,
  isMobileWebGymVerificationDevice
} from './mobileGymVerification';

test('desktop browsers do not expose gym verification', () => {
  assert.equal(
    isMobileWebGymVerificationDevice({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0'
    }),
    false
  );
});

test('phone browsers expose gym verification', () => {
  assert.equal(
    isMobileWebGymVerificationDevice({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Mobile'
    }),
    true
  );
  assert.equal(
    isMobileWebGymVerificationDevice({
      userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36'
    }),
    true
  );
});

test('tablet browsers expose gym verification', () => {
  assert.equal(
    isMobileWebGymVerificationDevice({
      maxTouchPoints: 5,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 19_0 like Mac OS X) Mobile/15E148 Safari/604.1'
    }),
    true
  );
  assert.equal(
    isMobileWebGymVerificationDevice({
      userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel Tablet) AppleWebKit/537.36 Chrome/140.0 Safari/537.36'
    }),
    true
  );
});

test('desktop authentication opens Home without the mobile resume flow', () => {
  assert.equal(getAuthenticatedHomeRoute(false), '/home');
  assert.deepEqual(
    getGymVerificationHomeState({
      mobileGymVerificationAvailable: false,
      resume: '1',
      setupChecking: false,
      setupError: false,
      setupRequired: false
    }),
    {
      desktopSetupChecking: false,
      desktopSetupError: false,
      desktopSetupPending: false,
      resumeRequested: false,
      setupRequired: false,
      showWorkoutActions: false
    }
  );
});

test('desktop keeps contest status visible without exposing workout actions', () => {
  assert.deepEqual(
    getGymVerificationHomeState({
      mobileGymVerificationAvailable: false,
      resume: '1',
      setupChecking: false,
      setupError: false,
      setupRequired: true
    }),
    {
      desktopSetupChecking: false,
      desktopSetupError: false,
      desktopSetupPending: true,
      resumeRequested: false,
      setupRequired: false,
      showWorkoutActions: false
    }
  );
});

test('phone and tablet authentication preserves setup, resume and workout actions', () => {
  assert.equal(getAuthenticatedHomeRoute(true), '/home?resume=1');
  assert.deepEqual(
    getGymVerificationHomeState({
      mobileGymVerificationAvailable: true,
      resume: '1',
      setupChecking: false,
      setupError: false,
      setupRequired: true
    }),
    {
      desktopSetupChecking: false,
      desktopSetupError: false,
      desktopSetupPending: false,
      resumeRequested: true,
      setupRequired: true,
      showWorkoutActions: true
    }
  );
});

test('desktop reports background contest status without blocking the page', () => {
  assert.deepEqual(
    getGymVerificationHomeState({
      mobileGymVerificationAvailable: false,
      resume: '1',
      setupChecking: true,
      setupError: false,
      setupRequired: true
    }),
    {
      desktopSetupChecking: true,
      desktopSetupError: false,
      desktopSetupPending: false,
      resumeRequested: false,
      setupRequired: false,
      showWorkoutActions: false
    }
  );
  assert.deepEqual(
    getGymVerificationHomeState({
      mobileGymVerificationAvailable: false,
      resume: '1',
      setupChecking: false,
      setupError: true,
      setupRequired: true
    }),
    {
      desktopSetupChecking: false,
      desktopSetupError: true,
      desktopSetupPending: false,
      resumeRequested: false,
      setupRequired: false,
      showWorkoutActions: false
    }
  );
});
