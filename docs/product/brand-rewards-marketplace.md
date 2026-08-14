# Brand rewards marketplace

GoGymGo contests now award sponsor-funded physical products and coupon codes.
The runtime contains no cash amount, bank-account setup, payment-provider,
payee, or transfer workflow. Rewards are scoped through their competition to a
single region and month.

## Data model and safety

- `reward_catalog_items` stores the sponsor, display content, reward type,
  availability window, inventory, claim path, publication status, and version.
  Public reads include only published, undeleted items whose competition,
  enabled region policy, region validity, month, and availability window all
  match the request. Responses expose bounded total/remaining counts, never
  coupon rows or allocation details.
- `reward_awards` records the immutable draw, winner, catalog item, rank, and
  versioned claim/fulfillment status. Database constraints require a settled
  draw and published inventory from the same competition. Unique constraints
  prevent a user or rank from winning twice in one draw.
- `reward_coupon_codes` stores AES-256-GCM ciphertext and a SHA-256 fingerprint.
  Plaintext codes are accepted only by the authenticated operator endpoint and
  returned only to the authenticated winner after claiming an assigned award.
- Claim idempotency stores only a request hash; sensitive claim responses are
  reconstructed from the encrypted assignment and never cached as plaintext.
- A database trigger locks inventory and rejects over-allocation. Draw
  settlement expands published catalog inventory into exact reward slots and
  remains retry-safe.
- Published rewards require an approved HTTPS image and terms URL. Physical
  rewards require exactly one HTTPS sponsor claim URL or fulfillment
  instructions; coupon rewards permit neither. GoGymGo does not collect
  shipping addresses in this version.

Use a random 32-byte canonical standard-base64 key for
`REWARD_CODE_ENCRYPTION_KEY` (exactly 44 characters ending in `=`). Generate one
without placing it in shell history:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Store the result in the environment's secret manager. Never expose it through
Expo variables, logs, Terraform state, API responses, or source control.

## API contract

Public marketplace:

```http
GET /v1/rewards/catalog?region=victoria-bc&monthKey=2026-08
```

Authenticated winner actions:

```http
GET /v1/rewards/awards/me
POST /v1/rewards/awards/{awardId}/claim
Idempotency-Key: unique-client-operation-id
```

The claim response contains exactly one fulfillment path: `couponCode` for a
coupon or sponsor-provided `claimUrl`/`fulfillmentInstructions` for a physical
reward. Catalog and award DTOs are generated in `openapi.json`.

Operator/admin configuration:

```http
POST /v1/operator/configuration/rewards
PUT /v1/operator/configuration/rewards/{rewardId}
POST /v1/operator/configuration/rewards/{rewardId}/coupon-codes
POST /v1/operator/configuration/rewards/{rewardId}/status-action
POST /v1/operator/reward-awards/{awardId}/status-action
```

Every mutation requires Firebase authentication, the exact database-backed
platform `admin` role, an `Idempotency-Key`, and a specific audit reason. Updates, coupon
uploads, publication, archival, deletion, fulfillment, redemption, and
cancellation also require the last observed `expectedVersion`; every successful
mutation advances the authoritative version. Create and edit rewards while they
are drafts. For coupon rewards, upload at least `inventoryTotal` unique codes
before publishing. Codes are trimmed, Unicode NFKC-normalized, rejected when
duplicate after normalization, encrypted before persistence, and never returned
by an admin read. Publish at least one reward before publishing its competition.
Published catalog records are immutable except for archival.

After a winner claims, an administrator records `fulfill` for a physical reward
or `redeem` for a coupon. Only an unclaimed award may be cancelled. These
row-locked, idempotent transitions update the corresponding fulfillment time and
append an operator audit event.

The operator dashboard lists only fulfillment-safe award metadata: winner
callsign, rank, reward type/title, lifecycle status, timestamps, and version.
It never returns coupon plaintext, ciphertext, fingerprints, or private member
claim instructions.

Example draft physical reward body:

```json
{
  "competitionId": "00000000-0000-4000-8000-000000000000",
  "sponsorName": "Example Brand",
  "title": "Training Pack",
  "description": "A sponsor-provided training pack for a regional winner.",
  "rewardType": "physical",
  "imageUrl": "https://cdn.example.com/training-pack.jpg",
  "termsUrl": "https://example.com/contest-terms",
  "claimUrl": "https://example.com/secure-claim",
  "inventoryTotal": 5,
  "displayOrder": 10,
  "reason": "Configure approved August contest inventory."
}
```

For a coupon reward, use `rewardType: "coupon"`, omit both physical claim
fields, then upload codes using `{ "codes": ["CODE-ONE", "CODE-TWO"],
"expectedVersion": 1, "reason": "Load sponsor-approved inventory." }`. Use
the returned version for publication. Award status actions likewise send the
award's current `expectedVersion`.

## Migration and release

Migration `1783954800000_brand_rewards_marketplace.ts` creates the regional
reward catalog, awards, and encrypted coupon inventory. Migration
`1787360400000_brand_reward_integrity.ts` adds exact catalog, draw, award,
coupon-assignment, lifecycle timestamp, and optimistic-version invariants.
Because GoGymGo has not deployed a production database, the preproduction
migration baseline was cleaned before launch: a fresh database never creates
payment-provider, cash-winner, or demo-verification schema. The integration
suite asserts those obsolete tables, columns, and types are absent.

1. Verify a recent database backup and point-in-time recovery window before
   every migration rollout.
2. Add `REWARD_CODE_ENCRYPTION_KEY` to Secret Manager and mount it only into the
   API workload.
3. From the repository root, run `npm.cmd ci`, `npm.cmd run check --workspace @gogymgo/api`, then
   `npm.cmd run migrate:up` locally. Production uses the migration job via
   `npm.cmd run migrate:deploy` before worker and API deployment.
4. Deploy the same immutable image to migration, worker, and API in that order.
5. Publish region/month catalog inventory through the operator endpoints, then
   publish the competition.
6. Build the Expo client. The marketplace route is
   `/(tabs)/leaderboard/rewards`; winner claims use `/rewards/awards`.
7. In staging, verify physical and coupon catalogs, insufficient-code publish
   rejection, draw inventory limits, duplicate claim idempotency, coupon
   secrecy in logs/exports, and the removed legacy routes returning 404.

Brand-supplied images, redemption terms, inventory ownership, fulfillment SLAs,
regional eligibility, expiry, substitutions, and contest rules still require
business and legal approval before a catalog is published.
