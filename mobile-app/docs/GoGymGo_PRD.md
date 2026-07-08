# GoGymGo Product Requirements Document

## 1. Overview And Objectives

### Vision

GoGymGo is a free mobile app that helps people build consistent physical activity habits by rewarding verified attendance. Users pick a creator to follow during onboarding, set monthly activity commitments expressed as 1 to 7 activity days per week, complete 30-minute sessions verified by either heart-rate data or partnered-gym QR entry/exit scans plus biometric checkpoints, earn prize draw entries, enter weekly tier-based pairings with Make-Up Bonus accountability, join creator-led sponsored challenges including regional GoGymGo YouTube workout-of-the-month features, and compete in regional sponsor-funded monthly prize draws.

### Objectives

- Increase physical activity consistency through commitment, verification, social accountability, and rewards.  
- Build a trustworthy verified-session system strong enough to support money payouts.  
- Create repeatable regional sponsorship inventory for brands that want measurable wellness engagement.  
- Let new users choose a creator to follow at the beginning of the app so creator-led challenges feel personal from the first session.  
- Launch V1 creator-led sponsored challenges that use approved creators, external workout platforms such as YouTube where permitted, sponsor-funded user reward mixes, regional creator submission and selection workflows, sponsor-funded creator payout pools, and verified GoGymGo workout completion.  
- Expand V2 sponsorship into deeper sponsor website, marketplace, product, promo-link, creator sponsor relationship, and optional owned content surfaces.  
- Launch an MVP that proves retention, sponsor interest, fraud controls, and payout economics in limited regions.  
- Add gym-level competitions that turn partner gyms into local competitive communities with stronger real-world accountability.

### Target Users

- Adults trying to build or rebuild consistent physical activity habits.  
- Gym members who need accountability to show up.  
- Runners, walkers, cyclists, and recreational athletes who can verify activity with heart-rate data.  
- Users motivated by prizes, competition, streaks, and social encouragement.  
- Sponsors targeting active and health-conscious regional audiences.  
- Brand sponsors buying verified fitness attention, creator-led challenge distribution, and measurable sponsor exposure.  
- Approved YouTube, fitness, and wellness creators who can submit or lead sponsored regional workout sessions while GoGymGo verifies user workouts inside the app.  
- Gym members who want local competition with people they recognize from their daily gym routine.

### Success Metrics

- DAU/MAU ratio.  
- Weekly and monthly active users.  
- Verified-session start-to-completion rate.  
- Monthly commitment selection rate, weekly commitment success rate, and perfect-month completion rate.  
- 30-day, 60-day, and 90-day retention.  
- Weekly pairing participation rate, Make-Up Bonus claim rate, and weekly partner completion lift.  
- Sponsor campaign renewal rate.  
- Onboarding creator-follow selection rate, follow-to-challenge join rate, and referral-preselected creator confirmation rate.  
- Creator-led sponsored challenge engagement: creator referral clicks, challenge page visits, signups, verified workout starts, verified finishers, sponsor CTA clicks, reward redemptions, and disclosure/asset approval completion time.  
- Signup prize draw entry grant rate and registration prize draw entry winner rate.  
- Public profile setup completion rate, private-mode share, and avatar/photo moderation approval rate.  
- Sponsor-funded payout efficiency: winner payouts divided by sponsor revenue.  
- Fraud review rate and confirmed fraud rate.  
- False rejection rate for legitimate sessions.  
- Sponsor served impressions, viewable impressions, average frequency, average viewable seconds, effective CPM, viewable CPM, and click-through rate.  
- Gym competition participation rate, gym verification success rate, and verified gym-session completion rate.  
- Payout completion time after winner selection.

### Current UI Prototype Alignment

The current mobile prototype represents the app as a phone-width mobile experience rather than a desktop-scaled mockup. The preview shell must constrain the app to a mobile canvas, keep the top status/progress treatment and bottom navigation inside that canvas, and preserve the same content hierarchy across Safari, desktop browser preview, and local phone preview.

Current visual system requirements:

- The app is visually designed as a dark, mobile-first, cyber-fitness product: black/navy base, subtle cyan grid background, restrained glow effects, compact panels, and no marketing-style landing-page sections inside the product flow.
- The app-open root screen is the GoGymGo logo welcome page with a clear CREATE ACCOUNT primary CTA in the first viewport. Returning to the root route must show this account-start screen before any dashboard, tab, or workout surface.
- The mobile viewport is the product canvas. The active prototype constrains content to roughly a phone-width shell, uses `100dvh`/safe-area-aware spacing, keeps scroll inside the app frame, and prevents desktop browser width from stretching the UI into a tablet or desktop layout.
- Typography is part of the brand system. Primary headings and body use a compact athletic display style; small labels, counters, step markers, status tags, and bottom-tab labels use a monospaced technical style. Letter spacing is used on small labels and CTAs, not on long paragraphs.
- In the Expo implementation, visible screens use the shared Cyber HUD primitives: `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`. The root layout loads `Orbitron-Bold` for display values and `ShareTechMono-Regular` for terminal labels, counters, button text, and tab glyphs before rendering the route stack.
- The Expo implementation centralizes brand styling in `src/constants/theme.ts`. Raw hex/RGBA values and font-size numbers should live in the theme file only; screens and shared components consume semantic tokens such as `colors.surfaceCyanActive`, `colors.surfacePinkSoft`, `colors.textOnPrimary`, `colors.statusError`, `fontSizes.screenTitle`, and the shared `typography` variants.
- The visual hierarchy is: sponsor rail at top, step/status label, screen title, concise explanatory copy, action cards or data cards, then primary/secondary CTAs. Screens should not introduce visible instructional text that explains how the UI is styled or where to click beyond the user-facing product copy.
- Every non-root screen includes the small top sponsor rail with the sponsor label, logo mark, sponsor name, and short attribution. The root welcome screen keeps the logo and CREATE ACCOUNT action first, then places sponsor attribution below the account-start action. Sponsor rails are light brand reminders, not primary actions, and must not cover content or push important CTAs below unreachable mobile areas.
- Primary action buttons use the active cyan treatment for ordinary progression, connection, confirmation, verified success, and normal session flow. Pink CTAs are reserved for prize, creator application or payout, sponsor offer, checkpoint urgency, reward, destructive/end-session confirmation, or explicitly special high-value states.
- Secondary actions use transparent or low-contrast dark treatments with readable cyan/blue-gray text. Back, skip, continue-as-player, and learn-more actions must not visually compete with the primary CTA.
- Button copy must follow the prototype wording directly and render full action labels only. Do not prepend shorthand text codes such as `SK`, `PL`, `BK`, `RULE`, `INFO`, `YT`, `HR`, `SRCH`, `PPG`, `BLE`, or similar abbreviations before button labels or user-facing controls. Bottom navigation must use the full tab labels plus a non-text glyph treatment, not letter abbreviations such as `HM`, `LB`, `VS`, or `GR`.
- Cards use compact rounded rectangles with thin cyan, pink, or neutral borders to communicate state. Cyan cards signal verified, selected, safe, progress, success, ordinary status, or active states; pink cards signal reward, bonus, prize, urgent checkpoint, sponsor offer, creator application, or creator payout states; neutral sponsor cards stay dark with small labels.
- The bottom tab bar appears only on main app tabs: Home, Ranks, Session, Pact, and Profile. The center Session button uses the pink high-emphasis treatment, while the active non-session tab uses cyan. Onboarding, verification, session checkpoint, checkout, draw, and detail screens do not show the bottom tab bar unless intentionally returned to a main tab.
- Creator Workouts remain reachable from Home, Profile, and creator-workout cards, but are not a bottom-tab item in the first-run layout so the center Session action remains clear.
- Embedded creator workout screens must keep the YouTube/player area visually distinct as a black player block with standard play affordance. GoGymGo sponsor panels, creator selection cards, payout cards, rules, and CTAs must stay outside the player boundary as safe-zone UI.
- Visual audit coverage for the current prototype includes Welcome, Public Identity, Creator Application Invite, Creator selection, Creator Guidelines, Creator Application, Permissions, Verification, How It Works, Commitment, Entry, Home, Leaderboard, Squad, Creator Workouts, Creator Workout Detail, Profile, Check-in, Identity Start, Active Session, Ping, Ping Success, Checkout, Complete, Gym, and Prize Draw screens.

Implemented UI language and behavior:

