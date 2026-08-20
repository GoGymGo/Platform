import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

test('privacy requests expose authoritative availability and lifecycle states', () => {
  const accountData = source('app/account-data.tsx');

  assert.match(accountData, /privacy-capabilities/);
  assert.match(accountData, /No request will be submitted/);
  assert.match(accountData, /LOADING REQUESTS/);
  assert.match(accountData, /Privacy request history could not load/);
  assert.match(accountData, /You have no account-data requests/);
  assert.match(accountData, /Processing failed safely/);
  assert.match(accountData, /Private export expires/);
  assert.match(
    accountData,
    /Your account remains\s+available\s+unless and until/
  );
  assert.match(accountData, /OPEN PRIVATE DOWNLOAD/);
  assert.match(accountData, /DELETE_MY_ACCOUNT/);
  assert.match(accountData, /CONFIRM DELETE REQUEST/);
});

test('device reset is explicit, local-only, retryable, and separately reachable', () => {
  const profile = source('app/(tabs)/profile/index.tsx');

  assert.match(profile, /route: ["']\/account-data["']/);
  assert.match(profile, /RESET APP ON THIS DEVICE/);
  assert.match(profile, /CONFIRM RESET & SIGN OUT/);
  assert.match(profile, /It never requests account deletion/);
  assert.match(profile, /unrelated app or browser data is\s+preserved/);
  assert.match(profile, /NO SERVER DATA WAS DELETED\. TRY AGAIN/);
  assert.match(profile, /queryClient\.clear\(\)/);
});
