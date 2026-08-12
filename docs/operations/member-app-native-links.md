# Member app QR-link deployment checklist

This is the durable handoff for the gym-poster QR flow. Read it before publishing
the browser member app at `app.gogymgo.com` or creating signed iOS and Android
releases.

## Browser-only pilot boundary

The connected browser pilot may be published before native signing identifiers
exist. That release uses the protected `Member Web Deployment` workflow and must
pass, after building the exact export:

```powershell
npm.cmd run audit:browser-pilot-release --workspace @gogymgo/member-app -- dist
```

The pilot intentionally omits both native association files. A phone-camera QR
still opens its `https://app.gogymgo.com/scan?credential=...` page in Safari or
Chrome, where camera and foreground location permissions can be tested. Do not
describe this as opening an installed app, and do not expect a closed browser to
deliver the native 30-minute notification.

The native requirements below remain mandatory for any signed iOS or Android
release and do not block this explicitly browser-only pilot.

## What is already implemented

- Gym posters use `https://app.gogymgo.com/scan?credential=...`.
- The browser flow preserves the scan through sign-in, sign-up, email
  verification, password recovery, region setup, and Weekly Goal selection.
- Authenticated players return to the Start Workout or Finish Workout screen.
- iOS registers `app.gogymgo.com` as an associated domain.
- Android registers `/scan` as a verified App Link.
- The web build can generate the Apple and Android domain-association files.
- The server remains authoritative for the workout timer, gym assignment,
  geofence checks, and final verification.

## Values required before production deployment

Never guess or publish placeholders for these values:

| Environment variable | Required value |
| --- | --- |
| `GOGYMGO_IOS_TEAM_ID` | The 10-character Apple Developer Team ID that signs GoGymGo. |
| `GOGYMGO_IOS_BUNDLE_ID` | The final iOS bundle identifier registered for GoGymGo. |
| `GOGYMGO_ANDROID_PACKAGE` | The final Android application ID registered for GoGymGo. |
| `GOGYMGO_ANDROID_CERT_SHA256` | The SHA-256 fingerprint of every certificate that signs a distributed Android build. Use comma-separated fingerprints when needed. A Google Play install requires the Play App Signing certificate fingerprint. |

The iOS bundle ID and Android package must match the apps registered in Firebase,
the signed native builds, and the values used to generate the association files.

## Required order of operations

1. Finalize the Apple and Android app identifiers and register the native apps.
2. Obtain the Apple Team ID and the SHA-256 fingerprint for each signing
   certificate used by a distributed Android build.
3. Add the four values above to the protected production build environment.
4. From the repository root, run:

   ```powershell
   npm.cmd run audit:release --workspace @gogymgo/member-app
   npm.cmd run build --workspace @gogymgo/member-app
   ```

5. Confirm the build contains both files:

   ```text
   apps/member-app/dist/.well-known/apple-app-site-association
   apps/member-app/dist/.well-known/assetlinks.json
   ```

6. Publish that exact validated web build to the provider serving
   `app.gogymgo.com`.
7. Confirm both public URLs return HTTP 200, JSON content, and no authentication
   or redirect:

   ```text
   https://app.gogymgo.com/.well-known/apple-app-site-association
   https://app.gogymgo.com/.well-known/assetlinks.json
   ```

8. Create and install newly signed iOS and Android builds. Existing installations
   may not contain the new native link declarations.
9. Test a real SkyGate poster on physical iPhone and Android devices.

The hosting vendor does not matter to Universal Links or App Links. The provider
that actually answers for `app.gogymgo.com` must serve these two files. The
repository's `firebase.json` headers apply only when Firebase Hosting is that
provider; another provider needs equivalent routes and `application/json`
responses.

## Physical-device acceptance test

Test all of these before announcing the QR flow:

1. New player scans, creates an account, completes setup, and reaches Start
   Workout without rescanning.
2. Returning signed-out player scans, signs in, and reaches Start Workout.
3. Signed-in player uses a fresh start location check and starts the
   server-authoritative timer.
4. Player uses a fresh finish location check after the minimum duration and
   reaches Finish Workout.
5. A location check submitted outside the configured gym radius is rejected by
   the server.
6. The browser fallback still works when no native app is installed.
7. With native notification permission enabled, the installed app sends a local
   reminder when the server's 30-minute minimum is reached and opens the gym
   location screen when the reminder is tapped.
8. The browser build shows the completion banner while open and immediately when
   reopened. Do not claim that a fully closed browser tab will notify the player;
   that requires a separately deployed web-push service.

Location is checked when the player submits Start Workout and Finish Workout. The
app does not continuously track the player or automatically boot them out when
they move outside the radius.

## Current native-release blocker

As of August 11, 2026, the code and build pipeline are prepared, but the final
Apple Team ID, iOS bundle ID, Android package, and Android signing-certificate
fingerprint have not been recorded in this repository. Native QR opening must not
be described as live until those real values are configured, the association
files are published, signed builds are installed, and the physical-device test
passes. This does not block the protected browser-only pilot described above.