- Welcome screen leads with sponsor attribution, the system-status pill, the GoGymGo logo, and the three-step loop cards: Show Up, Prove It, and Win. All three welcome step cards use the standard cyan/green active treatment so the loop reads as one consistent flow; pink on the root screen is reserved for the center logo word, sponsor marks, prize-pool, and prize draw/reward accents. The step cards should sit directly under the logo with no large empty spacer. The screen then shows the free-to-play sponsor line, a signup reward card that includes the free entry, current monthly prize pool, monthly sponsor ad/attribution, and regional prize draw label, followed by a legal checkpoint and account actions. Prize language is framed as earning prize draw entries rather than getting paid from a pool.
- Account creation requires two native checkbox acknowledgements before the CREATE ACCOUNT CTA is enabled: Privacy Policy reviewed, and Terms of Service accepted. Privacy Policy and Terms open as app-native modal screens using the HUD design system, not web links or browser anchors.
- After signup, the app should render a day-zero account state: one signup prize draw entry, zero verified workouts, no rank yet, no weekly match yet, no gym rank yet, and payout verification deferred until the user wins or enters a creator payout flow. Do not show veteran demo values such as large entry counts, active match chats, completed streaks, or verified payout status immediately after onboarding.
- Onboarding uses user-facing "Public identity" language. The public identity control defaults to Private and supports Alias and Real Name display modes without an extra default-anonymous/payout-verification note card on the screen.
- Core onboarding progress is a four-step flow: Public Identity, Permissions, Verification, and Commitment. Creator application, Creator Guidelines, Creator selection, and How It Works are optional supporting screens and must not appear as broken sub-steps such as `STEP 02A / 05`.
- Payout/legal verification is separate from public identity. User-facing copy should say payout verification, not expose legal/KYC terminology except in backend, compliance, or payout operations sections.
- Permissions are presented as Identity check, Workout data, and Region, with plain-language descriptions that explain why each permission is needed and state that raw biometric scans are not stored. Sponsor placements are not shown as an onboarding permission row; sponsor logos, offers, and ad safe zones remain GoGymGo-owned app surfaces governed by sponsor/disclosure policy.
- The permissions step includes a required Biometric / Camera Notice checkbox before the user can continue. The notice states that local Face ID, device biometric prompts, QR camera views, and temporary camera streams verify presence only; GoGymGo never stores or transmits biometric identifiers, biometric data, imagery, face scans, face geometry, camera frames, or raw camera streams, and stores only a non-biometric checkpoint result where needed for eligibility or fraud review.
- The verification setup step is labeled Verification and offers two paths: connect a heart-rate device, or select a partnered gym and use entry/exit QR scans. Both method labels use neutral readable headings, with the selected state shown through the standard cyan active treatment. The primary continue CTA remains visible but disabled until the user links one heart-rate source or explicitly selects a partner gym. Partner-gym QR must not default to a selected gym.
- The verification setup step includes a health-data notice for heart-rate sources and phone-camera backup checks. Phone-camera backup copy must state that camera frames stay local and are not stored or transmitted.
- UI color semantics must stay consistent across the prototype: cyan means verified, selected, active, safe, success, ordinary status, progress, or normal flow; pink means reward, bonus, urgent checkpoint, prize, sponsor offer, creator application/payout, destructive alert, or a specifically high-value action. Structural page labels, rank/tier status badges, normal session start buttons, completion confirmations, progress indicators, back/skip/dismiss controls, and learn-more controls should use cyan, muted, or neutral treatments rather than pink. White/off-white is primary readable content; muted blue-gray is secondary/supporting text. Sponsor placements should use a neutral/dark container with a small sponsor label and sponsor logo mark so ads do not compete with verification, reward, or session CTAs. Do not introduce off-palette neon colors.
- Functional theme categories are required: primary/brand, secondary/accent, backgrounds/surfaces, typography/text, and status/feedback. New screens should not add local color constants or hardcoded `fontSize` values unless the token is first added to the centralized theme with a clear purpose.
- The heart-rate device list shows a short popular set by default and exposes the larger catalog through a More devices control.
- The partnered-gym QR path carries through the full session: select gym, choose Partner Gym QR from the Session tab, scan entry QR, complete Face ID presence check, see QR-specific active-session labels, scan exit QR, and show the selected gym as the profile verification source.
- The Session tab starts with a two-path choice: Heart-rate Session or Partner Gym QR Session. It must not silently redirect every user into the heart-rate check-in path.
- Session start, random ping, identity-check, QR scanner, and checkout screens use Face ID/biometric/camera language as a local presence check, not as a stored identity scan. Scan CTAs on these screens remain disabled until the user checks the local Biometric / Camera Consent acknowledgement for that session step. These workout-step reminders should be compact; the full legal explanation belongs in onboarding and the legal modal.
- The active session screen must prevent checkout before the 30-minute minimum. The finish CTA remains locked until the timer reaches 30:00.
- Screen navigation resets the scroll position so each mobile screen starts at the top, and bottom-tab screens reserve enough safe-area padding to avoid nav overlap.
- How It Works and Commitment screens lead with concise decisions first and use `entries` as the single user-facing reward unit. Commitment must keep the weekly 2x partner outcome and 3x Make-Up Bonus outcome visible near the perfect-month math, with longer rules still available behind optional disclosure controls. Copy should say "entries improve monthly odds" or equivalent wording and avoid dual reward-unit language. The How It Works explainer includes a "Don't show me again" action that dismisses the explainer and skips it on later verification setup continues.
- Trainer cards use a Verified badge, not a checkmark that could be confused with selected state.
- Session ending requires an explicit confirmation, and random-ping completion shows a checkpoint-confirmed success state before returning to the active timer.
- Completion copy shows the first verified session state, entries banked, weekly progress, and pact unlock state without contradicting the user's day-zero account state or inventing a named match before matching occurs.
- Reward cards must include units beside numeric values. For example, the weekly partner claimable card should say "12 PRIZE DRAW ENTRIES" rather than showing a bare "12".
- Weekly partner mechanics are user-facing as Make-Up Bonus, Partner Bonus, or "steal your match's unclaimed bonus" language. Copy should explain both outcomes in simple paired language: both hit the goal, both earn 2x; your match misses, complete one extra verified workout to earn 3x and claim the match's unearned bonus entries. Copy may use "steal" for competitive energy only when it clearly refers to unearned/unclaimed bonus entries; it must not imply earned entries are taken away from another user.
- Creator challenge cards show practical details: duration, workout format, reward type, and time remaining.
- Creator Workout surfaces use direct "Creator Workout" or "Creator Workouts" naming, with GoGymGo YouTube as the channel context. They show regional workout-of-the-month framing, creator submission language, selected-creator sponsor payout, user rewards, and sponsor safe-zone placement outside the YouTube player. The workout-detail CTA should start a verified GoGymGo session and must not imply that YouTube viewing itself earns entries.
- Signup includes a standalone optional creator-application prompt before the training-path selection step. The prompt should match the rest of onboarding with cyan structural headings, a cyan application panel, neutral same-shape fact rows, and a clear primary Continue as Player action so creator application does not feel mandatory. Users can tap Learn More to review creator upload guidelines, tap Apply as Creator to submit interest in leading local follow-along workouts, continue as a player, or choose "Don't show again" to dismiss future creator-application prompts. Creator copy explains that eligible videos earn 50 prize draw entries and that selected creators can earn sponsor-funded payouts, without over-emphasizing payout before the user understands the core workout flow.
- Creator challenge detail pages keep external video players separate from GoGymGo-owned sponsor safe-zone surfaces.
- Sponsor inventory is shown as explicit sponsor areas in the prototype: a small app-wide sponsored-by rail on every screen, plus contextual app-open, creator signup, creator workout discovery, creator workout detail safe-zone, check-in, and check-out placements. These sponsor areas use neutral/dark containers with a small sponsor label, sponsor logo mark, offer/payout attribution, and approved creative, rather than looking like primary user actions. During check-in and check-out, sponsor cards stay compact and informational so verification remains the primary task.
- Profile copy uses Private, Alias, and Real Name for display controls, Payout verification for payout status, Creator Workouts for the workout list entry point, and Creator status so users who apply as creators can see whether they have not applied or are under review. Profile settings include native access to Privacy Policy, Terms of Service, and Biometric / Camera Consent after onboarding, without technical row-marker abbreviations.
- The React Native app includes centralized legal content in `src/constants/legal.ts` and reusable legal UI in `src/components/legal.tsx`. New legal, privacy, biometric, consent, or rights copy must be updated there first, then consumed by page components.
- Local phone preview is supported by serving the existing prototype folder over the local network; this is a review workflow only and not a production delivery mechanism.

### Current Expo Router Implementation Snapshot

The active React Native implementation lives in `C:\Users\wilso\Documents\GoGymGo Frontend\mobile-app` and is an Expo Router app using `expo-router/entry`, React Native `StyleSheet.create`, shared HUD primitives, centralized theme tokens, and bundled brand fonts.

Current implementation folders:

- `app/`: Expo Router file-based screens, grouped into onboarding, modals, main tabs, and workout session flows.
- `src/components/`: reusable Cyber HUD and legal UI components.
- `src/constants/`: centralized theme tokens and legal/privacy/biometric copy.
- `src/state/`: lightweight first-run preference state for the creator-application invite.
- `assets/fonts/`: `Orbitron-Bold` and `ShareTechMono-Regular`.
- `docs/`: PRD, executive summary, migration audit log, theme audit, and compliance audit.

Current route map:

- Root and onboarding: `/`, `/welcome`, `/identity`, `/creator/invite`, `/creator`, `/creator/guidelines`, `/creator/apply`, `/consents`, `/verification`, `/how-it-works`, `/commitment`, `/entry-confirmed`.
- Modal/legal/rules surfaces: `/privacy-policy`, `/terms-of-service`, `/biometric-camera-consent`, `/bonus-rules`, `/commitment-rules`, `/qr-scanner`, `/sponsor-offer`.
- Main app tabs and nested tabs: `/home`, `/session`, `/leaderboard`, `/leaderboard/draw`, `/squad`, `/squad/gym`, `/workouts`, `/workouts/[workoutId]`, `/profile`.
- Workout session flow: `/workout/check-in`, `/workout/identity-check`, `/workout/active`, `/workout/ping`, `/workout/ping-success`, `/workout/check-out`, `/workout/complete`.

Current implementation requirements:

- The app must remain React Native clean: no HTML tags, no DOM/browser-only APIs in screens, no `any` type escape hatches, and no raw colors or font sizing outside the centralized theme.
- Every user-facing page should keep full wording rather than shorthand button codes, and use `entries` and `prize draw` consistently instead of mixing points, draw, and entries language.
- The Commitment page must show the selected-days math, the 4-week monthly base entries, the 10x perfect-month prize draw entries, plus the weekly 2x partner outcome and 3x Make-Up Bonus outcome.
- The verification and session paths must preserve both supported verification methods: heart-rate device and partner-gym QR entry/exit, with biometric/camera consent kept as a local presence check.
- Creator application remains optional in onboarding, can be dismissed, and stays reachable from Profile. Creator guideline-compliant submissions earn 50 prize draw entries and selected creators can receive sponsor-funded payouts.
- Sponsor placements are implemented as GoGymGo-owned safe-zone UI: app-open/signup, top sponsor rail, creator workout surfaces, workout detail, check-in, checkout, and sponsor-offer modal.

## 2. Personas And Key User Journeys

### Personas

**Maya, the consistency seeker**    
Maya wants to work out three times per week but falls off after busy workdays. She is motivated by simple commitments, streaks, and small rewards.

**Jordan, the competitive regular**    
Jordan already exercises often and wants leaderboards, tiers, and better odds in prize draws.

**Priya, the cautious participant**    
Priya is interested in rewards but cares about privacy, health-data consent, and payout legitimacy.

**Sam, the regional sponsor manager**    
Sam manages marketing for a fitness apparel brand and wants measurable regional exposure to people actively exercising.

**Riley, the operations reviewer**    
Riley reviews suspicious sessions, payout eligibility, sponsor campaigns, and escalated support cases.

### Journey: New User Onboarding

1. User installs or opens GoGymGo and first sees the GoGymGo logo welcome page with a CREATE ACCOUNT primary CTA in the first viewport.  
2. User creates an account using email, Apple sign-in, or Google sign-in.  
3. User chooses public profile mode: Private, Alias, or Real Name.  
4. User enters an optional alias or real-name display value, depending on selected profile mode.  
5. User optionally uploads and crops an avatar or personal photo, or keeps the generated default avatar.  
6. User is shown an optional standalone creator-application prompt and can tap Learn More to review upload guidelines, tap Apply as Creator to express interest in submitting local follow-along workouts, continue as a player, or choose "Don't show again" to dismiss future prompts.  
7. User is shown an onboarding training-path step and can train solo or follow a primary creator from approved creator profiles; if the user arrived from a creator referral link, that creator is preselected for confirmation.  
8. User reviews consent screens for biometrics, health data, location/region, notifications, public profile display, creator follow personalization, and prize eligibility. Sponsor placements remain GoGymGo-owned UI inventory rather than a user-facing onboarding permission.  
9. User chooses a workout verification path: connected heart-rate source or partnered gym QR verification where available.  
10. If using a connected heart-rate source, user connects HealthKit on iOS, Health Connect on Android, Apple Watch, Wear OS, or Bluetooth LE heart-rate device.  
11. If using partnered gym QR verification, user selects an approved partner gym and reviews the entry QR start and exit QR finish workflow.  
12. User selects region or confirms detected region.  
13. User reviews current sponsor and monthly competition rules.  
14. User selects a whole-month commitment of 1 to 7 activity days per week.  
15. User immediately receives one registration prize draw entry for the current monthly prize draw.  
### Journey: Setting The Monthly Commitment

1. User opens the commitment screen before the monthly cutoff.  
2. User selects 1 to 7 activity days per week for the whole month.  
3. App summarizes the weekly 2x reward, perfect-month 10x reward, prize draw entry rules, and current sponsor prize pool, with detailed bonus rules available on request.  
4. User confirms before 12:00 AM local time on the Sunday preceding the first Monday of the month.  
5. Commitment locks for the month.  
6. Each week, user can make good on the monthly commitment by completing at least the selected number of valid sessions.  
7. A successful week earns the selected weekly-frequency entries for that week; after 4 successful weeks, a perfect month applies a 10x multiplier to the monthly base entries. For example, 7 days per week equals 7 entries per week, 28 base entries over 4 weeks, and 280 perfect-month prize draw entries.

### Journey: Completing A Verified Session

1. User starts a session by either completing local biometric authentication from the app or scanning an approved partner gym entry QR that launches the QR session flow.  
2. App begins collecting the selected verification evidence: heart-rate data for wearable sessions, or signed partner gym entry presence for QR sessions, plus device integrity signals.  
3. App schedules one random mid-session biometric ping inside the 30-minute window.  
4. User completes the mid-session biometric check within the grace period.  
5. For partner gym QR sessions, the app asks for Face ID after the entry QR so the QR proves place and Face ID confirms the user.  
6. User completes the end biometric check after 30 minutes. For partner gym QR sessions, user also scans the approved exit QR before leaving the gym.  
7. Backend validates biometric attestations, HR elevation or partner gym QR entry/exit evidence, session timing, device signals, and fraud score.  
8. User receives entries and progress updates if the session is valid.

### Journey: Weekly Pairing And Make-Up Bonus

1. At the start of each week, user is paired with another eligible user in the same tier, prioritizing the same gym and similar weekly commitment target where possible.  
2. App shows the weekly partner using each user's selected public profile mode, plus match reason, weekly commitment target, and available Make-Up Bonus rules. User-facing copy explains that if both users hit the goal, each earns 2x; if a match misses, one extra verified workout can steal the match's unclaimed bonus and raise the successful user's weekly reward to 3x.  
3. If both users meet their weekly commitments, both earn their own weekly partner reward pool.  
4. If one user misses the weekly commitment, that user earns no weekly entries or weekly partner rewards for that week.  
5. The missed user's weekly partner reward pool becomes the Make-Up Bonus.  
6. The partner can claim the Make-Up Bonus only after first meeting their own weekly commitment.  
7. The partner claims Make-Up Bonus rewards by completing extra verified sessions beyond their own weekly target before the weekly deadline.  
8. Weekly partner chat expires or archives after the weekly pairing window.  
### Journey: Viewing Leaderboards

1. User opens the leaderboard tab.  
2. App shows top regional entry earners for the active competition period.  
3. User can filter by region, tier, friends if later supported, and monthly period.  
4. App indicates the user's rank, entries, and estimated prize draw odds.

### Journey: Winning A Prize Draw

