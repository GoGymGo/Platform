# GoGymGo store privacy submission

This is the implementation-backed disclosure baseline for App Store Connect and
Google Play Data safety. It is not legal advice. Reconcile it with production
vendors, final policies, and counsel immediately before submission.

## Tracking and advertising

- GoGymGo does not use collected data to track people across apps or websites.
- GoGymGo does not use third-party or developer advertising in the mobile app.
- The native Apple privacy manifest declares tracking as false and has no
  tracking domains.

## Data linked to the account

All retained categories below are used for app functionality. Coarse region is
also used to personalize the competition, local scoring time, and available
rewards.

| Store category | GoGymGo examples |
| --- | --- |
| Name | Optional public alias or real-name profile mode; application contact names |
| Email address | Firebase account email and partner application contact email |
| Phone number | Optional contact challenge invitation, stored only as a hash and masked hint |
| Physical address | Optional partner-gym application address |
| Health | Heart-rate samples used to verify a workout |
| Fitness | Workout sessions, duration, goal, progress, and streak records |
| Coarse location | Approved competition region retained on the account |
| Photos or videos | Optional profile image and creator video submission |
| Gameplay content | Competition enrollment, matching, score, entries, and results |
| Other user content | Challenge descriptions, notes, and partner application content |
| User ID | Firebase UID, internal account ID, screen name, and callsign |
| Device ID | Push-notification token linked to the signed-in account |

Public streak payloads contain only four nonnegative calendar counts and the
`streaks-v1` projection version. They contain no account identifier, contact,
region, location, or workout detail. The owning ranking/social/results response
supplies the permitted public Alias. When `privacySettings.showStats = false`,
actual streak counts are suppressed and required list shapes receive a canonical
all-zero projection that renders no badges; the authenticated member can still
read their own summary.

## Precise location handling

The app sends a foreground coordinate pair only when the player explicitly taps
**Use My Location**, **Start Workout**, or **Finish Workout**. Region setup tests
the point against active PostGIS competition boundaries. Workout checks test it
against the Partner gym saved to the player's Contest enrollment. The API stores
the approved region or gym-presence result, not the coordinate pair. Historical
region evidence is scrubbed by migration
`1784181600000_authoritative_region_verification.ts`.

Region verification additionally sends the device observation time and reported
horizontal accuracy so the API can reject stale or inaccurate readings. Those
values are minimized to the current technical thresholds; coordinates remain
absent from retained evidence and operator views.

## Regional availability requests

The landing and signed-in unsupported-region forms require an explicit regional
email-updates checkbox and record the notice version and consent time. Public
responses contain no email, record identifier, or internal workflow state.
Signed-in requests are included in account export and deletion; requests made
without an account use the email-based privacy process. Legacy rows without the
current notice cannot advance to outreach states. Retention duration remains a
legal approval gate documented in `docs/operations/region-eligibility.md`.

Apple defines collection as retaining off-device data longer than needed to
service the real-time request. On that basis, the manifest declares the retained
coarse region, not precise location. Confirm this interpretation against the
deployed infrastructure and production logging policy before submission.

## Data intentionally not collected

- Camera frames, face geometry, Face ID data, voice, and microphone audio
- Raw precise-location coordinates after a region or gym-presence request completes
- Address-book contacts
- Payment-card or bank-account information
- Advertising identifiers or cross-app tracking data

## Required submission URLs

Set these release environment values to final public HTTPS pages:

- `GOGYMGO_PRIVACY_POLICY_URL`
- `GOGYMGO_ACCOUNT_DELETION_URL`

The deletion page must explain how to request deletion without reinstalling the
app. The in-app **Account Data** screen already exposes authenticated deletion
and export requests. The landing application now provides the public
`/account-deletion` route, which sends an account owner to the same Account Data
workflow in the browser and provides browser password-reset recovery. Production
submission remains gated on publishing that route at the final HTTPS domain and
approving its wording.

## Submission verification

Before each release:

1. Run `npm run audit:release` with the production environment.
2. Generate the iOS project with `GOGYMGO_RELEASE_BUILD=true` and confirm its
   `Info.plist` contains only camera, Face ID, foreground location, and photo
   library usage descriptions.
3. Confirm `PrivacyInfo.xcprivacy` is included in the app target and matches
   this disclosure table.
4. Compare every deployed SDK and backend log sink with both store privacy
   questionnaires.
5. Have privacy counsel approve the final public policy, retention schedule,
   contest terms, and health/fitness handling.

Authoritative references:

- https://developer.apple.com/app-store/app-privacy-details/
- https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://support.google.com/googleplay/android-developer/answer/13327111
