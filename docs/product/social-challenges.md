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

- Aliases are normalized to uppercase, unique case-insensitively, and limited to
  3-24 ASCII letters, numbers, or underscores. System, support, moderator, and
  generated private callsigns cannot be claimed as public Aliases.
- Authenticated Alias search is prefix-only, rate-limited, and bounded to 20
  results. It exposes only the public Alias, permitted `streaks-v1` projection,
  and relationship state. It excludes the caller, private identities, and both
  sides of a block.
- Friend requests are mutually unique while pending. Only the recipient may
  accept or decline, only the requester may cancel, and either friend may remove
  the accepted friendship. These mutations are retry-safe and audited.
- A block immediately cancels pending requests and incompatible Weekly
  Challenge state, removes the friendship and shared Challenge membership, and
  prevents discovery, requests, invitations, and shared projections in either
  direction. Unblocking never recreates prior state.
- In-app private challenge invitees must already be accepted friends. A creator
  can instead create an opaque, expiring contact link. GoGymGo does not send the
  link by email or SMS: the API returns `deliveryMode: link` and
  `deliveryStatus: not_sent`, and the member chooses Copy or the device share
  sheet. No email/SMS delivery provider is configured or contacted.
- Raw email addresses and phone numbers are normalized only during intake. The
  database stores a masked hint plus token-bound destination, creation-key, and
  token hashes. A signed-in recipient first reviews the masked destination,
  explicitly accepts, and must match the verified email or confirm the invited
  phone. Links expire after 31 days, are single-use, and rotate on a completed
  creation retry so an opaque token never enters the idempotency response store.
- Challenge windows are 1-31 days. Targets are 1-31 completions and can apply
  weekly or across the full month.
- Regional challenges require a supported region, a meeting location, a local
  start time, and at least one scheduled weekday. Capacity is 2-500 when set.
- One check-in can count per user, challenge, and local calendar day.
- Gym progress is derived from verified `workout_sessions`; a user cannot
  manually claim a gym visit. Other activities use an explicit daily check-in.
- All retryable mutations require `Idempotency-Key`.
- Privacy exports include the account's challenge configuration, membership,
  check-in history, friendship/request/block history, relationship audit events,
  and masked contact-invite metadata. Foreign internal user IDs, raw contact
  destinations, destination hashes, creation hashes, and invite tokens are not
  included. Resolved invitation metadata is purged after 90 days by the
  operations worker.

Challenges do not change competition eligibility, prize entries, leaderboard
scores, or sponsor rewards.

## Direct Weekly Challenges

Direct Weekly Challenges are a separate Contest feature from the general
friend/regional Challenges above. During the current seven-day scoring week,
an enrolled member may request an accepted, unblocked friend who has the same
active Contest, region, and immutable Weekly Goal. The recipient explicitly
accepts or declines; an outgoing pending request can be cancelled. Enrollment,
activation, reads, and settlement never assign a stranger or infer consent.

The API returns eligible command handles only on the eligible-partner list.
Request and match detail omit internal user IDs and private workout dates. A
matched detail contains the partner Alias, privacy-permitted `streaks-v1`
badges/current/best streak, monthly verified-day total, and the current week's
verified count. Friend removal, either-direction block, withdrawal, or Contest
cancellation closes incompatible open state transactionally without deleting
history. One accepted assignment remains consumed for that player/week.

Weekly outcome values are server projections until the scoring worker settles
canonical eligible sessions into the append-only ledger: 0x for a missed goal,
1x for a met solo goal or a met goal when the partner misses without an extra
workout, 2x when both meet the goal, and 3x only when the user meets the goal,
the partner misses, and the user completes an eligible extra workout.

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

`1787101200000_friendship_privacy_integrity.ts` adds blocks, append-only social
relationship events, reserved-Alias protection, blocked-pair database guards,
terminal-state guards, link-only/versioned invitation metadata, and indexes for
expiry processing.

`1787187600000_direct_weekly_challenges.ts` adds accepted/cancellation evidence,
accepted-request match provenance, normalized active match participants,
permanent assignment participants, and database triggers that enforce exact
week dates, same-goal active enrollment, accepted friendship, block precedence,
and one assignment per player/week across both match roles.

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
| `GET`   | `/v1/social/users?screenName=...`                   | Find public users by Alias prefix.                 |
| `GET`   | `/v1/social/friends`                                | List accepted friends.                            |
| `GET`   | `/v1/social/friend-requests`                        | List pending incoming and outgoing requests.      |
| `POST`  | `/v1/social/friend-requests`                        | Send a friend request.                            |
| `PATCH` | `/v1/social/friend-requests/:requestId`             | Accept or decline an incoming request.            |
| `DELETE`| `/v1/social/friend-requests/:requestId`             | Cancel an outgoing pending request.               |
| `DELETE`| `/v1/social/friends/:friendUserId`                  | Remove an accepted friendship.                    |
| `GET`   | `/v1/social/blocks`                                 | List members blocked by the caller.               |
| `POST`  | `/v1/social/blocks`                                 | Block a member and remove incompatible state.     |
| `DELETE`| `/v1/social/blocks/:blockedUserId`                  | Unblock without restoring prior state.            |
| `GET`   | `/v1/social/challenges`                             | List owned, joined, and pending challenges.       |
| `GET`   | `/v1/social/challenges/discover?regionCode=...`     | Discover active regional challenges.              |
| `POST`  | `/v1/social/challenges`                             | Create a structured friend or regional challenge. |
| `POST`  | `/v1/social/challenges/:challengeId/join`           | Join an open regional challenge.                  |
| `POST`  | `/v1/social/challenges/:challengeId/check-ins`      | Record today's eligible activity.                 |
| `POST`  | `/v1/social/challenges/:challengeId/invitations`    | Invite an accepted friend to an owned challenge.  |
| `POST`  | `/v1/social/challenges/:challengeId/contact-invitations` | Create an email or phone invite link.          |
| `POST`  | `/v1/social/challenge-contact-invitations/inspect`  | Review masked invitation metadata after sign-in.  |
| `POST`  | `/v1/social/challenge-contact-invitations/redeem`   | Redeem a signed-in contact invitation.             |
| `PATCH` | `/v1/social/challenges/:challengeId/invitations/me` | Accept or decline the current user's invitation.  |

Direct Weekly Challenge routes are under `/v1/competitions`:

| Method   | Route                                                                    | Purpose                                      |
| -------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| `GET`    | `/:monthKey/matches?competitionId=...&goal=...&region=...`              | Read privacy-safe weekly state/outcomes.     |
| `GET`    | `/:monthKey/weekly-challenges/eligible-partners?...`                    | List currently eligible accepted friends.   |
| `GET`    | `/:monthKey/weekly-challenges/requests?...`                             | List owned incoming/outgoing requests.       |
| `POST`   | `/:monthKey/weekly-challenges/requests`                                 | Create an idempotent direct request.         |
| `PATCH`  | `/weekly-challenges/requests/:requestId`                                | Explicitly accept or decline an invite.      |
| `DELETE` | `/weekly-challenges/requests/:requestId`                                | Cancel an owned pending outgoing invite.     |

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
