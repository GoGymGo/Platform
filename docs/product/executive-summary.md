# GoGymGo executive summary

GoGymGo turns gym attendance into a verified, social contest experience. Users
choose a monthly commitment, complete verifiable workouts, build daily/weekly/
monthly/yearly streaks, compare regional and gym standings, connect with friends,
and create named challenges with invitations.

Regional brand contests offer physical products and coupon codes through an
in-app rewards marketplace. Every badge displays its live consecutive-period
count. Every contest reward shows its sponsor, type, inventory, region, month,
terms, and availability. A locked badge represents a zero streak; an unavailable
or out-of-stock reward is never presented as claimable.

The first business model is sponsor-funded promotion and inventory rather than
consumer payments. Brands provide approved products or unique coupon codes for
specific regional contests and can receive aggregate, privacy-safe reporting on
campaign reach and verified participation. No purchase is required to join.

The product is built as one Expo/React Native TypeScript app backed by a NestJS
modular monolith, Firebase Authentication, PostgreSQL/PostGIS, private object
storage, and a durable operations worker. The server owns identity, consent,
verification, entries, draws, catalog inventory, awards, coupon encryption,
claims, social permissions, and audit records.

The September pilot has one GoGymGo-sponsored $100 CAD cash reward that is
handed over in person and recorded manually after the audited draw settles. The
MVP deliberately has no wallet, payment processor, bank-account setup, payee
onboarding, automated payout, transfer, balance, webhook, or tax-form workflow.
Recording the handoff cannot move money. Coupon codes are
AES-256-GCM encrypted at rest and revealed only to the authenticated winner.
Physical rewards use sponsor-provided claim instructions or an HTTPS claim link;
GoGymGo does not collect shipping addresses in this version.

Launch should start with one or two counsel-approved regions and a small set of
contracted brands. Each sponsor agreement must cover inventory ownership, image
and trademark rights, official terms, expiry, substitutions, fulfillment and
support SLAs, code replacement, reporting, and incident responsibilities.
Workout verification, privacy/health consent, regional eligibility, contest
rules, fraud review, accessibility, and real-device behavior must pass staging
and legal review before registration opens.