1. Last Sunday of the month at 9:00 PM local time, the backend selects winners per region.  
2. Winners make up 15% of the eligible regional player pool.  
3. Winner probability is weighted by accumulated entries.  
4. Winner receives notification and must complete payout onboarding if required.  
5. Operations reviews flagged winners before disbursement.  
6. Payout is sent through Stripe Connect after eligibility checks.

### Journey: Seeing Sponsor Ads

1. User opens the app for any reason.  
2. App displays the active sponsor placement at app open and during completed workout verification moments.  
3. Impression and viewability events are logged with campaign, region, gym if applicable, user, timestamp, placement type, creative version, viewport/screen state, visible duration, click/dismiss action, and fraud-filter eligibility.  
4. User can dismiss according to frequency and UX rules.  
5. Sponsor reporting aggregates exposure by served impression, viewable impression, unique reach, frequency, average viewable seconds, CPM, and viewable CPM.

### Journey: V1 Creator-Led Sponsored Challenge
1. GoGymGo and a brand sponsor approve a regional creator-led challenge, including the region, creator submission window, selected workout criteria, sponsor-funded user reward mix, sponsor-funded creator payout pool, official rules, sponsor creative, promo copy, paid-promotion disclosure language, and reporting goals.
2. Local creators submit follow-along workout videos or approved external links for the regional workout-of-the-month slot. Submissions include rights attestation, required disclosures, workout format, duration, safety notes, and sponsor-copy approvals. Guideline-compliant creator video submissions earn 50 prize draw entries for the submitting creator.
3. GoGymGo selects the strongest regional workout, features or publishes it through the official GoGymGo YouTube channel or playlist where permitted, and keeps sponsor placements in GoGymGo-owned safe zones outside the YouTube player.
4. A user opens the GoGymGo YouTube challenge page inside the app and sees the selected creator, sponsor, user rewards, creator payout pool, rules, workout format, privacy choices, and verification requirements.
5. The user joins the challenge, receives the standard signup entry if eligible, and completes verified workouts through GoGymGo using check-in, mid-workout verification, heart-rate/session validation or partnered-gym QR validation, and check-out.
6. Sponsor creative appears at app open, challenge discovery, challenge detail safe zones, and workout verification flow surfaces. The challenge can also include approved sponsor CTA or promo links inside GoGymGo.
7. GoGymGo attributes creator referrals, signups, verified starts, verified finishers, sponsor impressions, CTA clicks, reward redemptions, selected-creator payout status, and prize/reward efficiency.
8. Rewards can include cash, sponsor product, gift cards, sponsor credits, coupons, or a legally reviewed mix. Users are rewarded for verified GoGymGo workouts, not for external-platform views, likes, subscribes, comments, or watch time.

### Journey: V2 Sponsor Marketplace And Promo Links
1. Sponsor signs a campaign agreement that includes monthly sponsorship, approved creative, offer copy, marketplace links, promo terms, attribution requirements, and brand-safety rules.
2. GoGymGo creates sponsor surfaces: app-open ad, workout verification placements, sponsor profile page, offer page, product/marketplace links, promo links, and redemption tracking.
3. User opens GoGymGo and sees the regional/monthly sponsor creative.
4. During a workout, user sees sponsor creative at check-in, mid-workout verification, and check-out.
5. User can optionally tap into sponsor marketplace or promo-link surfaces without purchase being required for prize participation.
6. Dashboard reports impressions, view duration, clicks, promo engagement, conversion events where available, workout starts, verified finishers, and prize pool efficiency.
### Journey: Joining A Gym Competition

1. User selects or confirms an approved partner gym.  
2. User joins the active gym competition and sees gym-specific rules, leaderboard, and prize pool.  
3. On arrival, user verifies entry by connecting to the gym Bluetooth beacon or scanning the entry QR checkpoint.  
4. User completes the standard biometric start checkpoint and 30-minute HR-verified session.  
5. User verifies exit by beacon proximity or QR scan within the allowed post-session window.  
6. Backend validates gym presence, biometric checkpoints, HR elevation, timing, and fraud signals.  
7. User earns gym competition entries and sees updated ranking against members of the same gym.

## 3. Functional Requirements

### 3.1 Identity, Signup Entry, Public Profile, And Biometric Verification  
**User story:** As a new user, I want to receive an immediate prize draw entry so that I can participate in the monthly prize draw even before completing my first workout.

Acceptance criteria:

- A new account receives one registration prize draw entry immediately after signup for the current monthly prize draw.  
- The registration entry does not require a workout, commitment selection, biometric session, or heart-rate validation.  
- The registration entry is one-time and non-recurring.  
- The registration entry does not award additional entries, commitment progress, gym leaderboard rank, or verified-session credit.  
- Registration entries are subject to official rules, jurisdiction eligibility, account integrity checks, and anti-fraud controls.  
- If a signup-only user wins, payout still requires eligibility confirmation and any required identity, tax, or fraud review.

**User story:** As a user, I want to control how my identity appears publicly so that I can participate privately, with an alias, or with my real name.

Acceptance criteria:

- Profile settings include a visible public identity toggle with three modes: Private, Alias, and Real Name.  
- Private mode hides the user's real name on public surfaces and uses a generated display label unless the user chooses an alias for non-real-name display.  
- Alias mode displays a user-provided alias that must pass moderation, impersonation, and profanity checks.  
- Real Name mode displays the user's chosen real-name display value on public surfaces.  
- Users can upload, crop, replace, or delete an optional avatar or personal photo.  
- If no image is uploaded, the app uses a generated default avatar that does not reveal identity.  
- Profile visibility applies to leaderboards, gym competitions, weekly partners, messaging, winner announcements, and user-facing competition views.  
- Payout/legal identity remains separate from public profile identity and is never shown publicly just because a user chooses Real Name mode.  
- Uploaded avatars and personal photos are scanned or reviewed for abuse, impersonation, explicit content, and rights issues before broad public display.

**User story:** As a user, I want to verify that I am the person completing the session so that rewards are fair.

Acceptance criteria:

- App supports Apple LocalAuthentication for Face ID/Touch ID and Android BiometricPrompt for biometric authentication.  
- Biometric authentication occurs at start, random mid-session ping, and end.  
- The app never stores raw biometric templates or images.  
- Each checkpoint creates a signed verification event with user ID, device ID, session ID, timestamp, checkpoint type, and platform result.  
- If biometric auth fails, the user may retry within a short grace period.  
- If the user misses the mid-session or end checkpoint, the session is invalid.  
- App records device integrity signals using Apple DeviceCheck/App Attest and Google Play Integrity API.  
- High-risk devices, rooted devices, jailbroken devices, emulator sessions, or suspicious device changes are flagged for review or blocked.

### 3.2 Heart-Rate, Wearables, And Partner Gym QR Verification

**User story:** As a user, I want GoGymGo to verify that I actually completed physical activity so that my session can count.

Acceptance criteria:

- iOS supports Apple HealthKit and Apple Watch workout/heart-rate data where available.  
- Android supports Google Health Connect and Wear OS Health Services where available.  
- App supports standard Bluetooth LE Heart Rate Service devices as the open-source/open wearable path.  
- App supports a partnered gym QR path for approved gym locations where GoGymGo has placed entry and exit QR checkpoints.  
- On the verification setup step, user can choose either a heart-rate device path or a partnered gym QR path.  
- The verification setup UI shows common wearable sources first and keeps the larger device catalog behind a More devices control so the primary CTA remains reachable on a phone screen.
- If user chooses partnered gym QR, app requires user to select an approved partner gym before continuing.  
- Partnered gym entry QR starts the session flow after the user checks in at the gym.  
- Partnered gym exit QR ends the session flow when the user leaves the gym.  
- Partnered gym QR sessions still require local biometric verification and device integrity checks.  
- Partnered gym QR entry/exit verification can replace a wearable heart-rate monitor only for approved partner-gym sessions.  
- If user is not at an approved partner gym, prize-eligible sessions require a connected heart-rate source.  
- Session validation requires enough HR samples to cover the 30-minute session with acceptable gaps.  
- HR must be elevated above a user-specific baseline or age-adjusted threshold for the required portion of the session.  
- HR readings with impossible values, flatline patterns, repeated synthetic patterns, or incompatible device metadata are flagged.  
- Users can see why a session failed HR validation in plain language.
- Users without a supported HR source can complete prize-eligible workout sessions at approved partner gyms if they use valid entry and exit QR checkpoints.  

Recommended elevated HR rule for MVP:

- Establish a rolling resting HR baseline from connected health data or an onboarding baseline estimate.  
- A session passes if at least 20 of 30 minutes show HR greater than max(resting HR + 25 bpm, 50% of age-predicted max HR), with no gap longer than 5 consecutive minutes.  
- A partnered gym QR session passes the non-wearable verification path only if entry QR, exit QR, biometric checkpoints, minimum session duration, device integrity, and fraud checks all pass.  
- Users with medical constraints require a later clinical policy review; v1 should not support custom medical thresholds without legal and medical guidance.

### 3.3 Session Lifecycle And Random Ping Scheduler

**User story:** As a user, I want a clear 30-minute session flow so that I know exactly what is required.

Acceptance criteria:

- User can start a session only after selecting a valid activity mode and completing either start biometric authentication or an approved partner gym entry QR scan that launches the start verification flow.  
- Partner gym QR sessions follow this visible order: entry QR scan, Face ID presence check, active timer with QR-specific status, random ping, and exit QR checkout.  
- Sponsor creative is displayed during check-in, mid-workout verification, and check-out for completed workouts; impressions are logged separately from biometric results.  
- Session duration is 30 minutes minimum.  
- Check-out and final verification cannot be started before the 30-minute minimum is reached; the mobile UI must show a locked or unavailable finish CTA until the requirement is met.  
- Random mid-session ping is scheduled after the start checkpoint and occurs unpredictably between minutes 8 and 24.  
- User has a 2-minute grace period to complete the random ping.  
- Random ping success shows a checkpoint-confirmed state before returning to the active session.
- If the user chooses to end a session early, the UI asks for confirmation and explains that progress from that workout will not count.
- App uses local notifications and in-app prompts for the random ping.  
- Backend receives session start, checkpoint, HR summary or partner gym QR presence summary, device integrity, and session end events.  
- Session validation is idempotent and produces one final status: valid, invalid, pending review, or failed technical validation.

Hard part:

- iOS may not reliably allow arbitrary background biometric prompts while the app is backgrounded or the device is locked. MVP should require the app to remain foregrounded or use persistent activity UX with notification fallback, and this limitation must be disclosed in-product.

### 3.4 Commitment Engine

**User story:** As a user, I want to set one monthly commitment and make good on it week by week so that the reward system is simple, predictable, and motivating.

Acceptance criteria:

- User must pre-select a whole-month commitment of 1 to 7 activity days per week.  
- The selected weekly frequency applies to every commitment week in the monthly competition period.  
- User cannot switch between weekly and monthly commitment modes; monthly pre-selection is the default and only commitment model.  
- User can make good on the monthly commitment week by week by completing at least the selected number of valid sessions in each week.  
- A successful week earns a 2x total commitment multiplier for eligible sessions in that week.  
- If the user meets the selected weekly commitment every week in the month, eligible monthly commitment entries are upgraded to a 10x total commitment multiplier.  
- If the user misses any commitment week, the 10x perfect-month reward is not earned, but later weeks can still earn weekly 2x rewards.  
- Selection deadline is before the first Monday of each month, no later than 12:00 AM local time on the preceding Sunday.  
- Commitments lock after the cutoff and cannot be lowered for reward purposes.  
- Backend stores commitment period, timezone, weekly target frequency, cutoff timestamp, locked status, weekly success status, weekly multiplier status, perfect-month status, and final commitment multiplier.

### 3.5 Entries, Tiers, Weekly Pairing, And Make-Up Bonus

**User story:** As a user, I want entries to reflect my weekly commitment follow-through so that rewards favor people who actually make good on the commitment they selected.

Acceptance criteria:

