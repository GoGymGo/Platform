import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createPrivateIdentity,
  getPublicInitials,
  parseStoredPublicIdentity,
  publicIdentityFromAccountProfile,
  resolvePublicName
} from './profile';

describe('public profile identity', () => {
  it('creates a stable private callsign without exposing account details', () => {
    assert.deepEqual(createPrivateIdentity('firebase-user-abc123'), {
      callsign: 'PLAYER_ABC123',
      displayName: '',
      mode: 'private'
    });
    assert.equal(createPrivateIdentity(null).callsign, 'GOGYMGO_PLAYER');
  });

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
      resolvePublicName({ callsign: 'GHOST-1234', displayName: 'Cameron Wilson', mode: 'real_name' }),
      'Cameron Wilson'
    );
  });

  it('restores the same public identity from the authoritative account profile', () => {
    assert.deepEqual(
      publicIdentityFromAccountProfile({
        callsign: 'GG-ABC123',
        publicIdentityMode: 'alias',
        publicName: 'MOVE_MORE',
        screenName: 'MOVE_MORE'
      }),
      {
        callsign: 'GG-ABC123',
        displayName: 'MOVE_MORE',
        mode: 'alias'
      }
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
