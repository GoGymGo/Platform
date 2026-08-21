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
deliver the native 30-minute notification. After publication, both
`/.well-known` association URLs must return 403 or 404; returning the SPA HTML is
a release failure.

The native requirements below remain mandatory for any signed iOS or Android
release and do not block this explicitly browser-only pilot.

## What is already implemented

- Gym posters use `https://app.gogymgo.com/scan?credential=...`.
- The browser flow preserves the scan through sign-in, sign-up, email
  verification, password recovery, region setup, and Weekly Goal selection.
- After authoritative enrollment, the app removes the poster credential from
  local storage and uses the immutable enrolled Contest/gym/version evidence
  for later start and finish location checks.
- Authenticated players return to the Start Workout or Finish Workout screen.
- iOS registers `app.gogymgo.com` as an associated domain.
- Android registers `/scan` as a verified App Link.
- The web build can generate the Apple and Android domain-association files.
- The server remains authoritative for the workout timer, gym assignment,
  geofence checks, and final verification.

## Values required before production deployment

Never guess or publish placeholders for these values:

| Environment variable            | Required value                                                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOGYMGO_IOS_TEAM_ID`           | The 10-character Apple Developer Team ID that signs GoGymGo.                                                                                                                                                    |
| `GOGYMGO_IOS_BUNDLE_ID`         | The final iOS bundle identifier registered for GoGymGo.                                                                                                                                                         |
| `GOGYMGO_ANDROID_PACKAGE`       | The final Android application ID registered for GoGymGo.                                                                                                                                                        |
| `GOGYMGO_ANDROID_CERT_SHA256`   | The SHA-256 fingerprint of every certificate that signs a distributed Android build. Use comma-separated fingerprints when needed. A Google Play install requires the Play App Signing certificate fingerprint. |
| `GOGYMGO_EAS_OWNER`             | The exact EAS account owner for the registered GoGymGo project.                                                                                                                                                 |
| `GOGYMGO_EAS_PROJECT_ID`        | The exact EAS project UUID for GoGymGo.                                                                                                                                                                         |
| `GOGYMGO_APP_STORE_URL`         | The final public Apple App Store listing URL.                                                                                                                                                                   |
| `GOGYMGO_PLAY_STORE_URL`        | The final public Google Play listing whose `id` is exactly `GOGYMGO_ANDROID_PACKAGE`.                                                                                                                           |
| `GOGYMGO_PRIVACY_POLICY_URL`    | The final public HTTPS privacy-policy URL used by the store listings.                                                                                                                                           |
| `GOGYMGO_ACCOUNT_DELETION_URL`  | The final public HTTPS account-deletion URL used by the store listings.                                                                                                                                         |
| `GOGYMGO_NATIVE_LINKS_APPROVED` | The exact value `yes`, set only after the identifiers, signing evidence, listings, legal URLs, and device-test plan have been approved.                                                                         |

The iOS bundle ID and Android package must match the apps registered in Firebase,
the signed native builds, and the values used to generate the association files.

## Required order of operations

1. Finalize the Apple and Android app identifiers, EAS project ownership, and
   store registrations. Record only the authoritative provider values.
2. Obtain the Apple Team ID and the SHA-256 fingerprint for every certificate
   used by a distributed Android build, including Play App Signing.
3. Complete the public store listings, privacy policy, and account-deletion
   page. Add every required value above to the protected `production`
   environment, but keep `GOGYMGO_NATIVE_LINKS_APPROVED` disabled.
4. Create signed release candidates under separate native-build authorization.
   Confirm their bundle/package identifiers and signing evidence exactly match
   the protected values. The repository workflow does not build, sign, or
   submit native binaries.
5. After the identifiers, signing evidence, candidates, listings, legal URLs,
   and test plan are reviewed, authorize association publication and set
   `GOGYMGO_NATIVE_LINKS_APPROVED=yes` in the protected environment.
6. From the repository root, run the repository audits against those approved
   values:

   ```powershell
   npm.cmd run audit:release --workspace @gogymgo/member-app
   npm.cmd run build --workspace @gogymgo/member-app
   ```

7. Confirm the build contains exactly both files:

   ```text
   apps/member-app/dist/.well-known/apple-app-site-association
   apps/member-app/dist/.well-known/assetlinks.json
   ```

8. Dispatch `Platform Deployment` from `main` with scope `member-native-links`, protected
   environment `production`, and the exact reviewed merge SHA. The workflow
   refuses staging, non-canonical origins, incomplete values, and unreviewed
   commits. It publishes assets first, associations second, and `index.html`
   last; verifies the attested bytes after assuming the AWS role; and restores
   the prior entrypoint and association state if public verification fails.
9. Confirm both public URLs return HTTP 200, `application/json`, exact approved
   bytes, and no authentication or redirect:

   ```text
   https://app.gogymgo.com/.well-known/apple-app-site-association
   https://app.gogymgo.com/.well-known/assetlinks.json
   ```

10. Install the exact signed iOS and Android candidates. Existing installations
    may not contain the new native link declarations. Allow for Apple association
    CDN propagation before treating an immediate iOS miss as final.
11. Test a real SkyGate poster on physical iPhone and Android devices and record
    the signed-build identifiers, association response digests, devices, OS
    versions, and results in the release evidence.

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
9. Denied camera and location permissions show recoverable instructions; cancel
   returns safely; a malformed, expired, revoked, cross-Contest, or unassigned
   poster fails without creating or changing enrollment.

Location is checked when the player submits Start Workout and Finish Workout. The
app does not continuously track the player or automatically boot them out when
they move outside the radius.

## Rollback

The protected workflow captures the current `index.html` and both association
objects before its first write. Any upload, invalidation, route-digest, content-
type, byte-comparison, or omission check failure restores that prior state and
invalidates CloudFront again. Hashed assets are uploaded without `--delete`, so
the prior entrypoint remains usable during automatic recovery; routine cleanup
of unreferenced old assets is a separate, reviewed retention operation.

For a post-release incident, disable native-link approval, prepare a reviewed
browser-pilot release from an exact merged-main commit, and dispatch the
`member-web` scope. That mode deletes both association objects and verifies 403
or 404 while preserving the HTTPS browser fallback. Native client rollback or
store removal is separate provider work and must follow the signed-build release
record. Never edit association JSON or an S3 entrypoint by hand during recovery.

## Current native-release blocker

As of August 21, 2026, the repository deliberately contains none of the final
Apple Team ID, iOS bundle ID, Android package, Android signing fingerprints, EAS
owner/project, store listing URLs, or release approval. No provider publication,
signed build, store submission, or physical-device UAT has occurred as part of
repository readiness. Native QR opening must not be described as live until all
protected values are configured, exact associations are published, the signed
builds are installed, and the physical-device test passes. This does not block
the protected browser-only pilot described above.