- Each valid session is recorded immediately, but weekly session entries remain pending until the user meets the selected weekly commitment target.  
- A user must complete at least the selected number of valid sessions in the week to earn entries for that week.  
- If a user misses the weekly commitment, that user's sessions remain in history but award zero weekly entries or commitment progress for that week.  
- A successful commitment week awards the week's eligible session entries with the weekly 2x commitment multiplier.  
- A perfect commitment month awards a 10x total commitment multiplier for eligible monthly commitment sessions. The 10x monthly reward replaces weekly 2x stacking for the perfect-month calculation.  
- Signup entries remain separate from workout-earned entries and commitment progress.  
- Tiers group users by participation level, historical activity, and region size to improve weekly pairing fairness.  
- Weekly pairing occurs once per week among eligible users in the same tier.  
- Pairing prioritizes same-gym matches first, then same-region matches, and then similar weekly commitment targets where possible.  
- If both weekly partners meet their commitments, both earn their own weekly partner reward pool.  
- If one weekly partner misses the commitment, that user earns no weekly entries or weekly partner reward for the week.  
- The missed user's unearned weekly partner reward pool becomes the Make-Up Bonus.  
- A committed partner can claim the Make-Up Bonus only after first meeting their own weekly commitment.  
- Make-Up Bonus claims require one or more extra verified sessions beyond the claiming user's weekly target before the weekly deadline; the user-facing MVP copy frames this as one extra verified workout for the 3x outcome.  
- Make-Up Bonus claims are capped by the missed partner's available pool and expire at weekly reset.  
- No user loses earned entries; the Make-Up Bonus contains only unearned weekly rewards from a missed commitment. User-facing copy may frame this as stealing a match's unclaimed bonus entries.
- Users with active blocks, safety reports, or fraud holds are excluded from weekly pairing.

Recommended MVP scoring:

- Valid session: 10 pending base entries.  
- Weekly commitment success: pending base entries for that week are awarded at 2x.  
- Weekly commitment miss: pending base entries for that week expire with zero award.  
- Perfect month: eligible monthly commitment entries are recalculated at 10x total.  
- Weekly partner reward: separate weekly bonus line item awarded if both partners meet weekly commitments.  
- Make-Up Bonus claim: after meeting the user's own weekly commitment, one extra verified workout can claim the partner's unearned weekly reward pool and raise the weekly reward presentation from 2x to 3x, up to the weekly cap.  
- Weekly commitment entries: equal to selected weekly frequency when the commitment week succeeds, then multiplied according to weekly and perfect-month rules.  
- Prize draw weight: entries determine weighted random prize draw odds according to official rules.

Example:

- Jordan commits to 4 sessions per week and completes 2. His 2 sessions remain visible in history, but Jordan earns 0 entries for the week because he did not meet his commitment.  
- Maya is Jordan's weekly partner, also commits to 4, and completes 4. Maya earns her weekly entries and unlocks the right to chase Jordan's Make-Up Bonus.  
- If Maya completes extra verified sessions before weekly reset, those extra sessions can claim Jordan's unused weekly partner reward up to the cap.  
### 3.6 Weekly Partner Messaging  
**User story:** As a weekly partner, I want to send short encouragement or competitive messages so that the weekly pact feels active without becoming a full social network.

Acceptance criteria:

- Weekly partners can message each other during the weekly pairing window.  
- Chat headers and message identity use each user's selected public profile mode, alias/name, and approved avatar/default avatar.  
- Messages support text only in MVP.  
- Messaging uses Firestore real-time updates.  
- Users can block, report, and mute a weekly partner.  
- Reported messages are retained for moderation review according to retention policy.  
- Expired weekly partner chats become read-only or hidden after the weekly pairing period.  
### 3.7 Regional Leaderboards

**User story:** As a user, I want to see how I rank in my region so that competition feels visible.

Acceptance criteria:

- Leaderboards show regional entry totals for the active monthly competition.  
- App shows top users, current user rank, tier, entries, and public profile display according to each user's selected identity mode.  
- Leaderboards update near real time after session validation.  
- Redis sorted sets maintain fast ranking; PostgreSQL stores the authoritative entry ledger.  
- Users under review remain visible only if policy allows; confirmed fraudulent entries are removed.

### 3.8 Gym Competitions And In-Gym Verification

**User story:** As a user, I want to compete against people at my own gym so that the competition feels local, visible, and socially motivating.

Acceptance criteria:

- Partner gyms can be configured with name, address, region, timezone, verification methods, active competitions, and admin contacts.  
- User can join or confirm a home gym competition when the gym is an approved partner location.  
- Gym competition credit requires standard biometric verification plus either HR validation or the approved partner gym QR entry/exit verification path.  
- Gym presence can be verified by approved Bluetooth beacon proximity or by scanning a QR checkpoint at entry and exit. For QR-path users, the entry scan also starts the session flow and the exit scan ends the session flow.  
- QR codes must be signed, time-bound, and checkpoint-specific; static QR codes are not valid for prize-eligible gym sessions.  
- Beacon verification records approved beacon ID, gym ID, timestamp, RSSI/proximity confidence, and device integrity status.  
- Entry verification must occur within 10 minutes before session start; exit verification must occur within 15 minutes after session end.  
- If gym verification fails but biometric and HR validation pass, the session can count for regional goals but not gym-specific leaderboards or gym prizes. If the user selected QR-only verification and QR validation fails, the session is not prize eligible unless another approved verification source is available.  
- Gym leaderboards show rankings only for members participating in that gym competition.  
- The app should not track precise movement inside the gym; it stores only entry/exit presence events needed for competition validation.  
- MVP must support QR entry/exit for all partner gyms and BLE beacon verification for pilot gyms where hardware can be installed and monitored.

### 3.9 Weighted-Random Monthly Prize Draw And Payouts

**User story:** As an eligible user, I want winners to be selected fairly so that higher effort improves my chance without guaranteeing a prize.

Acceptance criteria:

- Draw runs on the last Sunday of every month at 9:00 PM local time per region.  
- Winners equal 15% of eligible regional players, rounded according to legal-approved policy. MVP default: round down, minimum 1 winner if the region has at least 10 eligible users.  
- Winner selection is weighted by signup entries and monthly earned entries.  
- A user can win at most once per regional monthly prize draw unless legal and sponsor rules allow otherwise.  
- Draw inputs and random seed source are logged for audit.  
- Use a cryptographically secure random number generator from the backend runtime and store a prize draw audit record.  
- Winners flagged by fraud scoring enter pending review before payout.  
- Stripe Identity verifies identity when legally or operationally required.  
- Stripe Connect Express disburses payouts after approval.

Worked example using recommended MVP prize-pool policy:

- Region has 2,000 monthly active users.  
- 60% eligibility assumption creates 1,200 eligible users.  
- Winners are 15% of the eligible pool, so 180 users win.  
- Minimum winner value is $10.  
- Prize reserve is 10% for payout fees, rounding, failed payouts, and bonus-prize flexibility.  
- Reliable prize pool is `180 winners x $10 x 1.10 = $1,980`, rounded to a $2,000 guaranteed prize pool.  
- Minimum sponsor package is `$2,000 / 40% prize allocation = $5,000`.  
- Sponsor media value is `((2,000 MAU x 12 opens) + (1,200 eligible users x 4 workouts x 3 verification placements)) x $25 CPM / 1,000 = $960`.  
- The remaining sponsor package value funds prize underwriting, category exclusivity, leaderboard/winner-announcement branding, and local activation.  
- All 180 winners receive at least $10 in cash, gift card value, sponsor credit, or product value, subject to official rules and legal review.  
- User A has 600 monthly entries; all eligible users collectively have 240,000 entries.  
- User A's chance for each weighted selection step is approximately 0.25%, adjusted as winners are selected without replacement.

### 3.10 Sponsorship And App-Open Ads

**User story:** As a sponsor, I want my campaign to appear when users open the app so that I reach verified active users in a region.

Acceptance criteria:

- Each region has one active monthly sponsor campaign in MVP.  
- App shows sponsor creative whenever the user opens the app and at each completed workout verification moment: check-in, mid-workout verification, and check-out.  
- Campaign creative includes brand name, image/video asset, CTA URL, start/end timestamps, region, and disclosure text.  
- Impression and click events are logged.  
- Sponsor dashboards can be internal-only for MVP.  
- Campaigns cannot target sensitive health attributes.

### 3.11 V1 Creator-Led Sponsored Challenges And External Workout Platforms
**User story:** As a sponsor, I want to sponsor a creator-led GoGymGo challenge so I can reach verified exercisers through both creator distribution and in-app workout verification moments.

Acceptance criteria:

- GoGymGo can create an approved creator-led challenge tied to one sponsor campaign, a regional or gym scope, a creator submission window, one selected workout, one or more approved external workout links or official GoGymGo YouTube surfaces, a date range, official rules, a user reward mix, and an optional creator payout pool.
- V1 can run a monthly regional "Workout of the Month" where local creators submit follow-along workouts, GoGymGo reviews and selects the strongest regional video, and the selected workout is featured through an official GoGymGo YouTube channel or playlist where platform rules and rights allow.
- Reward mixes can include cash, gift cards, sponsor products, sponsor credits, coupons, or other legally reviewed rewards.
- Sponsor campaigns can allocate a creator payout pool separate from the user prize draw entry pool. The selected creator payout is based on GoGymGo selection, contracted deliverables, rights approval, and verified GoGymGo completions where specified, not YouTube views, watch time, likes, comments, or subscriptions.
- GoGymGo manages sponsor relationships in V1. Creators cannot bring, reserve, or protect their own sponsor relationships in the V1 workflow.
- Sponsor contracts define approved creator, approved platforms, required deliverables, allowed claims, approved copy/assets, paid-promotion disclosures, cancellation rights, reward obligations, and reporting metrics.
- Sponsor creative and CTAs can be shown on app open, check-in, mid-workout verification, check-out, challenge pages, and approved in-app offer surfaces that are GoGymGo-owned.
- Each challenge page must reserve sponsor logo/ad safe zones in GoGymGo-owned UI, including header, below-player card, challenge detail panels, verification flow, and reward surfaces where applicable.
- If a YouTube player is embedded, GoGymGo sponsor units must stay outside the player boundary and cannot be sold as placements on or within the YouTube player or YouTube audiovisual content unless YouTube provides prior written approval.
- GoGymGo must not overlay, skin, cover, block, replace, or interfere with YouTube player controls, links, metadata, YouTube-served ads, or playback context signals.
- GoGymGo must not require users to view, click, dismiss, or complete a sponsor action before watching an embedded YouTube video; app-controlled pre-roll, mid-roll, post-roll, interstitial gates, and clickable sponsor layers tied to the YouTube player are out of scope.
- Sponsor reporting includes creator submission count, selected workout, creator referral clicks, challenge page visits, signups, starts, verified finishers, GoGymGo sponsor impressions, view duration for GoGymGo placements, CTA clicks, promo-link clicks, reward redemptions, creator payout status, and prize/reward efficiency.

**User story:** As an approved creator, I want to lead a sponsored GoGymGo challenge from YouTube or another external platform so my audience can complete verified workouts and compete for rewards.

Acceptance criteria:

- Creator profile supports display name, alias/real-name preference, avatar/profile photo, verified channels, platform URLs, bio, region, moderation status, and approval status.
- During signup, a user can choose Learn More from the standalone creator-application prompt to review creator upload guidelines, submission reward rules, and sponsor payout rules before applying.
- During signup, a user can choose Apply as Creator from the standalone creator-application prompt. This records a creator application intent, moves the user forward to permissions, and allows the user to continue signup as a player.
- During signup, a user can choose "Don't show again" on the standalone creator-application prompt. The current prototype treats this as a session-level dismissal; production should persist this dismissal preference so future signup or onboarding resume moments skip the creator-application prompt unless the user opens creator application from Profile or another explicit entry point.
- The creator application screen explains submission basics, rights/disclosure review, safety review, region fit, the 50 prize draw entry reward for guideline-compliant video submissions, and sponsor-funded payout opportunity before the user continues.
- Profile includes a user-facing Creator status row. Before application it shows Not Applied with a path to apply; after application it shows Under Review with payout/rights review context.
- Creators can submit candidate regional workouts for GoGymGo review with video URL or file-handoff reference, title, workout type, duration, intensity, equipment requirements, safety notes, usage rights attestation, disclosure language, and sponsor-copy approval status. Each guideline-compliant creator submission awards 50 prize draw entries to the creator, subject to anti-spam, duplicate-submission, rights, and eligibility checks.
- Creators can attach approved external workout content by URL or platform ID where platform APIs, embed permissions, and terms allow; GoGymGo must use a link-out fallback when embed policy, rights, or ad-placement rules are unclear.
- External content metadata stores platform, external content ID, URL, title, thumbnail URL, duration, channel/creator ID, embed/link status, moderation status, paid-promotion disclosure status, Made for Kids status where applicable, playback privacy mode, sponsor safe-zone status, takedown status, and last API sync.
- YouTube embeds must use the official YouTube embed/IFrame player path, keep standard player controls and metadata visible, respect minimum viewport requirements, pass required origin/client context signals, and default `autoplay=false` unless privacy/legal review approves otherwise.
- For Made for Kids content, tracking and personalized sponsor targeting around the player must be disabled or avoided, and the content should be excluded from creator challenges unless legal/privacy review approves the exact treatment.
- V1 does not require in-app owned video upload by creators or users. Creator submissions can be managed as approved external links or controlled file handoffs for publication/feature under an official GoGymGo YouTube surface after rights and moderation review.
- Creator challenge pages show creator identity, sponsor, reward mix, rules, eligible workout window, verification requirements, optional sponsor CTA/promo links, and a clear separation between the embedded player and GoGymGo-owned sponsor surfaces.
- Creators can use approved sponsor language and assets in videos, descriptions, posts, and physical merchandise, subject to sponsor approval, platform rules, advertising disclosure requirements, and trademark/claims review.
- Selected creators can earn a sponsor-funded creator payout defined in the campaign contract and official rules. Users are rewarded for verified GoGymGo workouts, not external-platform views, likes, subscribes, comments, shares, or watch time.

