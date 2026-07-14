import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getPublicInitials,
  parseStoredPublicIdentity,
  resolvePublicName
} from './profile';

describe('public profile identity', () => {
  it('uses the callsign in private mode', () => {
    assert.equal(
      resolvePublicName({ callsign: 'CameronW12', displayName: 'Cameron', mode: 'private' }),
      'CameronW12'
    );
  });

  it('uses the entered alias or real name for public display', () => {
    assert.equal(
      resolvePublicName({ callsign: 'GHOST-1234', displayName: '@camtrains', mode: 'alias' }),
      '@camtrains'
    );
    assert.equal(
      resolvePublicName({ callsign: 'GHOST-1234', displayName: 'Cameron Wilson', mode: 'real' }),
      'Cameron Wilson'
    );
  });

  it('falls back to the callsign when a public name is empty', () => {
    assert.equal(
      resolvePublicName({ callsign: 'CameronW12', displayName: '   ', mode: 'alias' }),
      'CameronW12'
    );
  });

  it('parses valid stored identity and rejects invalid data', () => {
    assert.deepEqual(
      parseStoredPublicIdentity('{"callsign":" CameronW12 ","displayName":"","mode":"private"}'),
      { callsign: 'CameronW12', displayName: '', mode: 'private' }
    );
    assert.equal(parseStoredPublicIdentity('{"callsign":12}'), null);
    assert.equal(parseStoredPublicIdentity('not json'), null);
  });

  it('derives compact initials from public names', () => {
    assert.equal(getPublicInitials('GHOST_RUNNER'), 'GR');
    assert.equal(getPublicInitials('CameronW12'), 'CA');
    assert.equal(getPublicInitials('Cameron Wilson'), 'CW');
  });
});
