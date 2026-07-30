import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeApiBaseUrl } from '@/config/api';

test('normalizes the backend origin used by versioned repository paths', () => {
  assert.equal(
    normalizeApiBaseUrl(' http://localhost:3000/v1/ '),
    'http://localhost:3000'
  );
  assert.equal(
    normalizeApiBaseUrl('https://api.gogymgo.com'),
    'https://api.gogymgo.com'
  );
  assert.equal(
    normalizeApiBaseUrl('https://host.example/api/v1'),
    'https://host.example/api'
  );
});

test('keeps an unconfigured API URL empty', () => {
  assert.equal(normalizeApiBaseUrl('   '), '');
});