**User story:** As a user, I want to pick a creator to follow at the beginning of the app and join creator-led challenges while GoGymGo verifies my participation.

Acceptance criteria:

- At the beginning of the app, user can select a primary creator to follow from approved creator profiles before entering the main competition experience.
- Creator selection can be reached from onboarding, a creator referral link, in-app discovery, gym page, region page, sponsor page, or challenge page.
- If a referral link includes a creator, the referring creator is preselected but the user must be able to confirm, change, or remove the selection.
- Creator discovery supports search/filtering by creator name, platform, workout style, region/gym availability, active challenges, and sponsor/reward availability.
- Selected creator personalizes the home feed, recommended creator challenges, workout content surfaces, notifications, and referral attribution.
- User can change the followed creator later; changing follows does not retroactively alter completed workout rewards, sponsor reporting, or referral attribution already earned.
- Creator follow selection does not reward external-platform views, likes, subscribes, comments, shares, watch time, or YouTube ad impressions.
- User can join a creator-led challenge from a referral link, in-app discovery, gym page, region page, or sponsor page.
- User receives the standard signup entry if eligible, even before completing a workout.
- Completing a verified workout tied to the challenge awards the same base GoGymGo workout entries and any challenge-specific rewards defined by the rules.
- Challenge leaderboard and reward status respect the user's identity preference: private, alias, or real name, with optional avatar/photo.
- Sponsor CTA/promo interactions remain optional and no purchase is required to participate.
- Watching embedded YouTube content remains optional for prize eligibility unless legal and platform review approves a specific flow; GoGymGo rewards verified workouts, not YouTube watch time.

**User story:** As a sponsor, I want clear sponsor areas in GoGymGo-owned UI so my campaign creative has defined placements without interfering with user verification or external video players.

Acceptance criteria:

- Sponsor areas are explicitly named in implementation and analytics, including the app-wide sponsored-by rail, app-open, creator signup, creator workout discovery, creator workout detail safe-zone, check-in, mid-workout where applicable, check-out, leaderboard/winner announcement, and reward surfaces.
- Each sponsor area can hold sponsor logo, short approved offer copy, payout/prize-pool attribution, CTA/promo link where allowed, disclosure label, creative version, and impression/viewability metadata.
- Sponsor areas use neutral/dark branded containers with small sponsor labels so they do not compete visually with verification, session, creator-application, or reward CTAs.
- Sponsor areas remain optional to interact with; no sponsor click, purchase, or offer redemption is required for signup, workout verification, Creator Workout participation, or prize eligibility.
- Sponsor areas near YouTube or external video content must remain outside the embedded player and cannot overlay, skin, gate, block, or modify the video player.
## 4. Non-Functional Requirements

### Security

- Encrypt data in transit with TLS and at rest using managed cloud encryption.  
- Store auth tokens securely using Keychain on iOS and EncryptedSharedPreferences/Keystore on Android.  
- Use signed device attestations and replay-resistant session event IDs.  
- Restrict administrative tools with SSO, role-based access control, and audit logs.

### Privacy

- Collect the minimum health, biometric result, location, and device data needed to validate sessions and operate competitions.  
- Never store raw biometric templates.  
- Provide consent, data export, and deletion workflows.  
- Separate sensitive health data from sponsor reporting.  
- Use aggregated sponsor reporting unless legal review approves otherwise.  
- Public profile identity is user-controlled and can be Private, Alias, or Real Name.  
- Payout/legal identity, email, health data, biometric results, and payout details are never exposed through public profile settings.  
- Avatar and personal photo uploads are optional, replaceable, deletable, stored separately from core account records, and subject to moderation.  
- Private mode must be respected on leaderboards, gym competitions, weekly pairings, messaging, and winner announcements unless official rules or applicable law require a different disclosure.

### Scalability

- Session events and HR summaries must be ingestible asynchronously through Pub/Sub.  
- Leaderboards must support high read volume through Redis sorted sets.  
- Draw jobs must be partitioned by region and timezone.  
- Chat should scale through Firestore managed real-time infrastructure.

### Availability

- Core app APIs target 99.9% monthly availability for MVP.  
- Session event ingestion should degrade gracefully with local retry queues.  
- Draw and payout jobs must be retryable and idempotent.

### Latency

- App-open sponsor placement should load within 500 ms from cached configuration when possible.  
- Leaderboard reads should return within 1 second for regional views.  
- Session validation should complete within 30 seconds after session end unless pending fraud review.

### Accessibility

- Support Dynamic Type, screen readers, sufficient color contrast, reduced motion, and haptic alternatives.  
- Biometric prompts must have platform-supported fallback policies, but fallback eligibility for prize sessions requires fraud/legal review.

### Localization

- MVP supports English and locale-aware dates, times, currencies, and region names.  
- Time-sensitive deadlines must always show the user's local timezone and absolute timestamp.

### Offline Behavior

- Users may start a session only when device health source and network state meet minimum validation requirements.  
- Temporary network loss during a session queues signed events locally.  
- If HR data or biometric checkpoints cannot be captured, the session fails or enters technical review.

## 5. Technical Architecture

### Recommended Stack

| Area | Choice | Rationale | Runner-Up Rejected |  
| --- | --- | --- | --- |  
| iOS app | Swift + SwiftUI | Best access to LocalAuthentication, HealthKit, background modes, Keychain, App Attest | React Native, rejected for verification-native complexity |  
| Android app | Kotlin + Jetpack Compose | Best access to BiometricPrompt, Health Connect, Wear OS, Play Integrity | Flutter, rejected for native wearable and background risk |  
| Backend API | TypeScript + NestJS on Cloud Run | Structured services, strong ecosystem, scalable managed containers | Go services, rejected for slower product iteration |  
| Database | Cloud SQL PostgreSQL + PostGIS | Relational integrity, auditability, region queries | Firestore-only, rejected for financial/audit workflows |  
| Cache/leaderboards | Memorystore Redis | Sorted sets are ideal for ranking and fast reads | PostgreSQL-only ranking, rejected for scale/latency |  
| Async jobs | Pub/Sub + Cloud Tasks + Cloud Scheduler | Reliable eventing, retries, scheduled regional jobs | Cron on app servers, rejected for reliability |  
| Chat | Firestore | Managed real-time sync and moderation-friendly storage | Custom WebSockets, rejected for MVP complexity |  
| Profile media | Cloud Storage + signed upload URLs + moderation status in PostgreSQL | Stores optional avatars/photos outside relational rows with auditable moderation | Database BLOBs, rejected for cost and performance |  
| Creator-led challenge and external platform integration | Creator/challenge service + creator submission workflow + regional workout selection records + external platform link/API metadata + official GoGymGo YouTube surface references + YouTube embed safe-zone policy + sponsor CTA attribution + disclosure and asset approval records | Enables V1 creator-led sponsored challenges and monthly regional creator payouts without requiring owned in-app GoGymGo video upload or sponsor ads inside embedded players | Owned in-app video upload and in-player ad products, deferred until moderation, creator rights, and platform approval workflows justify the complexity |  
| Push | Firebase Cloud Messaging + APNs | Cross-platform notification delivery | OneSignal, rejected to reduce third-party dependency |  
| Payments/KYC | Stripe Identity + Stripe Connect Express | Mature identity and payout rails | PayPal Hyperwallet, rejected for MVP complexity |  
| Sponsor analytics/reporting | Amazon Kinesis or Data Firehose + S3 + Redshift Serverless/Athena + QuickSight Embedded | Auditable sponsor-facing CPM, viewability, reach, frequency, and campaign dashboards | Product-analytics-only reporting, rejected because sponsor billing needs a first-party event ledger |  
| Product analytics | PostHog for MVP + Amplitude as later-stage option, routed through RudderStack or Segment | Funnels, retention, cohorts, session replay, experiments, and warehouse-owned event routing | Generic app analytics-only, rejected because AWS-hosted analytics and sponsor reporting need warehouse ownership |  
| Observability | Cloud Logging, Cloud Monitoring, Sentry | Backend/mobile error visibility | Datadog, rejected for MVP cost |

### Required APIs And SDKs

- Apple LocalAuthentication for Face ID/Touch ID.  
- Android BiometricPrompt for biometric authentication.  
- Apple HealthKit and HKWorkoutSession for iOS health and workout data.  
- Google Health Connect for Android health records.  
- Wear OS Health Services for active wearable HR where available.  
- Bluetooth LE Heart Rate Service for open chest straps and compatible devices.  
- Apple DeviceCheck and App Attest for device integrity.  
- Google Play Integrity API for Android device integrity.  
- Firebase Cloud Messaging and APNs for push notifications.  
- Cloud Storage signed upload URLs for optional avatar and personal photo uploads.  
- Creator-led challenge APIs, creator submission and regional selection workflow, external platform link validation, official GoGymGo YouTube channel/playlist references, official YouTube embed/IFrame player integration, YouTube Data API or equivalent platform API where permitted, Made for Kids status checks where required, sponsor safe-zone enforcement, sponsor CTA redirect/attribution service, disclosure records, sponsor asset approvals, creator payout tracking, and reward fulfillment reporting.  
- V2 owned video upload, media processing, thumbnail generation, content moderation, and takedown tooling for creator/user workout videos only after V1 creator-led challenges are validated.  
- V2 sponsor marketplace, promo-code, product-link, and deeper attribution services.  
- Google Maps Geocoding or Mapbox Geocoding for region confirmation; MVP recommendation: Google Maps Platform for stronger ecosystem coverage.  
- Stripe Identity and Stripe Connect Express for winner verification and payouts.  
- SendGrid for transactional email.  
- Twilio Verify only if phone verification becomes required for fraud control.  
- CoreBluetooth on iOS and Android Bluetooth LE Scanner for approved BLE beacon detection.  
- AVFoundation metadata capture on iOS and CameraX plus ML Kit Barcode Scanning on Android for QR entry/exit verification.  
- Partner gym admin tooling for beacon registry, QR checkpoint rotation, gym competition configuration, and hardware health monitoring.  
- Amazon Kinesis Data Streams or Amazon Data Firehose for sponsor and product event ingestion.  
- Amazon S3, Redshift Serverless, Athena, and QuickSight Embedded for sponsor reporting and campaign dashboards.  
- PostHog SDK for MVP product analytics; Amplitude SDK can be added later for deeper behavioral analytics.  
- RudderStack or Segment for vendor-neutral event routing into product tools and the AWS event lake.

### Analytics And Sponsor Reporting Stack

GoGymGo uses two analytics stacks with different trust boundaries.

Sponsor-facing reporting stack:

- Source of truth: first-party ad exposure ledger, not PostHog, Amplitude, or GA4 screenshots.  
- Ingestion: app and web events stream through Amazon Kinesis Data Streams or Amazon Data Firehose.  
- Storage: Amazon S3 stores immutable raw events with partitioning by date, region, campaign, sponsor, gym, and placement.  
- Warehouse/query: Amazon Redshift Serverless serves campaign reporting; Amazon Athena supports audit queries and backfills against S3.  
- Sponsor dashboard: Amazon QuickSight Embedded shows sponsor-specific reporting inside the GoGymGo sponsor portal.  
- Core sponsor measures: served impressions, viewable impressions, unique reach, average frequency, average viewable seconds, total viewable time, clicks, CTR, effective CPM, viewable CPM, placement mix, fraud-filtered impressions, and workout-verification exposure.

Internal product analytics stack:

