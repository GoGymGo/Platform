# Brand rewards marketplace

GoGymGo contests now award sponsor-funded physical products and coupon codes.
The runtime contains no cash amount, bank-account setup, payment-provider,
payee, or transfer workflow. Rewards are scoped through their competition to a
single region and month.

## Data model and safety

- `reward_catalog_items` stores the sponsor, display content, reward type,
  availability window, inventory, claim path, publication status, and version.
- `reward_awards` records the immutable draw, winner, catalog item, rank, and
  claim/fulfillment status. Unique constraints prevent a user or rank from
  winning twice in one draw.
- `reward_coupon_codes` stores AES-256-GCM ciphertext and a SHA-256 fingerprint.
  Plaintext codes are accepted only by the authenticated operator endpoint and
  returned only to the authenticated winner after claiming an assigned award.
- Claim idempotency stores only a request hash; sensitive claim responses are
  reconstructed from the encrypted assignment and never cached as plaintext.
- A database trigger locks inventory and rejects over-allocation. Draw
  settlement expands published catalog inventory into exact reward slots and
  remains retry-safe.
- Physical rewards require an HTTPS sponsor claim URL or fulfillment
  instructions. GoGymGo does not collect shipping addresses in this version.

Use a random 32-byte base64 key for `REWARD_CODE_ENCRYPTION_KEY`. Generate one
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

Every mutation requires Firebase authentication, a database-backed operator or
admin role, an `Idempotency-Key`, and an audit reason. Create and edit rewards
while they are drafts. For coupon rewards, upload at least `inventoryTotal`
unique codes before publishing. Publish at least one reward before publishing
its competition. Published catalog records are immutable except for archival.

After a winner claims, an administrator records `fulfill` for a physical reward
or `redeem` for a coupon. Only an unclaimed award may be cancelled. These
row-locked, idempotent transitions update the corresponding fulfillment time and
append an operator audit event.

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

For a coupon reward, use `rewardType: "coupon"`, omit the physical claim path,
then upload codes using `{ "codes": ["CODE-ONE", "CODE-TWO"], "reason":
"Load sponsor-approved inventory." }`.

## Migration and release

Migration `1783954800000_brand_rewards_marketplace.ts` is intentionally
focused on the regional reward catalog, awards, and encrypted coupon inventory.
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
