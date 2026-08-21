import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

test('Profile renders authoritative moderated-avatar lifecycle states', () => {
  const profile = source('app/(tabs)/profile/index.tsx')
  const state = source('src/state/profile.tsx')

  for (const marker of [
    'CHECKING PROFILE PICTURE AVAILABILITY',
    'PROFILE PICTURE UPLOADS ARE NOT ENABLED',
    'RETRY PICTURE SERVICE',
    'PICTURE PENDING MODERATION',
    'PICTURE WAS NOT APPROVED',
    'PICTURE UPLOAD IS INCOMPLETE',
    'APPROVED PICTURE ACTIVE',
    'INITIALS AVATAR ACTIVE',
    'REMOVE'
  ]) {
    assert.match(profile, new RegExp(marker))
  }
  assert.match(state, /result\.state\.active\?\.readUrl \?\? null/)
  assert.doesNotMatch(
    state,
    /setProfileImageUri\(uri\)[\s\S]{0,200}uploadAvatar/
  )
  assert.match(state, /active\.id}:\$\{.*active\.version/)
})

test('Profile keeps public Alias, private identity, account data, withdrawal, reset and sign-out distinct', () => {
  const profile = source('app/(tabs)/profile/index.tsx')

  assert.match(profile, /USE PUBLIC ALIAS/)
  assert.match(profile, /USE PRIVATE PLAYER ID/)
  assert.match(profile, /route: ['"]\/account-data['"]/)
  assert.match(profile, /WITHDRAW FROM THIS CONTEST/)
  assert.match(profile, /RESET APP & SIGN OUT/)
  assert.match(profile, /It never requests account deletion/)
  assert.match(profile, /SIGN OUT/)
})