- MVP: PostHog for funnels, retention, cohorts, feature flags, experiments, surveys, and session replay where consented.  
- Scale option: Amplitude for deeper product analytics and executive reporting once usage and product-team needs justify it.  
- Event routing: RudderStack or Segment sends normalized events to PostHog/Amplitude and the AWS event lake without coupling the app to one analytics vendor.  
- Product measures: onboarding conversion, commitment creation, verified-session funnel, biometric failure stages, HR-validation failure reasons, weekly pairing completion, Make-Up Bonus behavior, gym verification, retention, notification response, and payout onboarding.

### Architecture Diagram

```mermaid  
flowchart TD  
    A[iOS App - Swift] --\> B[API Gateway / Cloud Run]  
    C[Android App - Kotlin] --\> B  
    A --\> D[HealthKit / Apple Watch]  
    C --\> E[Health Connect / Wear OS]  
    A --\> F[BLE Heart Rate Devices]  
    C --\> F  
    A --\> S[Gym Beacon / QR Checkpoint]  
    C --\> S  
    S --\> B  
    B --\> G[PostgreSQL + PostGIS]  
    B --\> H[Redis Leaderboards]  
    B --\> I[Pub/Sub Event Bus]  
    I --\> J[Session Validation Workers]  
    I --\> K[Fraud Scoring Workers]  
    I --\> L[Prize Draw And Payout Workers]  
    B --\> M[Firestore Pair Chat]  
    B --\> N[Cloud Tasks / Scheduler]  
    L --\> O[Stripe Identity + Connect]  
    B --\> P[Sponsor Campaign Service]  
    B --\> Q[AWS Event Pipeline]  
    Q --\> Q1[S3 Event Lake]  
    Q1 --\> Q2[Redshift / Athena]  
    Q2 --\> Q3[QuickSight Sponsor Dashboards]  
    Q --\> Q4[PostHog / Amplitude Product Analytics]  
    B --\> R[FCM / APNs Push]  
```

### Data Model Sketch

Primary entities:

- `User`: id, auth provider, email hash, public profile mode, alias/display name, real-name display value, avatar media id, date of birth band, region id, timezone, account status, created timestamp.  
- `ProfileMedia`: id, user id, media type, storage object hash/path, moderation status, active flag, created timestamp, deleted timestamp.  
- `Device`: id, user id, platform, attestation status, integrity score, last seen timestamp.  
- `HealthConnection`: id, user id, source type, permission status, device metadata, last sync timestamp.  
- `VerificationPreference`: id, user id, verification path, health connection id, partner gym id, QR eligibility status, active flag, updated timestamp.  
- `Commitment`: id, user id, period start/end, weekly target frequency, cutoff timestamp, locked status, weekly success statuses, weekly multiplier status, perfect-month status, final commitment multiplier.  
- `Session`: id, user id, commitment id, region id, start/end timestamps, status, validation result, fraud score.  
- `BiometricCheckpoint`: id, session id, checkpoint type, timestamp, platform result, signed payload hash.  
- `HeartRateSampleSummary`: id, session id, source, sample count, elevated minutes, max gap, anomaly flags.  
- `EntryLedger`: id, user id, session id, period id, week id, reason, multiplier, entries, status, source, created timestamp.  
- `DrawEntryLedger`: id, user id, commitment id, period id, week id, entries, reason, status.  
- `WeeklyPairing`: id, region id, gym id, tier id, user A, user B, week start/end, user A target, user B target, status.  
- `Message`: id, weekly pairing id, sender id, body, moderation status, created timestamp.  
- `MakeUpBonusPool`: id, weekly pairing id, missed user id, claimant user id, available entries, claimed entries, status, expires at.  
- `LeaderboardSnapshot`: id, region id, period id, user id, rank, entries.  
- `SponsorCampaign`: id, sponsor id, region id, month, creative assets, CTA, budget, payout allocation, creator payout allocation, status.  
- `SponsorAdSlot`: id, sponsor campaign id, slot type, screen/surface, placement label, sponsor-area treatment type, creative asset id, CTA/link id, disclosure text, active dates, frequency cap, viewability rules, status.  
- `AdExposureEvent`: id, sponsor campaign id, user id, region id, gym id, placement, creative version, event type, served timestamp, viewable start/end timestamp, visible milliseconds, click/dismiss action, fraud-filter status.  
- `ProductAnalyticsEvent`: id, user id, anonymous device id, session id, event name, properties JSON, source, timestamp, consent status.  
- `SponsorLink`: id, sponsor campaign id, link type, destination URL, promo code, disclosure text, active window, moderation status, tracking parameters.  
- `SponsorLinkClick`: id, sponsor link id, user id, campaign id, placement, region id, gym id, timestamp, attribution metadata, conversion status where available.  
- `CreatorProfile`: id, user id, display name, alias/real-name preference, avatar/photo URL, verified channels, external platform URLs, bio, region, approval status, moderation status.  
- `CreatorApplication`: id, user id, region id, application source, user-facing status, workout styles, external channel URLs, payout onboarding status, rights/disclosure acknowledgement status, moderation status, reviewer notes, created timestamp, updated timestamp.  
- `UserCreatorFollow`: id, user id, creator profile id, primary flag, follow source, referral id, consent status, active status, created timestamp, updated timestamp, ended timestamp.  
- `ExternalWorkoutContent`: id, creator profile id, platform, external content ID, URL, title, thumbnail URL, duration, channel/creator ID, embed/link status, moderation status, paid-promotion disclosure status, Made for Kids status where applicable, playback privacy mode, sponsor safe-zone status, takedown status, last API sync.  
- `CreatorSubmission`: id, creator profile id, sponsor campaign id, region/gym scope, submission window id, video URL or file-handoff reference, title, workout type, duration, intensity, equipment requirements, safety notes, rights attestation status, disclosure status, moderation status, guideline-compliance status, creator draw-entry reward amount, creator draw-entry reward status, review score, selected status, timestamps.  
- `RegionalCreatorWorkout`: id, sponsor campaign id, selected creator profile id, selected creator submission id, external workout content id, region/gym scope, GoGymGo YouTube channel or playlist reference, month, payout pool amount, payout criteria, publication status, takedown status.  
- `CreatorChallenge`: id, creator profile id, sponsor campaign id, regional creator workout id, region/gym scope, start/end dates, eligible workout rules, user reward mix, creator payout pool, official rules URL, approval status, challenge status.  
- `CreatorChallengeReferral`: id, creator challenge id, source platform, referral URL/code, landing visit id, user id, timestamp, attribution metadata.  
- `SponsorCreativeApproval`: id, sponsor campaign id, creator challenge id, asset type, approved copy, approved logos, trademark permission, required disclosure text, approval status, reviewer, timestamps.  
- `SponsorLink`: id, sponsor campaign id, creator challenge id, link type, destination URL, promo code, UTM tags, active dates, click count, redemption count.  
- `UserWorkoutProgress`: id, user id, creator challenge id, external workout content id, completion status, notes, chart metrics, linked verified session ids, creator attribution.  
- `CreatorPayout`: id, creator profile id, regional creator workout id, sponsor campaign id, amount, currency, payout reason, payout criteria status, Stripe account id, status, review notes, timestamps.  
- `Draw`: id, region id, period id, eligible user count, winner count, seed reference, status, executed timestamp.  
- `DrawEntry`: id, draw id, user id, entry type, signup entry count, earned entry weight, selected status.  
- `Payout`: id, draw id, user id, amount, currency, Stripe account id, status.  
- `FraudCase`: id, user id, session id, reason codes, severity, reviewer id, resolution.  
- `Gym`: id, name, address, region id, timezone, partner status, competition status.  
- `GymCompetition`: id, gym id, period id, sponsor id, eligibility rules, leaderboard status, prize pool id.  
- `GymBeacon`: id, gym id, beacon provider, UUID/identifier hash, placement label, active status, last health check.  
- `GymQrCheckpoint`: id, gym id, checkpoint type, signing key version, rotation interval, active status.  
- `GymPresenceEvent`: id, user id, gym id, session id, method, checkpoint type, timestamp, confidence score, validation status.

## 6. Anti-Fraud And Anti-Cheat Design

### Threats

- User asks someone else to carry their phone.  
- User shares a device or account.  
- User spoofs HR data through fake BLE devices or manipulated health records.  
- User spoofs GPS or region.  
- User scans a shared QR screenshot instead of being at the gym.  
- User spoofs or relays a Bluetooth beacon signal from outside the gym.  
- Gym beacon is moved, disabled, or placed too close to non-gym public space.  
- User creates multiple accounts.  
- User runs the app on rooted, jailbroken, emulator, or instrumented devices.  
- User automates app actions or replays session events.

### Controls

- Require local biometric authentication at all three checkpoints.  
- Use Apple App Attest/DeviceCheck and Google Play Integrity API.  
- Bind session events to device ID, user ID, session ID, nonce, and timestamp.  
- Validate HR data consistency, source metadata, sample cadence, and physiologic plausibility.  
- Prefer first-party HealthKit/Health Connect and known wearable sources over untrusted BLE when assigning fraud risk.  
- Detect impossible travel, VPN/proxy anomalies, GPS spoofing signals, and region mismatch between GPS/IP/device locale.  
- Use signed rotating QR payloads with short expiry windows; reject expired codes and codes for the wrong gym, door, or checkpoint type.  
- Rotate BLE beacon identifiers or signed advertisement payloads where supported; validate beacon ID, RSSI range, dwell time, gym geofence, and timestamp consistency.  
- Require entry and exit verification for gym-competition credit; a missing gym checkpoint can still allow regional session credit if biometric and HR validation pass.  
- Monitor beacon health, QR rotation status, and suspicious repeated scans through admin tools.  
- Limit accounts per device, payment identity, phone number if collected, and payout account.  
- Use risk scoring to hold sessions or payouts for manual review.  
- Maintain immutable audit logs for session validation, draw inputs, draw outputs, and payout decisions.

### Limitations

- On-device biometric APIs confirm a recognized local biometric, not legal identity.  
- Open Bluetooth heart-rate devices can be emulated.  
- Location can be spoofed on compromised devices.  
- Strong payout fraud control requires KYC, device integrity, behavioral analytics, and manual review.

## 7. Compliance And Legal Flags

This PRD does not provide legal advice. GoGymGo requires qualified legal review before launch.

### Health Data

- HealthKit and Health Connect data require explicit consent and platform policy compliance.  
- HIPAA may not apply unless GoGymGo works with covered entities or business associates, but health privacy obligations still exist under state, federal, platform, and contractual rules.  
- GDPR, UK GDPR, and CCPA/CPRA may apply depending on user location.  
- Data minimization, purpose limitation, retention limits, deletion, access, and export workflows are required.

### Biometric Data

- GoGymGo should not store biometric templates.  
- Biometric result events and device verification metadata may still be sensitive.  
- Laws such as Illinois BIPA and similar biometric privacy laws may apply.  
- Consent, retention, disclosure, and deletion policies require legal review.

### Sweepstakes, Lottery, Gambling, And Contests

- Sponsor-funded weighted prize draws may be regulated as sweepstakes, contests, lotteries, or gambling depending on jurisdiction.  
- The combination of prize, chance, and consideration is legally sensitive.  
- Free participation and no-purchase-required routes may be required.  
- Weighting odds by activity entries must be reviewed before launch.  
- Official rules, eligibility, tax reporting, bonding/registration, winner lists, and jurisdiction exclusions may be required.

### Payments And Tax

- Payouts may require identity verification, sanctions screening, tax forms, and income reporting.  
- Stripe handles parts of the payout workflow, but GoGymGo remains responsible for program rules and compliance.

