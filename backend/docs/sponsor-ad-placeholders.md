# Sponsor advertising placeholders

## Current boundary

GoGymGo reserves sponsor-ad placement metadata in the backend without serving
creative or changing the mobile interface. The authenticated read-only endpoint
is:

`GET /v1/me/sponsor-ad-placements`

The endpoint returns `implementationStatus: "placeholder"` and
`visualDeliveryEnabled: false`. Every placement has `creativeReady: false`, a
null `creativeId`, a null `mediaUrl`, and `trackingEnabled: false`. Calling the
endpoint therefore cannot play an ad, create an impression, or redirect a user.

## Eligibility boundary

The backend resolves the current active competition enrollment from the
authenticated Firebase principal. All video placeholders require that active
enrollment. If enrollment is missing, expired, withdrawn, disqualified, or not
part of the current registration/active competition window, every video
placement returns `eligibilitySatisfied: false`.

Banner eligibility is kept separate because banner inventory may eventually be
used on authenticated member screens without competition enrollment. Banners
remain excluded from authentication, onboarding, public, active-workout,
account-data, legal/privacy, and creator-submission contexts.

## Reserved placement inventory

| Key                                 | Format          | Trigger                                                  | Frequency placeholder             |
| ----------------------------------- | --------------- | -------------------------------------------------------- | --------------------------------- |
| `member_screen_banner`              | Banner          | Eligible authenticated member screen                     | One per eligible screen           |
| `post_login_video`                  | 15-second video | After explicit login and enrollment resolution           | Once per explicit login           |
| `verified_workout_completion_video` | 15-second video | After the verified result is visible                     | Once per verified competition day |
| `weekly_challenge_result_video`     | 15-second video | First settled-week recap view                            | Once per settled scoring week     |
| `winners_circle_video`              | 15-second video | First monthly-results detail view                        | Once per settled competition      |
| `rewards_marketplace_video`         | 15-second video | User selects a sponsor feature                           | User initiated                    |
| `creator_workout_launch_video`      | 15-second video | User selects an explicitly announced creator play action | User initiated                    |

The post-login placeholder applies only to a deliberate credential login. Token
refresh, app resume, tab navigation, and deep-link restoration are not explicit
login events and must not consume or retrigger it.

## Required future promotion gate

Visual delivery remains a separate future change. Before any placement can move
out of placeholder status, the implementation must add and validate:

1. approved competition/region/month campaign assignment and creative rights;
2. age-appropriate creative, clear advertising disclosure, mute, countdown,
   accessible close/skip behavior, and inappropriate-ad reporting;
3. fail-open loading so missing creative never blocks app navigation;
4. server-enforced frequency and idempotent event ingestion for requested,
   started, viewable, completed, skipped, failed, and clicked events;
5. contextual targeting only—never heart rate, health data, evidence, streak,
   exact location, legal identity, private social activity, or contact data;
6. retention, consent, privacy-export, deletion, fraud, aggregate reporting, and
   incident rules; and
7. iOS and Android policy, accessibility, security, sponsor, privacy, and legal
   approval.

No client may infer that a placeholder is playable, fabricate a creative URL,
or record an impression while `visualDeliveryEnabled` is false.
