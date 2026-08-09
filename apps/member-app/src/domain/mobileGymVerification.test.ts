import assert from 'node:assert/strict';
import test from 'node:test';

import { isMobileWebGymVerificationDevice } from './mobileGymVerification';

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
