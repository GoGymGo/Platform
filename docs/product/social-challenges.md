# Friends and monthly activity challenges

The social system supports consent-based friendships plus two kinds of
measurable, month-long activity challenge:

- **Challenge a Friend** is private. The creator selects accepted friends and/or
  creates expiring email or phone invite links, then chooses an activity, a
  weekly or monthly target, and a calendar-month window. Invitations begin in
  `pending` state.
- **Regional Challenge** is discoverable by active competition region. It adds
  a meeting location, one or more scheduled weekdays, a local start time, and
  an optional participant limit. Authenticated users in discovery can join it
  without a friend relationship.

The Expo Squad experience exposes My, Discover, and Create views. It reads and
mutates social state only through the authenticated API repository.

## Trust and privacy rules

- Screen names are unique, case-insensitive, and limited to 3-24 letters,
  numbers, or underscores.
- Friend search exposes only screen name and relationship state. A friendship
  exists only after the recipient accepts a request.
- In-app private challenge invitees must already be accepted friends. A creator
  can also send an opaque, expiring contact link; raw email addresses and phone
  numbers are normalized for delivery, then stored only as a hash and masked
  hint. Invite tokens are stored only as hashes and are single-use.
- Challenge windows are 1-31 days. Targets are 1-31 completions and can apply
  weekly or across the full month.
- Regional challenges require a supported region, a meeting location, a local
  start time, and at least one scheduled weekday. Capacity is 2-500 when set.
- One check-in can count per user, challenge, and local calendar day.
- Gym progress is derived from verified `workout_sessions`; a user cannot
  manually claim a gym visit. Other activities use an explicit daily check-in.
- All retryable mutations require `Idempotency-Key`.
- Privacy exports include the account's challenge configuration, membership,
  check-in history, and masked contact-invite metadata. Foreign internal user
  IDs and raw contact destinations are not included.

Challenges do not change competition eligibility, prize entries, leaderboard
scores, or sponsor rewards.

## Database migrations

`1783951200000_social_challenges.ts` introduces screen names, friend requests,
friendships, basic challenges, and challenge membership.

`1784160000000_structured_social_challenges.ts` adds:

- friend/regional challenge type;
- activity, display label, optional description, target, and target period;
- start and end dates;
- regional policy, meeting location, scheduled weekdays, local time, and
  participant limit;
- `social_challenge_checkins` with a unique challenge/user/day constraint and
  optional link to a verified workout session.

`1784163600000_weekly_challenges_creator_planning.ts` adds hashed email/phone
challenge invitations, consent-based Weekly Challenge partner requests,
creator video submissions, and creator calendar plans.

Apply locally:

```powershell
Set-Location '.\backend'
npm.cmd run migrate:up
npm.cmd run check
```

Apply compiled migrations before routing production traffic:

```powershell
npm.cmd run build
npm.cmd run migrate:deploy
```

## API contract

Every route requires a Firebase bearer token.

| Method  | Route                                               | Purpose                                           |
| ------- | --------------------------------------------------- | ------------------------------------------------- |
| `PATCH` | `/v1/me`                                            | Set the account screen name.                      |
| `GET`   | `/v1/social/users?screenName=...`                   | Find users by partial screen name.                |
| `GET`   | `/v1/social/friends`                                | List accepted friends.                            |
| `GET`   | `/v1/social/friend-requests`                        | List pending incoming and outgoing requests.      |
| `POST`  | `/v1/social/friend-requests`                        | Send a friend request.                            |
| `PATCH` | `/v1/social/friend-requests/:requestId`             | Accept or decline an incoming request.            |
| `GET`   | `/v1/social/challenges`                             | List owned, joined, and pending challenges.       |
| `GET`   | `/v1/social/challenges/discover?regionCode=...`     | Discover active regional challenges.              |
| `POST`  | `/v1/social/challenges`                             | Create a structured friend or regional challenge. |
| `POST`  | `/v1/social/challenges/:challengeId/join`           | Join an open regional challenge.                  |
| `POST`  | `/v1/social/challenges/:challengeId/check-ins`      | Record today's eligible activity.                 |
| `POST`  | `/v1/social/challenges/:challengeId/invitations`    | Invite an accepted friend to an owned challenge.  |
| `POST`  | `/v1/social/challenges/:challengeId/contact-invitations` | Create an email or phone invite link.          |
| `POST`  | `/v1/social/challenge-contact-invitations/redeem`   | Redeem a signed-in contact invitation.             |
| `PATCH` | `/v1/social/challenges/:challengeId/invitations/me` | Accept or decline the current user's invitation.  |

Example friend challenge request:

```json
{
  "name": "July 4x Gym Crew",
  "challengeType": "friend",
  "activity": "gym",
  "activityLabel": "Gym visits",
  "targetCount": 4,
  "targetPeriod": "weekly",
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "scheduledDays": [],
  "invitedFriendUserIds": ["10000000-0000-4000-8000-000000000002"]
}
```

Example regional additions:

```json
{
  "challengeType": "regional",
  "regionCode": "toronto-on",
  "locationName": "Waterfront Trail - Music Garden",
  "scheduledDays": [2, 4],
  "scheduledTime": "18:30",
  "participantLimit": 40
}
```

The generated `openapi.json` remains the authoritative field-level contract.

## Frontend integration

- `app/(tabs)/squad/index.tsx` links to **Challenge a Friend**.
- `app/(tabs)/squad/social.tsx` owns friend/search/request data flow and mutation
  feedback.
- `src/components/socialChallenges.tsx` owns the challenge builder, discovery
  cards, schedules, progress, and responsive controls.
- `src/domain/social.ts` owns shared types, normalization, and semantic input
  validation.
- `src/data/socialRepository.ts` and `src/data/socialHooks.ts` map the API,
  unavailable-service behavior, and TanStack Query state.

Run the mobile app:

```powershell
Set-Location '.\apps\member-app'
npm.cmd run check
npm.cmd run web
```

Database integration coverage requires Docker:

```powershell
$env:RUN_DATABASE_INTEGRATION='true'
npm.cmd run test:integration
Remove-Item Env:RUN_DATABASE_INTEGRATION
```
