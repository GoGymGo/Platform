import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultFeatureCapabilities,
  resolveFeatureCapabilities,
} from '@gogymgo/contracts/feature-capabilities';

test('keeps creator features disabled by default', () => {
  assert.deepEqual(defaultFeatureCapabilities, {
    creatorFeaturesEnabled: false,
  });
  assert.deepEqual(resolveFeatureCapabilities(), defaultFeatureCapabilities);
});

test('resolves explicit enabled and disabled creator releases', () => {
  assert.equal(
    resolveFeatureCapabilities({ creatorFeaturesEnabled: 'true' })
      .creatorFeaturesEnabled,
    true,
  );
  assert.equal(
    resolveFeatureCapabilities({ creatorFeaturesEnabled: 'false' })
      .creatorFeaturesEnabled,
    false,
  );
});

test('rejects an invalid creator feature capability', () => {
  assert.throws(
    () =>
      resolveFeatureCapabilities({
        creatorFeaturesEnabled: 'yes',
      }),
    /Expected "true" or "false"/,
  );
});
