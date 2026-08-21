import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

function source(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

test('Profile distinguishes opt-in, permission, local scheduling and private push state', () => {
  const profile = source('app/(tabs)/profile/index.tsx')

  for (const marker of [
    'OPTED IN',
    'PERMISSION //',
    'LOCAL // SCHEDULED',
    'GOAL 18:00',
    'CHALLENGE 18:15',
    'BONUS 09:00',
    'PUSH //',
    'PROVISIONAL',
    'RETRY REQUIRED',
    'UNAVAILABLE ON THIS PLATFORM OR CONFIGURATION'
  ]) {
    assert.match(profile, new RegExp(marker))
  }

  assert.match(profile, /accessibilityRole=["']switch["']/)
  assert.doesNotMatch(profile, /ExponentPushToken|pushToken/)
})

test('App Tour reminder reconciliation invokes no notification or account service', () => {
  const lifecycle = source('src/services/competitionReminderLifecycle.ts')

  assert.match(lifecycle, /if \(appTourActive\)/)
  assert.match(lifecycle, /localSchedule: \{ count: 0, status: 'unavailable'/)
  assert.match(lifecycle, /pushRegistration: \{ status: 'unavailable' \}/)
})