### Advertising And Sponsorship Compliance
- Sponsor placements must include required disclosures.  
- Sponsor promo links and marketplace offers must not be required for prize participation.  
- Creator-led sponsored challenges must store required paid-promotion disclosures, approved sponsor language, platform policy requirements, and sponsor asset approvals.  
- If a YouTube video is embedded, GoGymGo sponsor ads may appear only in GoGymGo-owned UI outside the YouTube player, such as the challenge header, below-player challenge cards, verification flow, post-workout reward surfaces, and sponsor offer panels.  
- GoGymGo must not place sponsor overlays, skins, clickable layers, custom pre-roll, custom mid-roll, custom post-roll, or interstitial gates on or inside the YouTube player, and must not block, modify, replace, or interfere with YouTube-served ads, player controls, links, metadata, or playback context signals.  
- Screens with embedded YouTube content must provide independent GoGymGo value before sponsor placements are sold on that screen, such as challenge rules, verification controls, progress state, reward status, and GoGymGo-owned sponsor offers.  
- Users must be rewarded for verified GoGymGo workouts, not external-platform views, likes, subscribes, comments, shares, watch time, or YouTube ad impressions.  
- CPM and sponsor reporting must avoid misleading claims. Verified GoGymGo impressions should be separated from estimated reach, creator referral traffic, external-platform metrics, YouTube views, and YouTube-served ads.  
- Campaign reporting must avoid sharing sensitive health data unless legally approved and explicitly consented.  
- Sponsor dashboard methodology must cover impressions, view duration, creator referrals, workout starts, verified finishers, CTA clicks, promo engagement, reward efficiency, and exclusions for embedded-player inventory.  
- Policy source links for implementation review: YouTube API Services Terms of Service (https://developers.google.com/youtube/terms/api-services-terms-of-service), YouTube API Services Developer Policies (https://developers.google.com/youtube/terms/developer-policies), Complying with YouTube's Developer Policies (https://developers.google.com/youtube/terms/developer-policies-guide), YouTube Embedded Player Parameters (https://developers.google.com/youtube/player_parameters), and FTC Endorsements, Influencers, and Reviews guidance (https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews).

## 8. Monetization And Sponsorship Operations

### Sponsorship Model

- Sponsors buy monthly regional competition sponsorships.  
- Each sponsorship includes app-open placement, leaderboard branding, winner announcement branding, prize-pool underwriting, and aggregated campaign reporting.  
- Sponsor pricing should combine measurable media value with a contracted prize-pool commitment, because a reliable winner experience cannot depend on projected ad impressions alone.  
- A sponsor contract defines region, month, total spend, guaranteed prize pool, payout allocation, creative requirements, prohibited claims, reporting, and cancellation terms.

### Creator-Led Sponsored Challenge Model
V1 should support creator-led sponsored challenges as a managed GoGymGo sales product, not an open creator sponsor marketplace.

- GoGymGo sources and manages the sponsor relationship in V1.
- Approved creators are campaign partners who drive qualified traffic into GoGymGo challenges from YouTube or other supported external platforms.
- Creator self-sourced sponsor onboarding, sponsor reservation, and sponsor-protection workflows are deferred to a later phase.
- Rewards can be a mix of cash, sponsor products, gift cards, sponsor credits, coupons, and other legally reviewed reward types.
- Sponsor packages can include a separate selected-creator payout pool for the monthly regional GoGymGo YouTube workout. This pool is distinct from user prizes, user prize draw entries, and sponsor media value.
- Creator payout terms should be based on selection, approved deliverables, content usage rights, disclosure compliance, and any legally approved verified-completion metrics, not YouTube views, watch time, likes, comments, subscriptions, or YouTube ad performance.
- Campaign contracts should define creator deliverables, approved sponsor copy, allowed claims, disclosure language, platform rules, reward obligations, reporting, cancellation rights, and brand-safety requirements.
- A practical pilot package can combine a fixed sponsor fee, a creator activation fee, a selected-creator payout pool, a legally reviewed user reward pool, and reporting. Early package ranges should be conservative until conversion data is proven: local/gym creator pilots around $5,000-$10,000, targeted creator challenges around $15,000-$30,000, regional creator challenges around $30,000-$60,000, and larger proven campaigns at $75,000+.
- Pricing should be justified by verified GoGymGo impressions, verified workout starts, verified finishers, creator referral traffic, CTA/promo clicks, reward redemption, content usage rights, category exclusivity, and reporting quality.
- YouTube-embedded screens should be sold as GoGymGo challenge sponsorships, not as YouTube player ad inventory. Sponsor value should come from app-open placements, verification placements, challenge-page safe-zone placements, offer panels, creator referrals, verified workouts, and reward redemption.
### Market Benchmark Basis

- Google AdMob defines eCPM as estimated earnings per 1,000 ad impressions: `(total earnings / impressions) x 1,000` (https://support.google.com/admob/answer/15337570).  
- Playwire's 2025 Tier 1 mobile benchmarks cite banner eCPMs of $0.50-$1.50, interstitials of $5.00-$8.00, and rewarded video of $15.00-$30.00 (https://www.playwire.com/blog/admob-ecpm-benchmarks-what-publishers-should-expect).  
- AdLibrary's 2026 mobile app advertising guide cites open-network in-app display CPMs of EUR 0.50-EUR 2.00, interstitial CPMs of EUR 4-EUR 12, and rewarded video CPMs of EUR 8-EUR 25 (https://adlibrary.com/posts/mobile-advertising-applications).  
- GoGymGo planning assumption: use a $15-$35 direct-sold sponsor CPM for app-open, leaderboard, and winner-announcement media value. Use $25 CPM as the base case. Sponsor package value above media value must be sold as prize underwriting, category exclusivity, local activation, and association with verified fitness participation.

### Prize Pool Policy

Recommended MVP policy:

- The monthly prize pool is a fixed dollar amount in the sponsor contract.  
- The sponsor funds the prize pool before the competition opens.  
- The app displays the guaranteed prize pool and prize rules before users commit.  
- Prize rules must disclose the one-time signup entry, workout-based entries, and how each affects weighted prize draw odds.  
- Cash payouts below $10 should be avoided because payout fees, tax handling, and user perception make very small cash prizes weak.  
- If a sponsor cannot fund the required cash pool, use sponsor products, credits, gift cards, or coupons with disclosed retail value, subject to legal review.

MVP prize-pool inputs:

- Eligible users: 60% of regional MAU.  
- Winners: 15% of eligible users.  
- Minimum winner value: $10.  
- Prize reserve: 10% for payout fees, rounding, failed payouts, and bonus-prize flexibility.  
- Prize allocation: 40% of the total sponsor package.  
- Base media pricing: $25 direct-sold sponsor CPM.  
- Base engagement: 12 app opens per MAU per month.  
- Base verified workouts: 4 completed workouts per eligible user per month.  
- Workout verification ad load: 3 sponsor impressions per completed workout, shown at check-in, mid-workout verification, and check-out.

Prize-pool formulas:

`Eligible users = MAU x 60%`

`Winner count = eligible users x 15%`

`Required prize pool = winner count x $10 x 1.10 reserve`

`Minimum sponsor package = required prize pool / 40% prize allocation`

`Media value = ((MAU x 12 app opens) + (eligible users x 4 verified sessions x 3 verification sponsor placements)) x $25 CPM / 1,000`

`Sponsor activation premium = minimum sponsor package - media value`

### Recommended Prize Pools By Region Size

| Scenario | MAU | Eligible Users | Winners At 15% | Media Value | Required Prize Pool | Minimum Sponsor Package | Minimum Winner Value |  
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |  
| Pilot region | 2,000 | 1,200 | 180 | $960 | $2,000 | $5,000 | $10 |  
| Launch city | 10,000 | 6,000 | 900 | $4,800 | $10,000 | $25,000 | $10 |  
| Large metro | 50,000 | 30,000 | 4,500 | $24,000 | $50,000 | $125,000 | $10 |  
| Regional cluster | 100,000 | 60,000 | 9,000 | $48,000 | $100,000 | $250,000 | $10 |

Assessment:

- The reliable prize pool should be set from winner count and minimum winner value, then funded contractually before the month begins.  
- At MVP scale, GoGymGo should sell sponsorships as campaign packages, not as media-only app-open ads.  
- The base package target is about $2.50 per MAU per sponsored month, with roughly $1.00 per MAU reserved for prizes and sponsor media value supported by app-open plus workout-verification impressions.  
- The 15% winner rule is viable if average winner value starts near $10 and sponsors understand that the package funds prizes, exclusivity, and local activation in addition to impressions.  
- Larger cash prizes should be tiered: keep the 15% winner pool for $10+ baseline rewards, then allocate surplus sponsor funds to top-tier bonus winners.

### Payout Pool Funding

Recommended MVP allocation:

- 40% prize pool.  
- 35% GoGymGo revenue and product operations.  
- 15% fraud review, legal/compliance operations, tax support, and customer support.  
- 10% payment fees, failed-payout reserve, and sponsor reporting operations.

Payout rules:

- Payout terms are fixed before the monthly competition begins.  
- Payout terms cannot change after the competition starts.  
- Unused reserve is handled according to official rules: roll forward, add bonus prizes, or return to sponsor depending on contract terms.  
- All payout structures require legal review before launch.

### Winner Pool Math

- Eligible player pool = users in a region who meet official rules and minimum participation eligibility.  
- Winner count = 15% of eligible regional users, using legal-approved rounding.  
- Each eligible user receives prize draw weight equal to monthly entries.  
- Winners are selected without replacement using weighted random selection.  
- The prize draw process records inputs, total weight, selected winners, timestamp, and audit metadata.  
- Prize budget is independent from prize draw odds; entries improve selection probability, not prize value unless a tiered-prize policy says otherwise.  
- Signup entries provide baseline prize draw participation for new users; verified activity entries increase odds beyond that baseline.

### Worked Examples

| Scenario | Winner Count | Guaranteed Prize Pool | Baseline Rewards | Bonus Prize Option |  
| --- | ---: | ---: | --- | --- |  
| Pilot region | 180 | $2,000 | 180 winners receive $10 value | Up to $200 reserve for fees, failed payouts, or bonus rewards |  
| Launch city | 900 | $10,000 | 900 winners receive $10 value | Up to $1,000 reserve or ten $100 bonus prizes |  
| Large metro | 4,500 | $50,000 | 4,500 winners receive $10 value | Up to $5,000 reserve or tiered bonus prize pool |

### Sponsor Reporting

Sponsor-facing analytics stack:

- First-party ad exposure events are the sponsor reporting source of truth, separate from product analytics dashboards.  
- Mobile and web clients emit `ad_requested`, `ad_rendered`, `ad_viewable_start`, `ad_viewable_end`, `ad_click`, `ad_dismissed`, `sponsor_checkin_view`, `sponsor_midworkout_view`, `sponsor_checkout_view`, `creator_referral_click`, `creator_follow_selected`, `creator_follow_changed`, `creator_guidelines_viewed`, `creator_application_started`, `creator_application_saved`, `creator_submission_started`, `creator_submission_submitted`, `creator_submission_entries_awarded`, `regional_creator_workout_selected`, `creator_challenge_landing_view`, `creator_challenge_signup`, `creator_challenge_verified_start`, `creator_challenge_verified_finish`, `creator_payout_approved`, `creator_payout_paid`, and `reward_redemption` events.  
- Events stream through Amazon Kinesis Data Streams or Amazon Data Firehose into Amazon S3 as the raw event lake.  
- Amazon Redshift Serverless is the primary sponsor reporting warehouse; Amazon Athena can query raw S3 data for audit, backfills, and lower-cost exploration.  
- Amazon QuickSight Embedded powers sponsor dashboards inside the GoGymGo sponsor portal.  
- Sponsor reports separate served impressions, viewable impressions, unique reach, average frequency per user, average viewable seconds, total viewable time, clicks, CTR, effective CPM, viewable CPM, sponsor area performance by placement, creator applications, creator submissions, selected regional workout, creator referral clicks, challenge page visits, signups, verified starts, verified finishers, promo-link clicks, marketplace clicks, offer redemptions where available, reward redemption by reward type, creator payout funding, prize-pool funding, and activation premium.  
- Viewability uses a first-party measurement baseline aligned to common digital ad standards: display creative counts as viewable when at least 50% is on screen for at least 1 continuous second; video creative should require at least 2 continuous seconds.  
- Fraud-filtered impressions, bot/device-integrity flags, duplicate events, and technically invalid sessions are excluded from billable sponsor reporting.  
- No raw health, biometric, legal identity, or public profile media data is shared with sponsors.

Internal product analytics stack:

- PostHog is the MVP product analytics layer for funnels, retention, cohorts, feature flags, experiments, surveys, and session replay where legally consented.  
- Amplitude remains the later-stage product analytics option if the team needs deeper behavioral analysis, larger product org workflows, or executive analytics beyond MVP.  
- RudderStack or Segment routes clean client and server events to PostHog/Amplitude and the AWS event lake, so GoGymGo avoids hard-coding analytics vendors into the app.  
- Internal analytics tracks onboarding conversion, creator follow selection, commitment selection, session start/completion, biometric failure stages, HR validation failure reasons, weekly pairing behavior, Make-Up Bonus claim behavior, sponsor ad interactions, gym verification success, retention, and payout flow completion.  
## 9. MVP Scope And Later Phases

### MVP Scope

- Native iOS and Android apps.  
- Account creation with Apple, Google, and email.  
- Public profile identity toggle with Private, Alias, and Real Name modes plus optional avatar/photo upload.  
- Onboarding training-path selection from approved creator profiles, including solo training, creator follow, referral-preselected creator confirmation, later follow changes, a signup-time Learn More creator guidelines path, and a signup-time Apply as Creator path for users who want to submit local workouts.  
- Biometric start, random mid-session, and end checkpoints.  
- HealthKit, Health Connect, Wear OS, Apple Watch where available, Bluetooth LE heart-rate support, and partnered gym QR entry/exit verification.  
- Monthly commitment selection, weekly 2x adherence rewards, and 10x perfect-month commitment reward.  
- Entries, tiers, weekly pairing, Make-Up Bonus, and text-only weekly partner messaging.  
- Regional leaderboards.  
- Gym competition pilot with QR entry/exit verification, including QR-based session start/end for users who select a partner gym instead of a heart-rate device, and optional BLE beacon verification for approved partner gyms.  
- Monthly sponsor campaigns, app-open sponsor placement, workout-verification sponsor placements, AWS-backed sponsor reporting dashboards, and creator-led sponsored challenge pilot.  
- Explicit neutral sponsor areas for the app-wide sponsored-by rail, app-open, creator signup, creator workout discovery, creator workout detail safe-zone, check-in, check-out, leaderboard/winner announcement, and reward surfaces.  
- Monthly regional GoGymGo YouTube workout pilot where local creators submit follow-along workouts, guideline-compliant creator video submissions earn 50 prize draw entries, GoGymGo selects one featured workout, a sponsor funds safe-zone placements, users earn through verified workouts, and the selected creator can earn a sponsor-funded payout.
- External workout platform link/API metadata for approved creator challenges, starting with YouTube where permitted.  
- YouTube embed safe-zone checklist for creator challenge pages: official embed only, no sponsor overlays or player gates, no interference with YouTube ads/controls/links, `autoplay=false` default, Made for Kids status check where required, and link-out fallback when policy is unclear.  
- Weighted random monthly prize draw by region.  
- Stripe Identity and Stripe Connect payouts.  
- Basic admin tools for sponsors, fraud review, user support, draws, and payouts.

### Cut From V1

- Full sponsor self-serve buying portal.  
- Creator-owned sponsor onboarding, sponsor reservation, and sponsor-protection workflows.  
- Owned GoGymGo creator/user video uploads and user-generated progress video feeds.  
- Full sponsor marketplace pages, deeper sponsor website/product/promo-link conversion integrations, and creator self-service campaign tools.  
- Sponsor overlays, skins, custom pre-roll/mid-roll/post-roll, interstitial gates, or clickable sponsor layers on embedded YouTube players.  
- Advanced friend graphs or team competitions.  
- Video, image, or group messaging.  
- Custom medical HR thresholds.  
- Global competitions across legal jurisdictions.  
- Complex wearable-specific integrations beyond Apple, Google, Wear OS, and BLE HR.  
- Social sharing feeds.  
- In-app purchases or paid subscriptions.

### Later Phases

- Sponsor self-serve portal.  
- V2 sponsor marketplace and promo-link system with deeper attribution, redemption, marketplace, and conversion reporting.  
- V2 creator sponsor relationship tools, creator self-sourced sponsor workflows, sponsor reservation/protection, broader creator marketplace discovery, and optional owned GoGymGo video/progress media after V1 validation.  
- Corporate wellness and employer-sponsored competitions.  
- Gym chain partnerships and location-verified gym challenges.  
- Gym operator dashboards, beacon health monitoring, inter-gym leagues, and multi-location gym chain competitions.  
- More wearable integrations such as Garmin, Polar, Fitbit where APIs and terms permit.  
- Teams, clubs, and friend leaderboards.  
- Advanced fraud machine learning.  
- Tiered prize structures and non-cash rewards.  
- Multi-language expansion.

## 10. Open Questions And Risks

### Open Questions

- Which jurisdictions are included in the first launch? Recommendation: start with one or two legally reviewed North American regions.  
- Should users have an alternate method of entry for prize eligibility? Recommendation: legal counsel should design this if needed.  
- Are prizes cash, gift cards, sponsor products, or a mix? Recommendation: start with cash or prepaid card equivalents through Stripe-compatible payout flows only if legally approved.  
- What is the minimum age? Recommendation: start with 18+ only.  
- How strict should HR validation be for beginners and users with medical conditions? Recommendation: use conservative default thresholds and exclude medical personalization from v1.  
- Can users complete sessions outside their home region while traveling? Recommendation: allow activity but attribute competition eligibility to locked home region for the month.  
- Which gym partners and hardware model should launch first? Recommendation: launch QR-first for broad operational simplicity, with BLE beacons piloted at higher-volume gyms where hardware can be monitored.  
- Which creator/sponsor package should launch first: local/gym pilot, targeted creator challenge, regional creator challenge, or larger category-exclusive campaign? Recommendation: start with a managed creator pilot in one legally reviewed region.  
- Which external platforms beyond YouTube should be approved in V1, and what API, embed, disclosure, and takedown requirements should each platform meet? Recommendation: start link-first, then add API metadata only where terms are clear.  
- Should MVP embed YouTube videos in-app or link users out to YouTube? Recommendation: use link-out as the safest default and embed only on screens with official YouTube player behavior, GoGymGo-owned safe-zone sponsor placements, and legal/platform review.  

### Key Risks

- Legal classification of weighted random draws could materially change the business model.  
- iOS background limitations could weaken random ping reliability.  
- Fraud attempts may increase as prize pools grow.  
- Wearable data quality varies by device and platform.  
- Sponsor acquisition risk: the recommended prize model requires sponsors to fund a prize pool floor above open-market media value, so early regions need category exclusivity, local activation, or product-prize support to close campaigns.  
- Gym verification operations may fail if beacons are moved, batteries die, QR signage is copied, or gyms do not maintain entry/exit checkpoint placement.  
- Privacy concerns could reduce onboarding conversion if consent screens are too broad.  
- Public profile, alias, and photo features create moderation and impersonation risk if naming and image review controls are weak.  
- Creator-led sponsor compliance risk: creator promotions may miss disclosures, use unapproved claims, misuse sponsor marks, or conflict with platform policies. Mitigation: store required disclosure language, sponsor approvals, allowed claims, platform requirements, brand-safety review, and takedown workflows.  
- Creator payout and content-rights risk: creators may dispute selection criteria, usage rights, payout eligibility, tax handling, or sponsor-funded compensation. Mitigation: require submission terms, rights attestation, creator payout criteria, moderation records, sponsor approval, tax/payout onboarding where required, and a documented dispute/takedown workflow.
- External platform dependency risk: YouTube or another platform may limit API access, embedding, attribution, promotional behavior, or ad placement around embedded content. Mitigation: use link-first fallback, avoid rewarding platform engagement, avoid in-player sponsor ads, cache only permitted metadata, monitor API policy changes, and maintain platform-specific compliance checklists.  
- YouTube embedded-player monetization risk: GoGymGo could violate YouTube policies by covering player controls, blocking YouTube-served ads, gating video playback with sponsor creative, or selling sponsor inventory as if it were YouTube player inventory. Mitigation: enforce safe-zone layouts, ban player overlays/gates, separate YouTube metrics from GoGymGo billable impressions, and require platform/legal review before any embedded-player monetization changes.  
- V2 sponsor marketplace and promo links require advertising disclosures, destination safety review, conversion-attribution controls, and sponsor offer governance.

## 11. Assumptions

- Launch market is North America first.  
- Users are adults and participate for free.  
- Public profile defaults to Private; users can switch to Alias or Real Name and can upload, replace, or delete an optional avatar or personal photo.  
- No purchase is required to participate.  
- New users receive one registration prize-draw entry in the signup month, even if they do not work out that month.  
- New users can pick a primary creator to follow during onboarding; referral links can preselect a creator for confirmation, and users can change follows later.
- Regional competitions are legally reviewed before launch.  
- The app does not store raw biometric templates.  
- Biometric authentication is local-device verification, not identity proof by itself.  
- Prize-eligible workout sessions require either heart-rate validation from an approved source or partnered gym QR entry/exit validation at an approved gym.  
- The app may require foreground session mode for MVP reliability.  
- Users always select a whole-month commitment before the monthly cutoff.  
- Weekly commitment success means completing at least the selected number of valid sessions in that commitment week.  
- Weekly commitment prize draw entries equal the selected weekly frequency for each successful commitment week. Monthly base entries are selected days per week multiplied by 4 weeks.  
- The perfect-month reward is a 10x total commitment multiplier applied to monthly base entries, not an additive 2x plus 10x stack. For example, a 7-days-per-week commitment produces 28 monthly base entries and 280 perfect-month prize draw entries when completed for the full month.  
- Weekly pairing is the product's pairing model; users are matched once per week within tier, with same-gym and similar-commitment matches preferred where available.  
- Make-Up Bonus contains only unearned weekly partner rewards; earned entries are never taken from another user.  
- Winner count is 15% of eligible regional users.  
- Payouts are sponsor-funded and capped before the competition starts.  
- Stripe is acceptable for identity and payout workflows.  
- Sponsor reporting uses aggregated data and excludes sensitive health, biometric, legal identity, and public profile media details.  
- Sponsor reporting source of truth is GoGymGo's first-party event ledger in AWS, with QuickSight Embedded dashboards for sponsor access.  
- Internal product analytics uses PostHog for MVP, with Amplitude, RudderStack, or Segment added when product analytics needs justify them.  
- V1 includes a managed creator-led sponsored challenge pilot using approved external-platform links or APIs where permitted.  
- V1 includes a monthly regional GoGymGo YouTube workout pilot where local creators submit candidate follow-along videos, guideline-compliant video submissions earn 50 prize draw entries for the creator, GoGymGo selects one featured workout, and the selected creator can earn a sponsor-funded payout under campaign rules.
- V1 does not require owned in-app GoGymGo video upload by creators or users. Creator video submission can be handled as approved external links or controlled file handoff for official GoGymGo YouTube publication/feature after rights and moderation review.  
- GoGymGo manages sponsor relationships for creator-led challenges in V1; creator self-sourced sponsor onboarding and sponsor-protection workflows are later-phase capabilities.  
- Rewards can mix cash, sponsor products, gift cards, sponsor credits, coupons, and other legally reviewed reward types.  
- Creator payout pools are separate from user prize pools and must be funded, capped, and approved before the campaign starts.
- Users are rewarded for verified GoGymGo workouts, not external-platform views, likes, subscribes, comments, shares, watch time, or YouTube ad impressions.  
- GoGymGo sponsor placements near embedded YouTube content are outside the YouTube player and are not sold as YouTube player ad inventory, YouTube watch-time inventory, or YouTube-served ad inventory.  
- YouTube embeds use official player behavior, do not block YouTube ads or controls, default to `autoplay=false`, and use link-out fallback when embed policy or rights are unclear.  
- YouTube content is checked for Made for Kids status where required; Made for Kids content is excluded from personalized sponsor targeting and should be excluded from creator challenges unless legal/privacy review approves otherwise.  
- V2 sponsor marketplace links and promo links are tracked through GoGymGo redirect and attribution services.  
- Prize-pool model assumes 60% of MAU are eligible, 15% of eligible users win, a $10 minimum winner value, a 10% prize reserve, and a 40% sponsor-package allocation to prizes unless legal or sponsor terms change.  
- Signup prize-draw entry is one-time, granted in the signup month, and does not require a completed workout.  
- Sponsor impression model includes app-open impressions plus three workout-verification impressions for each completed workout: check-in, mid-workout verification, and check-out.  
- Sponsor-facing analytics report served impressions, viewable impressions, unique reach, frequency, average viewable seconds, total viewable time, effective CPM, viewable CPM, clicks, CTR, placement mix, creator submissions, selected regional workout, creator referrals, challenge page visits, verified starts, verified finishers, creator payout status, and fraud-filtered exclusions, while excluding YouTube player ads, YouTube watch time, and YouTube-served ad impressions from GoGymGo billable CPM.  
- Prize pools are fixed in the sponsor contract and funded before the competition opens; projected impressions alone do not create a guaranteed prize pool.  
- Partner gyms permit GoGymGo to install approved BLE beacons or display rotating QR codes at entry/exit locations.  
- Gym competition QR verification can replace wearable heart-rate validation only for approved partner-gym QR sessions; it does not replace biometric verification, device integrity checks, minimum duration, fraud controls, or legal eligibility review.  



