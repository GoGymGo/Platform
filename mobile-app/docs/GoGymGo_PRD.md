# GoGymGo Product Requirements Document

## 1. Overview And Objectives

### Vision

GoGymGo is a free mobile app that helps people build consistent physical activity habits by rewarding verified attendance. Users can register one calendar month in advance for a sponsor-funded regional competition, select commitments of 1 to 7 activity days per week, complete 30-minute sessions verified by either heart-rate data or partnered-gym QR entry/exit scans plus biometric checkpoints, earn prize draw entries, enter same-goal regional scoring-period pairings with Make-Up Bonus accountability, join creator-led sponsored challenges including regional GoGymGo YouTube workout-of-the-month features, and compete in regional monthly prize draws. A regional competition requires at least 100 total registered entrants to launch, accepts late registrations only through the conclusion of competition day 6, and may use a sponsor-advised entrant cap disclosed before registration.

### Objectives

- Increase physical activity consistency through commitment, verification, social accountability, and rewards.
- Build a trustworthy verified-session system strong enough to support money payouts.
- Create repeatable regional sponsorship inventory for brands that want measurable wellness engagement.
- Let users discover creator-led workouts from Session, and invite them to apply as a creator after their first verified workout without adding bulk to account onboarding.
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
- Monthly commitment selection rate, scoring-period success rate, and perfect-month completion rate.
- 30-day, 60-day, and 90-day retention.
- Scoring-period pairing participation rate, Make-Up Bonus activation rate, and paired-user completion lift.
- Sponsor campaign renewal rate.
- Onboarding creator-follow selection rate, follow-to-challenge join rate, and referral-preselected creator confirmation rate.
- Creator-led sponsored challenge engagement: creator referral clicks, challenge page visits, signups, verified workout starts, verified finishers, sponsor CTA clicks, reward redemptions, and disclosure/asset approval completion time.
- Signup prize draw entry issuance rate and registration-to-competition conversion rate.
- Public profile setup completion rate, private-mode share, and avatar/photo moderation approval rate.
- Sponsor-funded payout efficiency: winner payouts divided by sponsor revenue.
- Fraud review rate and confirmed fraud rate.
- False rejection rate for legitimate sessions.
- Sponsor served impressions, viewable impressions, average frequency, average viewable seconds, effective CPM, viewable CPM, and click-through rate.
- Gym competition participation rate, gym verification success rate, and verified gym-session completion rate.
- Payout completion time after winner selection.

### Current UI Prototype Alignment

The current Expo React Native implementation is a phone-width mobile experience. React Native Web must constrain the app to a mobile canvas, keep the top status/progress treatment and bottom navigation inside that canvas, and preserve the same content hierarchy across web and native builds.

Current visual system requirements:

- The app is visually designed as a dark, mobile-first, cyber-fitness product: black/navy base, subtle cyan grid background, restrained glow effects, compact panels, and no marketing-style landing-page sections inside the product flow.
- The app-open root screen is the GoGymGo logo welcome page with a clear CREATE ACCOUNT primary CTA in the first viewport. Returning to the root route must show this account-start screen before any dashboard, tab, or workout surface.
- The mobile viewport is the product canvas. The active prototype constrains content to roughly a phone-width shell, uses `100dvh`/safe-area-aware spacing, keeps scroll inside the app frame, and prevents desktop browser width from stretching the UI into a tablet or desktop layout.
- Typography is part of the brand system. Primary headings and body use a compact athletic display style; small labels, counters, step markers, status tags, and bottom-tab labels use a monospaced technical style. Letter spacing is used on small labels and CTAs, not on long paragraphs.
- Long explanations use readable sentence case. Uppercase remains reserved for short HUD labels, statuses, metrics, alerts and button commands so instructional copy does not compete with the interface hierarchy.
- In the Expo implementation, visible screens use the shared Cyber HUD primitives: `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`. The root layout loads `Orbitron-Bold` for display values and `ShareTechMono-Regular` for terminal labels, counters, button text, and tab glyphs before rendering the route stack.
- The Expo implementation centralizes brand styling in `src/constants/theme.ts`. Raw hex/RGBA values and font-size numbers should live in the theme file only; screens and shared components consume semantic tokens such as `colors.surfaceCyanActive`, `colors.surfacePinkSoft`, `colors.textOnPrimary`, `colors.statusError`, `fontSizes.screenTitle`, and the shared `typography` variants.
- The visual hierarchy is: sponsor rail at top, step/status label, screen title, concise explanatory copy, action cards or data cards, then primary/secondary CTAs. Screens should not introduce visible instructional text that explains how the UI is styled or where to click beyond the user-facing product copy.
- Every visible `BACK`, `BACK TO...`, `DONE` or modal `CLOSE` control returns to its actual source screen. Ordinary stack screens use navigation history first and replace with a safe screen-specific fallback when opened directly. Sign Up and Sign In return to the page-two Join screen and do not add a second full-width Back action beneath the form. Cross-tab destinations record their source explicitly because browser and native tab stacks can resolve history differently. Creator Workouts therefore renders `BACK TO HOME`, `BACK TO SESSION` or `BACK TO PROFILE` and routes to that exact source; direct links fall back to Home. Leaving the Active Session screen returns to Home without cancelling the workout; only the explicit red End Session confirmation discards progress.
- Player onboarding is the primary path. The first account screen shows Create Account and Preview App Flow; the next join screen leads with player account creation and returning-player sign-in. Creator, sponsor and partner-gym applications stay collapsed behind `PARTNER WITH GOGYMGO` until requested.
- Scoring is progressively disclosed. Required onboarding explains the weekly goal, verified workouts and the zero-entry consequence for a missed week. Period Match, Top Three Category Finisher, Bonus Day and Perfect Month details stay collapsed until the user asks for them or reaches the relevant competition moment.
- Metric language is fixed app-wide: `VERIFIED DAYS` measures completed eligible workout days, `CATEGORY SCORE` determines rank within a commitment category, and `PRIZE DRAW ENTRIES` determine payout-selection odds. Personal manual workout logs never change any of these competition metrics.
- Before a competition starts, Home, Calendar, Rankings and Prize Draw use one consistent pre-competition state. Verified sessions may build personal calendar history, but Category Score, live rank, active Period Match and competition entries do not appear as active until scoring begins. Personal streak tracking may remain inside Calendar, but Home does not present streaks as a competition metric.
- Home shows the region-wide competition launch threshold as `registered / 100`, the number of additional players needed, or `COMPETITION LAUNCH CONFIRMED` once the threshold is met. When live enrollment data is unavailable, it says the total is syncing rather than inventing a production count. The exact competition start time appears once as the amber start warning; nearby copy explains verification and entry timing without repeating the date.
- The Home pre-competition card explains the wearable verification requirement in direct language: the user checks in and maintains an elevated heart rate for 30 minutes to verify the workout. A separate amber warning line then shows the registered competition month's exact scoring start as `SCORING STARTS [MONTH] 1ST 12:00AM`, such as `SCORING STARTS AUGUST 1ST 12:00AM`.
- Every onboarding screen includes a slim sponsor rail with the sponsor mark and sponsor name. The root welcome screen can use the fuller sponsor treatment with approved campaign attribution. Sponsor rails are light brand reminders, not primary actions, and must not cover content or push important CTAs below reachable mobile areas.
- Primary action buttons use the active cyan treatment for ordinary progression, connection, applications, confirmation and normal session flow. Green confirms verified or completed success, amber identifies time-sensitive verification or caution, and red identifies destructive/end-session confirmation. Pink CTAs are reserved for prize, payout, confirmed sponsor value, reward, multiplier or explicitly special high-value states.
- Secondary actions use transparent or low-contrast dark treatments with readable cyan/blue-gray text. Back, skip, continue-as-player, and learn-more actions must not visually compete with the primary CTA.
- Button copy must follow the prototype wording directly and render full action labels only. Do not prepend shorthand text codes such as `SK`, `PL`, `BK`, `RULE`, `INFO`, `YT`, `HR`, `SRCH`, `PPG`, `BLE`, or similar abbreviations before button labels or user-facing controls. Bottom navigation must use the full tab labels plus a non-text glyph treatment, not letter abbreviations such as `HM`, `LB`, `VS`, or `GR`.
- Cards use compact rounded rectangles with thin cyan, pink, amber, green, red or neutral borders to communicate state. Cyan cards signal selection, safe progress, ordinary information or active states; pink cards signal reward, bonus, prize, confirmed sponsor value or creator payout; amber cards signal pending or time-sensitive verification; green cards signal verified success; red cards signal invalid or destructive states; neutral sponsor cards stay dark with small labels.
- The bottom tab bar appears only on five main app tabs: Home, Calendar, Session, Ranks, and Profile. All active tabs, including Session, use cyan because navigation and routine session starts are normal actions. Period Match remains one tap from its prominent Home card instead of competing for permanent tab space. Onboarding, verification, session checkpoint, checkout, draw, and detail screens do not show the bottom tab bar unless intentionally returned to a main tab.
- Creator Workouts remain reachable from Home, Profile, and creator-workout cards, but are not a bottom-tab item in the first-run layout so the center Session action remains clear.
- Embedded creator workout screens must keep the YouTube/player area visually distinct as a black player block with standard play affordance. GoGymGo sponsor panels, creator selection cards, payout cards, rules, and CTAs must stay outside the player boundary as safe-zone UI.
- Visual audit coverage for the current prototype includes Welcome, Sign Up, Sign In, Public Alias, Creator Application, Permissions, Verification, How Scoring Works, Commitment, Registration Complete, Home, Workout Calendar, Leaderboard, Period Match, Session Start, Workout Verification Method, Creator Workouts, Creator Workout Detail, Profile, Check-in, Identity Start, Active Session, Ping, Ping Success, Checkout, Complete, Gym, and Prize Draw screens.

Implemented UI language and behavior:

- Welcome leads with the GoGymGo logo followed immediately by one compact three-step strip: Show Up, Prove It, and Win. The strip uses the standard cyan/green active treatment so the loop reads as one process. Pink on the root screen is reserved for the center logo word, confirmed sponsor marks, prize-pool, and prize draw/reward accents. Registration-window detail belongs on Commitment. Page one contains only `CREATE ACCOUNT`, which opens page two at `/join` instead of placing every application path on the welcome screen.
- The page-two Join screen is titled `HOW DO YOU WANT TO JOIN?` and separates player access from business/community applications. `FOR PLAYERS` contains `CREATE PLAYER ACCOUNT` and `SIGN IN TO EXISTING ACCOUNT`. `PARTNER WITH GOGYMGO` expands to `APPLY AS A CREATOR`, `APPLY AS A SPONSOR`, and `REGISTER A GYM`. All three rows and application screens use the same cyan navigation and action treatment; pink is reserved for confirmed sponsor value, prizes, payouts, and exceptional bonuses rather than distinguishing ordinary destinations. Privacy and Terms links follow the available actions instead of being pinned across an oversized empty lower viewport.
- Sponsor application is a dedicated public route at `/sponsor/apply`, also reachable from Profile. The frontend collects company name, work email, and target region, validates them locally, and submits them to the configured API. A missing or failed API never produces a success state.
- Gym registration is a dedicated public route at `/gym/register`. A gym manager requests GoGymGo entry and exit QR codes for one physical location by providing gym name, manager name, work email, street address, and city/region. The frontend validates and submits the request to the configured API. A missing or failed API never produces a success state, and submitting never issues or activates a code automatically.
- Account creation requires two native checkbox acknowledgements inside the Sign Up form before account creation is enabled: `I HAVE REVIEWED THE PRIVACY POLICY` and `I AGREE TO THE TERMS, OFFICIAL PRIZE DRAW RULES AND WORKOUT VERIFICATION RULES`. Detailed explanations remain in the linked documents instead of making the checkbox labels dense. Email password fields provide a `SHOW` or `HIDE` control with an accessible label. The page-two Join screen keeps small Privacy and Terms links but does not repeat the acceptance controls. Privacy Policy and Terms open as app-native modal screens using the HUD design system, not web links or browser anchors.
- Firebase Authentication provides email/password account creation, email verification, returning-user sign-in, password reset, persistent sessions, Google continuation, Apple continuation on supported platforms, and real sign-out. Private onboarding, tab, workout, and QR routes require a signed-in, email-verified account.
- After signup, the app should render a day-zero account state: one signup prize draw entry, zero verified workouts, no rank yet, no active match yet, no gym rank yet, and payout verification deferred until the user wins or enters a creator payout flow. Do not show veteran demo values such as large entry counts, active match chats, completed streaks, or verified payout status immediately after onboarding.
- Onboarding uses user-facing "Public identity" language and asks for one required field called Alias. The screen states: `THIS IS SHOWN ON LEADERBOARDS, MATCHES AND COMMUNITY FEATURES. PERSONAL DETAILS ALWAYS STAY PRIVATE.` The same screen offers a compact optional profile-picture picker with a live preview; users may add or change a picture, remove it, or keep an initials avatar. Continuing saves the alias as the user's public name so it persists across app restarts and appears consistently on Home, Profile, Leaderboard, Period Match, and Gym standings. The optional picture also persists across approved public profile surfaces, while personal details and payout verification remain private. The content and Continue action must remain visible together in a normal mobile first viewport without a large empty spacer.
- Core onboarding is a consistent five-step sequence: `STEP 01 / 05` Public Identity, `STEP 02 / 05` Competition Region Verification, `STEP 03 / 05` Permissions, `STEP 04 / 05` Verification, and `STEP 05 / 05` Commitment, followed by the Registration Complete state. Progress values advance as 20%, 40%, 60%, 80%, and 100%. Competition Region Verification is required after Alias. Users cannot freely select a city. The screen requests one-time foreground location only after the user selects `USE MY LOCATION`, resolves the coordinate to an approved regional service area, and stores the verified region label, IANA time zone, verification method, verification status, and verification timestamp without retaining the exact coordinate in frontend persistence. The screen clearly states that GoGymGo does not track location in the background. A Canadian postal-code check is available when device location is denied, unavailable, or temporarily reflects travel; it maps to an approved service area without exposing a manual region list. Because a typed postal code identifies an area but does not prove physical presence, postal results are visibly marked `PROVISIONAL` and require a later device-location or approved partner-gym check before regional competition eligibility is final. Unsupported locations cannot continue into a regional competition and receive a clear not-yet-active state. Region controls local competition dates, sponsor resolution, prize draw, Period Match, and monthly cutoffs. Profile offers `REVERIFY`, not direct region switching. Creator training choice does not appear during onboarding. Creator Details and How Scoring Works are optional supporting screens and must not appear as broken sub-steps. All use the shared compact top back control and progress header instead of full-width Back buttons. Public Identity is content-driven rather than bottom-pinned: the Continue CTA follows the optional profile-picture controls with standard theme spacing so tall phones do not create a large empty band.
- Payout/legal verification is separate from public identity. User-facing copy should say payout verification, not expose legal/KYC terminology except in backend, compliance, or payout operations sections.
- Permissions use one compact "Used for verification" list covering Identity, Workout, and Region. These are explanations, not fake permission toggles. The screen keeps one required biometric/camera consent acknowledgement, states that raw scans and camera frames are not stored, and requests operating-system permissions only when the user first uses the related feature. Sponsor placements are not shown as an onboarding permission row.
- The permissions step includes a required, versioned Biometric / Camera Notice checkbox before the user can continue. Acceptance persists on the device and automatically hydrates later check-in, QR and random-check screens, so users are not forced to reaccept an unchanged notice at every workout step. Users can still withdraw consent by clearing the checkbox. A new legal notice version requires acceptance again. The notice states that local Face ID, device biometric prompts, QR camera views, and temporary camera streams verify presence only; GoGymGo never stores or transmits biometric identifiers, biometric data, imagery, face scans, face geometry, camera frames, or raw camera streams, and stores only a non-biometric checkpoint result where needed for eligibility or fraud review.
- Once the current biometric/camera notice is accepted, later compact verification screens, including checkout, hydrate that same persisted consent state and show `CONSENT ON FILE` with `VIEW NOTICE` and `WITHDRAW CONSENT` controls instead of repeating the full consent card. Missing or outdated consent still shows the complete notice and required acknowledgement. No workout checkpoint may use an unrelated screen-local consent value.
- Creator and sponsor application forms prefill the target region from the user's verified competition region. The applicant can edit the field when the application concerns another approved region; the prefill reduces duplicate data entry and is not treated as backend proof of eligibility.
- Verification uses one compact segmented control with Heart-rate Device and Partner Gym QR. The device path initially shows four common sources and reveals searchable full-device discovery through Find Another Device. The gym path uses a compact searchable partner-gym list. This frontend step persists the exact selected source key and label, such as `GARMIN` or `VOLT PERFORMANCE CLUB`, together with its verification method. It must not claim that hardware has been connected until a real operating-system/device integration succeeds. The device CTA therefore reads `SELECT A DEVICE TO CONTINUE` and then `SAVE DEVICE AS DEFAULT`. The selected state uses the standard cyan active treatment, and the primary continue CTA remains disabled until the user selects a device or gym. No partner gym is selected by default. When a saved default exists, the screen collapses discovery into one compact selected-source card with `CHANGE SOURCE`; opening that action restores the relevant picker. Profile displays the exact saved source, editing verification reopens with that source selected and returns to Profile, and later workout check-in presents the selected method first while both methods remain available. Privacy guidance remains a short supporting line rather than a large card.
- The verification setup step includes a health-data notice for heart-rate sources and phone-camera backup checks. Phone-camera backup copy must state that camera frames stay local and are not stored or transmitted.
- UI color semantics must stay consistent across the prototype. Cyan means primary action, navigation, applications, selection, active progress, creator-workout discovery and ordinary information. Pink is reserved for Prize Draw Entries, money, confirmed sponsor marks, creator payouts, exceptional bonuses and other genuinely high-value reward moments. Green means verified, completed, successful or submitted. Amber means pending, deadline, caution, time-sensitive identity verification or unavailable-until-later. Red means invalid, error, destructive confirmation or the explicit zero-entry consequence of missing a goal. Muted treatments mean unavailable, disabled or secondary. Standard `2x` Period Match success uses cyan; exceptional `3x`, top-three category multipliers, Bonus Day entries and Perfect Month `10x` use pink. Error, checkpoint urgency and zero-entry consequence messages never use pink. Sponsor placements use a neutral/dark outer container with pink limited to confirmed sponsor identity and offer value. Do not introduce off-palette neon colors.
- User-facing scoring terminology uses `SCORING WEEK`, `WEEKLY GOAL`, `WEEK N PROGRESS`, `THIS WEEK`, and `FOUR SCORING WEEKS`; generic UI labels must not call a scoring week a period. `Period Match` is the proper name of the weekly matched-player feature, `Matched Player` refers to the person, and `Period Match Bonus` refers to the resulting `2x` or `3x`. Days 29-31 are always called `Bonus Days 29-31`, not remainder days. The user-facing currency is always `Prize Draw Entries`; `final draw weight` remains an internal backend/calculation term only. First place is the `Category Champion`; first, second and third are the `Top Three Category Finishers`. Player-facing surfaces say `Monthly Competition`, while `Regional Campaign` remains sponsor-facing language. Backend/domain types may retain period and remainder identifiers where they make settlement boundaries explicit.
- Functional theme categories are required: primary/brand, secondary/accent, backgrounds/surfaces, typography/text, and status/feedback. New screens should not add local color constants or hardcoded `fontSize` values unless the token is first added to the centralized theme with a clear purpose.
- Typography uses Orbitron for major page titles, primary actions, and compact feature or step-card headings such as `COMMIT`, `VERIFY`, and `BUILD ODDS`; Share Tech Mono is reserved for short HUD labels, step markers, metadata, statuses, timers, tab labels, and live telemetry; Rajdhani Medium/SemiBold is used app-wide for body copy, calculations, form inputs, legal text, helper copy, and explanatory notes. Full sentences must not use the mono `micro` role solely to save space. Compact explanations use the Rajdhani `caption` role, while `micro` remains reserved for brief technical readouts. The shared body variant and semantic page-level body styles must consume Rajdhani rather than overriding it with Share Tech Mono. Existing centralized size tokens and color roles remain unchanged. Structural scoring headings use cyan and a slightly larger label scale; pink remains reserved for actual bonus values rather than section headings.
- The heart-rate device list shows four common sources by default and exposes the searchable full catalogue through Find Another Device.
- The partnered-gym QR path carries through the full session: select gym, choose Partner Gym QR from the workout-verification method screen, scan entry QR, complete Face ID presence check, see QR-specific active-session labels, scan exit QR, and show the selected gym as the profile verification source.
- The Session tab is a highly condensed two-action screen: `FOLLOW ALONG WITH A CREATOR` or `START MY OWN WORKOUT`. One sentence explains that both paths continue to the same verification check-in, and the content sits in the upper portion of the viewport instead of floating inside a large empty center. Following a creator opens the regional Creator Workouts list. Starting either workout reaches a separate verification-method screen offering Heart-rate Device or Partner Gym QR, so the workout choice stays simple without removing either approved verification path. While a persisted workout is active, Home changes its CTA to `RETURN TO ACTIVE SESSION` and Session replaces both start choices with `RESUME ACTIVE SESSION`, preventing a second workout from being started accidentally.
- Session start, automatic random face check, identity-check, QR scanner, and checkout screens use Face ID/biometric/camera language as a local presence check, not as a stored identity scan. Scan CTAs remain disabled until the current version of the Biometric / Camera Consent acknowledgement is available from persisted consent or accepted on that screen. These workout-step reminders should be compact; the full legal explanation belongs in onboarding and the legal modal.
- The active session screen must prevent checkout before the 30-minute minimum. The original start time, verification source, heart-rate accumulator and checkpoint state persist locally and restore after app refresh, backgrounding or relaunch until the session is completed or explicitly ended. The header says `SESSION TRACKING`, never `RECORDING`. Heart-rate sessions separate `CURRENT BPM` with `ABOVE TARGET` or `BELOW TARGET` feedback from the duration-weighted `30-MIN AVG` and configured minimum; concise status rows explain effort, automatic face-check state and session auto-save state without exposing diagnostic telemetry copy. Their finish CTA remains locked until 30:00, the automatically triggered mid-session face check, full-session heart-rate coverage, and the minimum average BPM have all passed. Approved partner-gym QR sessions instead show clear `ENTRY QR` and `EXIT QR` checkpoint cards, use alternate gym-presence evidence, and do not require a heart-rate stream. Direct navigation to the face check, checkout, or completion cannot bypass these guards or award entries. If no session exists, Checkout says `START A SESSION`, not `RETURN TO ACTIVE SESSION`.
- Every routed scroll screen uses the shared React Native `ScreenScrollView`, which resets to the top whenever the screen receives focus. Bottom-tab screens reserve enough safe-area padding to avoid nav overlap. Shared buttons, onboarding controls and bottom-tab items use the cyan focus outline so keyboard focus follows the same primary-navigation color language as touch interaction.
- How Scoring Works is a standalone optional reference from Profile; Verification continues directly to Commitment. Commitment puts the 1-7 `WEEKLY GOAL` selector immediately beneath the title and provides `CONFIRM WEEKLY GOAL` directly below the selector as well as at the bottom of the page. The same goal repeats for four scoring weeks, only one verified workout per calendar day counts, and each scoring week assigns one new same-goal Period Match. The registration panel and a shortened three-step explanation follow the selector. A pink dynamic prompt shows maximum bonus potential, and the combined interactive scoring explanation remains collapsed until `SEE HOW SCORING WORKS` is selected. Once open, it places the explanatory copy from the standalone reference directly beside the relevant interactive controls: four separate Period Match Result controls labeled `MISS`, `GOAL HIT`, `BOTH HIT`, and `3X BONUS`; Top Three Category Finisher choices labeled `1ST // 3X`, `2ND // 2X`, and `3RD // 1.5X`; only the Bonus Days that exist in the month; and the final Perfect Month `10x`. Cyan identifies calculator structure and ordinary `1x` or `2x` selections, red identifies a selected missed result, muted identifies `NONE`, off or unavailable states, and pink appears only on selected exceptional `3x`, top-three, Bonus Day and Perfect Month rewards plus the final projected result. The live `PROJECTED PRIZE DRAW ENTRIES` total appears once inside the expanded calculator and updates while the user changes inputs; it must not be duplicated in a sticky footer or cover calculator content. The arithmetic ledger remains available behind `VIEW CALCULATION` and is collapsed by default.
- The How Scoring Works reference displays arithmetic in the same settlement order as the domain model: Period Match subtotal, top-three category-finish multiplier, eligible Bonus Day entries, then Perfect Month `10x` as the final multiplier. The category section states the three rules concisely: first place is `3x`, second place is `2x`, and third place is `1.5x` the four-week Period Match subtotal. One clear four-day example shows `4 x 4 = 16`, Period Match `2x = 32`, first place `3x = 96`, and final Perfect Month `10x = 960 Prize Draw Entries`, explicitly noting that no Bonus Days are included.
- Commitment Rules uses sentence-case accordion rows. Only the selected rule body is expanded, while every rule title and number remains scannable; the first rule opens by default. The modal does not present eleven simultaneous uppercase paragraphs.
- Because How Scoring Works is an optional reference rather than a required onboarding step, it does not display an onboarding progress bar. Its header and bottom action are source-aware: Commitment returns to Commitment, Profile returns to Profile, and direct access uses navigation history. The scoring headings use `01 // PERIOD MATCH BONUSES`, `02 // TOP THREE CATEGORY FINISHERS`, `03 // BONUS DAYS 29-31`, and `04 // PERFECT MONTH // FINAL 10X`.
- Commitment shows a compact registration strip beginning with `NEXT REGIONAL COMPETITION`, the competition date range, and cyan `REGISTRATION OPEN`, followed by the region-wide 100-player launch minimum, configured sponsor cap or uncapped state, and `LATE REGISTRATION CLOSES AT 11:59 PM ON DAY 6`. Selecting a goal persists both the registration date and exact target competition month, so Entry Confirmed, Home, Period Match, scoring, and reminders cannot drift into a different month. Entry Confirmed repeats the weekly goal, scoring start, and `FREE PRIZE DRAW ENTRY`; it includes a back control and `CHANGE WEEKLY GOAL` while scoring has not started. Once scoring begins, the goal-lock explanation replaces the change action and Prize Draw Status confirms that scoring is active rather than continuing to say the region still needs players to launch. Advance registration is the complete calendar month before competition month. During competition days 1-6, a late entrant joins the active month and the only available goal equals the days remaining in scoring week 1: day 1 locks to 7, day 2 locks to 6, day 3 locks to 5, day 4 locks to 4, day 5 locks to 3, and day 6 locks to 2. Registration on day 7 or later targets the next competition month.
- Trainer cards use a Verified badge, not a checkmark that could be confused with selected state.
- Session ending requires an explicit confirmation, and random-ping completion shows a checkpoint-confirmed success state before returning to the active timer.
- Completion copy distinguishes personal pre-competition history, verified competition credit and settled Prize Draw Entries. A verified workout before scoring opens checks off the Workout Calendar and may update the personal streak, but it never adds competition credit. Days 1-28 count toward the active scoring week and settle only when that week closes; each verified workout on an available Bonus Day 29-31 adds Prize Draw Entries equal to the user's selected weekly goal. Verified-success treatments are green, awarded entry values are pink, and ordinary progress plus personal-streak status remain cyan. Completion also updates Calendar, weekly progress, and Period Match status when the relevant competition phase is active.
- The Workout Calendar is a main tab that automatically syncs to started and completed workout sessions. Starting a heart-rate or partner-gym QR session arms the current competition-region date, and verified checkout checks off that day, updates current-week progress and updates the leaderboard when entries settle. Validated verified and manual workout logs persist locally across app refreshes and restarts until backend sync replaces local storage, so Completion, Home, Calendar, Period Match and leaderboard calculations all consume the same durable log history. Home shows Prize Draw Entries, the user's current verified-day progress and the matched player's verified-day progress before the full sponsor video placement, so competition progress remains visible earlier in the screen. It does not show a streak metric. Before a Period Match is assigned, the matched-player metric displays `MATCH PENDING` rather than a fabricated score. Calendar may retain streaks strictly as personal workout-history feedback. When the registered Prize Draw competition begins in a future month, Home and Calendar label verified activity `PRE-COMP VERIFIED` and explain that verified sessions build personal Calendar history only. Home must show the exact competition start date, must not label pre-competition activity as an active scoring week, and must not imply that a Period Match or multiplier is active before day 1.
- The Workout Calendar supports manual gym logs for today or a past selected date, including an optional workout name, duration in minutes, and optional exercises, sets or notes. The form repeats the selected date, uses visible field labels and examples, and places `SAVE PERSONAL LOG` after all fields. Future workout dates cannot be logged. Manual logs check off the personal Calendar only; they do not verify a workout or affect the weekly goal, competition progress, pairings, leaderboards, multipliers, or prize draw entries.
- The selected 1-7 frequency persists locally, automatically carries into the next month unless changed before the cutoff, and remains the active goal across Entry Confirmation, Home, Calendar, Period Match, and verified-session completion.
- Reward cards must include units beside numeric values. For example, a period result card should say "12 PRIZE DRAW ENTRIES" rather than showing a bare "12".
- The `REGIONAL RANKINGS` screen opens by explaining that Category Score determines rank while Prize Draw Entries determine draw odds. Before scoring starts, `YOUR STANDING` says rankings open after Scoring Week 1 and does not show a misleading zero score or rank. After Week 1 settles, Category Score updates cumulatively after every scoring week and includes each settled week's `1X`, `2X`, or `3X` Period Match result. One compact standing panel otherwise shows the user's Weekly Goal category, `PENDING` before settlement or `SYNCING` while a live rank is unavailable, and Category Score without repeating streak or Prize Draw Entry metrics from Home. A single 1-7 segmented control defaults to the user's hydrated Weekly Goal. Selecting a category updates one mobile-readable Top 10 list only when authoritative leaderboard data is available. Detailed weekly-update and tie-break copy stays collapsed behind `HOW RANKING WORKS`.
- The Winners Circle is a dedicated previous-month results page available from Regional Ranks. On the first day of each month in the selected competition-region timezone, it appears once after a returning user successfully signs in only when audited, settled results are available. Dismissing it stores that account's current login month so it does not interrupt the same account again that day or month. New users still complete onboarding first. If settlement data is unavailable, the screen shows `RESULTS NOT AVAILABLE YET` and never renders fixture aliases or payouts. A two-tab control separates `CATEGORY CHAMPIONS` from `PRIZE DRAW WINNERS` so the page never presents both long lists at once.
- The Prize Draw screen uses one consistent `REGIONAL PRIZE DRAW` heading and leads with `YOUR PRIZE DRAW STATUS`: Free Entry, Competition Entries and Total Entries. It does not display a fabricated probability or progress bar when total field entries are unknown. Before competition starts, the screen confirms that the Free Entry is active and names the competition start date. `HOW ENTRIES GROW` progressively reveals Period Match, Top Three Category Finisher and Perfect Month bonuses. A confirmed campaign leads with the pool, exact `15% OF PLAYERS GET PAID` wording, projected winner count, projected top and minimum payouts using the pink prize treatment. The projection panel states the eligible-player count used to calculate those figures so winner and payout numbers do not appear arbitrary. An unconfirmed campaign uses a quiet cyan GoGymGo state, hides unknown dollar amounts, and states that prize details are published before competition. Detailed payout ranks remain collapsed behind `HOW PAYOUTS WORK` only for confirmed campaigns.
- Pairing copy explains four outcomes plainly: user misses, user earns 0; both hit the goal, both earn 2x; match misses and successful user stops at the goal, successful user earns 1x; match misses and successful user completes one extra verified day, successful user earns 3x. A seven-day user receives 3x automatically when successful and their match misses because no eighth day exists in a seven-day period.
- Creator challenge cards show practical details: duration, workout format, reward type, and time remaining.
- Creator Workout surfaces use direct `Creator Workout` or `Creator Workouts` naming, with GoGymGo YouTube as the channel context. Home shows at most one neutral/cyan featured-workout preview sourced from the current creator-workout data and uses that card as the single route into discovery, avoiding a duplicate creator-workouts CTA. The discovery page leads with the workout choices and places the creator-program payout panel afterward so participant action is primary. Its concise explanation says to start a verified GoGymGo session and then play the video; video views alone never earn entries. Available workouts show `PLAY`; disabled submission or future slots show `LOCKED`. Stale relative dates are not hardcoded. The detail screen places the same verification instruction immediately above `START VERIFIED SESSION`. Internal implementation language such as `MVP`, server challenges, OS prompt names, signed checkpoint events or phone beacons is not user-facing. Confirmed creator payouts use pink; unconfirmed payouts use a quiet cyan regional-campaign state.
- Onboarding does not ask users to choose solo or creator-led training. Unless the user has already applied or dismissed the prompt, completing the first verified workout opens the Creator Application page with submission requirements and sponsor-funded payout language. The short validated form requires region, creator channel/profile URL, workout style, and sample workout URL. The application CTA appears first, followed by a highlighted `DON'T SHOW THIS AGAIN` button for the first-workout prompt. A creator is marked Submitted only after the complete form passes validation and the API accepts it. Creator submissions do not award prize draw entries.
- Creator-led workout discovery begins from `FOLLOW ALONG WITH A CREATOR` on Session and opens the regional Creator Workouts list. `START MY OWN WORKOUT` bypasses creator discovery and proceeds directly to verification-method selection.
- Creator challenge detail pages keep external video players separate from GoGymGo-owned sponsor safe-zone surfaces.
- Sponsor inventory is shown as explicit sponsor areas in the prototype: a slim mark-and-name rail during onboarding, plus contextual app-open, creator signup, creator workout discovery, creator workout detail safe-zone, check-in, and check-out placements. Full sponsor areas can include sponsor label, logo, offer/payout attribution, and approved creative only after the regional campaign is confirmed. Draft or unfilled inventory renders as one compact neutral cyan GoGymGo campaign row and must not push the primary workout, goal or leaderboard content below the first viewport. Pink is reserved for confirmed sponsor value, payout and prize moments.
- Profile uses the same Alias-only public identity model as onboarding. It displays the current alias once in the profile header and provides one adjacent `EDIT ALIAS` action that returns to Profile after saving; a second duplicate Alias card is not shown. Optional picture controls live directly beneath the avatar. Account details remain separate from Competition Region. Profile settings are grouped into `COMPETITION`, collapsed `PARTNER WITH GOGYMGO`, and `LEGAL + PRIVACY`. Creator, sponsor and gym-registration tools are hidden until the partnership group is opened. Profile is a bottom-tab root and does not include a redundant Back-to-Home button.
- The Workout Calendar uses a visible legend for Verified Days, Personal Logs, Bonus Days and Open Days. Its manual-entry action is called `PERSONAL WORKOUT LOG` and explicitly states that personal logs do not change Verified Days, Category Score or Prize Draw Entries.
- Partner-gym UI uses plain-language QR instructions: scan once on arrival and again on exit, with both scans required for verification. It does not expose implementation terms such as signed events, time-bound payloads or phone beacons. The gym page shows community participation and the user's verified gym sessions, not a second competing leaderboard or unlabeled score system.
- Before a competition starts, Period Match shows the exact first eligible scoring-week date once. It must not add a duplicate status card or relative copy such as `OPENS NEXT WEEK`. During an active week, the heading is `WEEK N PERIOD MATCH` with `YOUR WEEKLY OPPONENT` as context. It leads with the user's remaining verified workouts, the scoring-week deadline, matched-player progress and whether 2x remains available, then shows daily verified status for both players. The Make-Up Bonus explanation stays in concise sentence case, and no second status card repeats the matchup. After week four, the screen switches to Bonus Day guidance.
- Server-backed opponents, category standings, creator workouts, completed results, payout winners, and session telemetry are accessed through explicit data or provider boundaries. A build with no connected backend returns honest empty or unavailable states. Runtime screens must never import mock fixtures or display fabricated values as live user, competition, health, or payout data.
- The React Native app includes centralized legal content in `src/constants/legal.ts` and reusable legal UI in `src/components/legal.tsx`. New legal, privacy, biometric, consent, or rights copy must be updated there first, then consumed by page components.
- Local web and device development are supported through Expo; generated development output is never committed or treated as a production delivery mechanism.

### Current Expo Router Implementation Snapshot

The active React Native implementation lives in `C:\Users\wilso\Documents\GoGymGo Frontend\mobile-app` and is an Expo Router app using `expo-router/entry`, React Native `StyleSheet.create`, shared HUD primitives, centralized theme tokens, and bundled brand fonts.

Current implementation folders:

- `app/`: Expo Router file-based screens, grouped into onboarding, modals, main tabs, and workout session flows.
- `src/components/`: reusable Cyber HUD, authentication, legal, profile, session, and sponsor UI components.
- `src/constants/`: centralized theme tokens and legal/privacy/biometric copy.
- `src/state/`: typed authentication, profile, sponsor campaign, workout progress, and onboarding-preference providers.
- `src/services/auth/`: Firebase initialization plus platform-specific Google and Apple credential exchange.
- `assets/fonts/`: `Orbitron-Bold` and `ShareTechMono-Regular`.
- `docs/`: PRD, executive summary, migration audit log, theme audit, and compliance audit.

Current route map:

- Root and authentication: `/`, `/join`, `/sign-up`, `/sign-in`, `/verify-email`, `/forgot-password`.
- Public applications: `/creator/apply`, `/sponsor/apply`, `/gym/register`.
- Protected onboarding: `/welcome`, `/identity`, `/consents`, `/verification`, `/how-it-works`, `/commitment`, `/entry-confirmed`. Creator application is public at `/creator/apply`; legacy `/creator`, `/creator/invite`, and `/creator/guidelines` routes remain compatibility redirects or aliases but are removed from the development screen gallery.
- Modal/legal/rules surfaces: `/privacy-policy`, `/terms-of-service`, `/biometric-camera-consent`, `/bonus-rules`, `/commitment-rules`, `/qr-scanner`, `/sponsor-offer`.
- Main app tabs, nested tabs, and monthly results: `/home`, `/calendar`, `/session`, `/leaderboard`, `/leaderboard/draw`, `/winners-circle`, `/squad`, `/squad/gym`, `/workouts`, `/workouts/[workoutId]`, `/profile`.
- Workout session flow: `/workout/check-in`, `/workout/identity-check`, `/workout/active`, `/workout/ping`, `/workout/ping-success`, `/workout/check-out`, `/workout/complete`.

Current implementation requirements:

- The app must remain React Native clean: no HTML tags, no DOM/browser-only APIs in screens, no `any` type escape hatches, and no raw colors or font sizing outside the centralized theme.
- Every user-facing page should keep full wording rather than shorthand button codes, and use `entries` and `prize draw` consistently instead of mixing points, draw, and entries language.
- The Commitment page must explain the contest in three compact steps, show `NEXT REGIONAL COMPETITION`, the date range, cyan `REGISTRATION OPEN`, the 100-player regional launch minimum, configured cap or uncapped state, and the explicit day-6 cutoff time. During days 1-6, the amber late-registration notice locks the weekly goal to the days remaining through day 7 and disables every other goal. The selector is labeled as a weekly goal/monthly commitment and has a confirmation CTA immediately beneath it plus the same confirmation CTA at the page bottom. The collapsed projection shows the four-week base, the dynamic maximum, one short explanation and `SEE HOW SCORING WORKS`. The expanded combined scoring calculator has four independent Period Match Result rows, `TOP THREE CATEGORY FINISHERS`, month-aware `BONUS DAYS 29-31`, and Perfect Month `10x`, with the applicable scoring explanation attached to each control. A 28-day month offers `0`, a 29-day month `0-1`, a 30-day month `0-2`, and a 31-day month `0-3`. Each Bonus Day contributes Prize Draw Entries equal to the selected weekly goal and is included in the final Perfect Month `10x`. One live `PROJECTED PRIZE DRAW ENTRIES` result appears within the calculator, while the full arithmetic remains collapsed behind `VIEW CALCULATION`. All four-digit totals use thousands separators.
- The four Top Three Category Finisher choices remain equal-width mobile segments, and each complete label (`NONE`, `1ST // 3X`, `2ND // 2X`, `3RD // 1.5X`) must fit on one centered line without wrapping or overlapping.
- In the compact Commitment overview, the missed-week consequence appears exactly once as red `0 ENTRIES`; the surrounding muted sentence must not repeat the value.
- The verification and session paths must preserve both supported methods: heart-rate device and partner-gym QR entry/exit, with biometric/camera consent kept as a local presence check. Onboarding saves the selected method as the default, Profile displays it, and the workout verification screen presents it first while allowing either method to be selected.
- Creator application remains optional, can be dismissed after the first verified workout, and stays reachable from Welcome and Profile. It is a real validated four-field application rather than a duplicate guidelines screen. Creator submissions do not award prize draw entries; selected creators can receive sponsor-funded payouts.
- Sponsor placements are implemented as GoGymGo-owned safe-zone UI: app-open/signup, top sponsor rail, creator workout surfaces, workout detail, leaderboard, completion, and sponsor-offer modal. Unconfirmed inventory is always a compact passive amber row; full creative appears only for approved campaigns. Permission, identity and workout-checkpoint screens use only compact passive sponsor attribution; urgent face-check and destructive-confirmation surfaces never contain interactive advertisements.
- Firebase project values are supplied through ignored environment files. Native Google sign-in is enabled by the Expo config plugin only when both Firebase platform files are present. The frontend exposes a Firebase ID-token method for the future API; the backend must verify tokens and never trust a client user ID by itself.
- Local development can enable `EXPO_PUBLIC_ENABLE_ONBOARDING_PREVIEW=true` to expose Preview App Flow, bypass authentication and continue through region onboarding with clearly labelled demo-region data while reviewing frontend routes. Unsupported postal codes also resolve to the active demo region in this mode so frontend review is never blocked by unavailable production service-area data. These bypasses are additionally guarded by React Native `__DEV__`, are unavailable in production builds, and must never replace Firebase authorization or location eligibility checks in release builds or backend APIs.

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

1. User installs or opens GoGymGo and first sees the GoGymGo logo welcome page with only CREATE ACCOUNT.
2. CREATE ACCOUNT opens `HOW DO YOU WANT TO JOIN?`; a player chooses CREATE PLAYER ACCOUNT while a returning player chooses SIGN IN TO EXISTING ACCOUNT. Creator, sponsor, and gym-manager applications remain clearly separated below.
3. A new player opens Sign Up and reviews and accepts the current Privacy Policy and Terms before account creation is enabled.
4. User creates an account using email/password, Apple continuation, or Google continuation. Existing users can sign in or request a password-reset email.
5. Email/password users verify their address before private onboarding or competition routes unlock. Firebase restores valid sessions between launches and real sign-out clears the active session.
6. User enters one required public Alias, which is shown on leaderboards, matches, and community features while personal details remain private.
7. User can optionally add a profile picture during Public Identity setup or keep the initials avatar. The picture can be changed or removed later from Profile.
8. User reviews one compact verification-use list and accepts the required biometric/camera presence-check notice. Health, camera, location, and notification operating-system prompts occur just in time when the related feature is first used. Sponsor placements remain GoGymGo-owned UI inventory rather than a user-facing permission.
9. User chooses a default workout verification path: preferred heart-rate source or partnered gym QR verification where available. A device is described as connected only after a real integration succeeds.
10. If using a connected heart-rate source, user connects HealthKit on iOS, Health Connect on Android, Apple Watch, Wear OS, or Bluetooth LE heart-rate device.
11. If using partnered gym QR verification, user selects an approved partner gym and reviews the entry QR start and exit QR finish workflow.
12. User continues directly to Commitment. The Commitment page combines its scoring explanation and interactive calculator under `SEE HOW SCORING WORKS`; the standalone reference remains available from Profile.
13. User reviews the compact registration strip and selects a weekly goal of 1 to 7 verified workout days; that goal becomes the commitment for four scoring weeks, and only one verified workout per calendar day counts.
14. The user clicks through four independent Period Match results, category finish, Bonus Days 29-31, and Perfect Month controls in one calculator. The projected Prize Draw Entries update immediately, with Bonus Days included before Perfect Month `10x` is applied last.
15. User registers for the next available monthly competition and sees weekly goal, scoring start, and one secured Free Prize Draw Entry. The entry is included without requiring a completed workout and carries forward if the regional competition does not launch.
### Journey: Setting The Monthly Commitment

1. User opens the commitment screen during the full calendar-month registration window before competition month.
2. User selects 1 to 7 activity days per week for the whole month.
3. App summarizes four scoring weeks, Period Match `1x/2x/3x` outcomes, Bonus Day entries, the final Perfect Month `10x`, and the projected sponsor-funded prize draw, with detailed rules available on request.
4. Existing users may change the upcoming goal until 11:59:59 PM on the final day of the registration month in the locked competition-region timezone. Otherwise the previous commitment carries forward automatically.
5. Early commitments lock when the advance registration window closes. A late registrant can join a launched competition only through the conclusion of day 6, locks the reduced commitment when submitted, and starts scoring on the registration date.
6. The competition launches only if at least 100 eligible entrants are registered at cutoff. If the minimum is missed, scoring, pairings, and the prize draw do not begin; users are notified and their saved commitment remains available for the next eligible campaign.
7. A sponsor may advise an entrant cap for its region/month campaign. If no cap is configured, registration is uncapped. Late entrants remain 10x eligible by hitting their reduced goal in the partial first week and the same goal in scoring weeks 2-4.
8. The four scoring periods are days 1-7, 8-14, 15-21, and 22-28. The same selected goal applies to each period.
9. Period entries settle after the period closes. Meeting the user's goal is required; failing a period awards zero for that period.
10. The top three finishers in each commitment category receive configurable final-total multipliers. Current defaults are `3x` for the Category Champion, `2x` for second, and `1.5x` for third.
11. If every weekly goal is completed, the complete sum of all settled Period Match results, category-finish bonus and Bonus Day entries is multiplied by 10. User-facing calculation order shows Perfect Month `10x` last. The values remain mathematically consistent with the authoritative internal final-draw-weight calculation.
12. In months longer than 28 days, one verified workout on each available Bonus Day 29, 30, and 31 adds Prize Draw Entries equal to the user's weekly goal after the category multiplier and before Perfect Month. For example, a seven-day user completing two Bonus Days earns `2 x 7 = 14` entries, contributing `140` after Perfect Month `10x`.

### Journey: Completing A Verified Session

1. User starts a session by either completing local biometric authentication from the app or scanning an approved partner gym entry QR that launches the QR session flow.
2. App begins collecting the selected verification evidence: heart-rate data for wearable sessions, or signed partner gym entry presence for QR sessions, plus device integrity signals.
3. App randomly schedules one automatic mid-session face-check prompt between minutes 10 and 20 and opens it without requiring the user to press a checkpoint button.
4. User completes the automatic face check within its non-resetting two-minute grace period.
5. For partner gym QR sessions, the app asks for Face ID after the entry QR so the QR proves place and Face ID confirms the user.
6. User completes the end biometric check after 30 minutes. For partner gym QR sessions, user also scans the approved exit QR before leaving the gym.
7. Backend validates biometric attestations, HR elevation or partner gym QR entry/exit evidence, session timing, device signals, and fraud score.
8. If valid, the session checks off the competition-region day and updates scoring-week progress. Weekly Category Score remains pending until settlement; a valid session on an available Bonus Day immediately adds the selected weekly-goal value to the multiplier-eligible month subtotal.

### Journey: Scoring-Period Pairing And Make-Up Bonus

1. At the start of each scoring period, the service randomly pairs users with the same selected goal in the same competition region.
2. Matching remains open for 24 hours. If the local pool has no compatible opponent, the service searches a nearby region with the same timezone and goal; if no compatible user exists, the user receives a solo period worth standard 1x on success.
3. The app shows the match's allowed public identity and both players' verified checkmarks for each day. Exact workout time, location, heart-rate information, and private notes are never shown.
4. If both users hit the period goal, each receives selected goal x 2 entries when the period settles.
5. If one user misses, that user receives zero. A successful match who stops at their own goal receives selected goal x 1.
6. After reaching their own goal, a user may complete one optional extra verified workout before the period closes. If the match ultimately misses, the successful user receives selected goal x 3. If the match succeeds, both users receive 2x.
7. A successful seven-day user receives 3x automatically if their match misses.
8. Partner chat expires or archives after the scoring-period pairing window.
### Journey: Viewing Leaderboards

1. User opens the leaderboard tab.
2. App distinguishes Category Score from Prize Draw Entries and shows the user's category, current or unsettled rank, and Category Score in one compact standing panel.
3. A single 1-7 segmented control defaults to the user's Weekly Goal and switches the viewed category.
4. User selects any category to view that category's ten highest-ranked players in one mobile-readable Top 10 list.
5. Category standings use verified competition entries only; signup entries and other non-competition entries do not count.
6. The first three rows display the configured `3x`, `2x`, and `1.5x` Prize Draw Entry boosts; detailed tie-break rules stay collapsed behind `HOW RANKING WORKS`.
7. Home and Prize Draw retain total-entry and payout information so Rankings remains focused on category position.
8. User can open the Winners Circle to review the previous month's seven category champions and named cash payout winners.

### Journey: Winning A Prize Draw

1. After the last calendar day of the month closes in the competition-region timezone, the backend settles the regional draw.
2. The draw selects `max(1, floor(verified eligible users x 15%))` unique winners without replacement.
3. Selection probability is weighted by each eligible user's internal final draw weight. The user-facing equivalent is the final Prize Draw Entry total: Period Match subtotal multiplied by any top-three category-finish multiplier, plus eligible Bonus Day entries, then multiplied by earned Perfect Month `10x`. The Free Prize Draw Entry is added afterward without multiplication.
4. The one signup entry becomes active immediately when an eligible new account registers and remains in the applicable monthly prize draw even if that user completes no workout.
5. Selection order becomes payout rank. The first selected winner receives the largest payout, each later selected winner receives a smaller or equal payout, and the final selected winner receives the minimum payout under the published curve.
6. The default payout curve uses `raw payout weight = 1 / payout rank^0.5`. The exponent is campaign configuration locked before the month opens; lower values flatten payouts and higher values make them more top-heavy.
7. Winners receive notification and complete Hyperwallet Pay Portal onboarding if required. Operations reviews flagged winners before the backend authorizes a Hyperwallet payment.

### Journey: Seeing Sponsor Ads

1. User opens the app for any reason.
2. App displays the active sponsor placement at app open and during completed workout verification moments.
3. Impression and viewability events are logged with campaign, region, gym if applicable, user, timestamp, placement type, creative version, viewport/screen state, visible duration, click/dismiss action, and fraud-filter eligibility.
4. User can dismiss according to frequency and UX rules.
5. Sponsor reporting aggregates exposure by served impression, viewable impression, unique reach, frequency, average viewable seconds, CPM, and viewable CPM.

### Journey: V1 Creator-Led Sponsored Challenge
1. GoGymGo and a brand sponsor approve a regional creator-led challenge, including the region, creator submission window, selected workout criteria, sponsor-funded user reward mix, sponsor-funded creator payout pool, official rules, sponsor creative, promo copy, paid-promotion disclosure language, and reporting goals.
2. Local creators submit follow-along workout videos or approved external links for the regional workout-of-the-month slot. Submissions include rights attestation, required disclosures, workout format, duration, safety notes, and sponsor-copy approvals. Submitting a creator video does not award prize draw entries.
3. GoGymGo selects the strongest regional workout, features or publishes it through the official GoGymGo YouTube channel or playlist where permitted, and keeps sponsor placements in GoGymGo-owned safe zones outside the YouTube player.
4. A user opens the GoGymGo YouTube challenge page inside the app and sees the selected creator, sponsor, user rewards, creator payout pool, rules, workout format, privacy choices, and verification requirements.
5. The user joins the challenge, receives the standard secured Free Prize Draw Entry if eligible, and completes verified workouts through GoGymGo using check-in, mid-workout verification, heart-rate/session validation or partnered-gym QR validation, and check-out. Verified workouts can earn additional Prize Draw Entries but do not change the free entry.
6. Sponsor creative appears at app open, challenge discovery, challenge detail safe zones, and workout verification flow surfaces. The challenge can also include approved sponsor CTA or promo links inside GoGymGo.
7. GoGymGo attributes creator referrals, signups, verified starts, verified finishers, sponsor impressions, CTA clicks, reward redemptions, selected-creator payout status, and prize/reward efficiency.
8. Rewards can include cash, sponsor product, gift cards, sponsor credits, coupons, or a legally reviewed mix. Users are rewarded for verified GoGymGo workouts, not for external-platform views, likes, subscribes, comments, or watch time.

### Journey: V2 Sponsor Marketplace And Promo Links
1. Sponsor signs a campaign agreement that includes monthly sponsorship, approved creative, offer copy, marketplace links, promo terms, attribution requirements, and brand-safety rules.
2. GoGymGo creates sponsor surfaces: app-open ad, workout verification placements, sponsor profile page, offer page, product/marketplace links, promo links, and redemption tracking.
3. User opens GoGymGo and sees the regional/monthly sponsor creative.
4. During a workout, user sees sponsor creative at check-in and verified completion, subject to one impression per placement per workout.
5. User can optionally tap into sponsor marketplace or promo-link surfaces without purchase being required for prize participation.
6. Dashboard reports impressions, view duration, clicks, promo engagement, conversion events where available, workout starts, verified finishers, and prize pool efficiency.

### Journey: Registering A Partner Gym

1. A gym manager opens CREATE ACCOUNT, reaches the page-two Join screen, and selects REGISTER A GYM.
2. The manager submits one physical location with gym name, manager name, work email, street address, and city/region.
3. The frontend validates every required field and records the request; it does not create an approved gym or active QR code.
4. GoGymGo operations verifies the manager, location, checkpoint placement, participation terms, and region availability.
5. After approval, GoGymGo creates the partner-gym record and issues separate signed entry and exit QR checkpoints for that location.
6. The manager receives placement and activation instructions. Only activated checkpoint codes can start or finish a partner-gym session.

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
**User story:** As a user, I want a secure account and recovery flow so my competition history and eligibility cannot be reached through a navigation shortcut.

Acceptance criteria:

- Firebase Authentication supports email/password creation and sign-in, Google sign-in, Apple sign-in where supported, email verification, password reset, persisted sessions, and sign-out.
- The app never stores, logs, or sends a plaintext password outside Firebase Authentication.
- Email/password accounts must verify their email before entering protected onboarding, tabs, workout sessions, or QR scanning.
- Protected routes redirect unsigned users to Sign In and unverified email users to Email Verification.
- Profile shows the authenticated email, provider type, and email-verification status separately from public identity controls.
- Saving Public Identity persists the required Alias. The same alias and derived initials are used across Home, Profile, Leaderboard, Period Match, Gym standings, and other user-owned public surfaces without hardcoded demo-name fallbacks after setup.
- Sign-out calls Firebase and any active native social provider before returning to the root account page.
- Firebase project identifiers are environment configuration, and native Google platform files remain outside source control.
- The client can obtain a short-lived Firebase ID token for future API calls. The future backend verifies that token with Firebase Admin and derives the user ID from the verified token.
- The current frontend stores a provisional local legal-acceptance receipt after account creation. The production backend must record policy versions and acceptance time authoritatively.

**User story:** As a new user, I want a free prize draw entry at signup so I can participate immediately and understand the value of completing registration.

Acceptance criteria:

- A new eligible account receives one active registration prize draw entry immediately after signup for the applicable monthly prize draw.
- The signup entry has one unit of draw weight immediately. It does not depend on a completed workout and keeps the user eligible for the applicable draw when they otherwise satisfy account, region, age, jurisdiction, registration, integrity, and official-rules requirements.
- The registration entry is one-time and non-recurring.
- The registration entry does not award additional entries, commitment progress, gym leaderboard rank, or verified-session credit.
- Registration entries are subject to official rules, jurisdiction eligibility, account integrity checks, and anti-fraud controls.
- Manual calendar logs never add competition entries because they are personal tracking records, not verified competition workouts.

**User story:** As a user, I want to control how my identity appears publicly so that I can participate privately, with an alias, or with my real name.

Acceptance criteria:

- Profile settings include a visible public identity toggle with three modes: Private, Alias, and Real Name.
- Private mode hides the user's real name on public surfaces and uses a generated display label unless the user chooses an alias for non-real-name display.
- Alias mode displays a user-provided alias that must pass moderation, impersonation, and profanity checks.
- Real Name mode displays the user's chosen real-name display value on public surfaces.
- Users can upload, crop, replace, or delete an optional avatar or personal photo.
- If no image is uploaded, the app uses a generated default avatar that does not reveal identity.
- Profile visibility applies to leaderboards, gym competitions, period matches, messaging, winner announcements, and user-facing competition views.
- Payout/legal identity remains separate from public profile identity and is never shown publicly just because a user chooses Real Name mode.
- Uploaded avatars and personal photos are scanned or reviewed for abuse, impersonation, explicit content, and rights issues before broad public display.

**User story:** As a user, I want to verify that I am the person completing the session so that rewards are fair.

Acceptance criteria:

- App supports Apple LocalAuthentication for Face ID/Touch ID and Android BiometricPrompt for biometric authentication.
- Biometric authentication occurs at start, one automatically triggered random mid-session face check, and end.
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
- Session validation requires heart-rate observations to cover the complete 30-minute session. Missing coverage fails the heart-rate path instead of silently averaging only the available samples.
- The active screen continuously shows current BPM, the duration-weighted 30-minute average, and the required target.
- HR readings with impossible values, flatline patterns, repeated synthetic patterns, or incompatible device metadata are flagged.
- Users can see why a session failed HR validation in plain language.
- Users without a supported HR source can complete prize-eligible workout sessions at approved partner gyms if they use valid entry and exit QR checkpoints.

Prototype elevated HR rule:

- The configurable frontend prototype target is a duration-weighted average of at least `100 BPM` across the complete 1,800-second session. The calculation is `sum(BPM x observed seconds) / 1,800` and cannot pass with less than 1,800 seconds of heart-rate coverage.
- `100 BPM` is a prototype product setting, not a clinical prescription or a claim that one fixed heart rate is safe or appropriate for every person. Production must complete medical, accessibility, legal, age, medication, disability, and false-rejection review before launch and should support a medically reviewed personalized intensity target or an approved non-heart-rate alternative.
- CDC and American Heart Association guidance defines exercise intensity relative to the individual rather than as one universal BPM. Product policy must therefore keep the target configurable and clearly explain the approved partner-gym QR alternative.
- A partnered gym QR session passes the non-wearable verification path only if entry QR, exit QR, biometric checkpoints, minimum session duration, device integrity, and fraud checks all pass.
- Users with medical constraints require clinical and legal policy review; the prototype must not imply that users should override medical advice to reach the displayed target.

### 3.3 Session Lifecycle And Random Ping Scheduler

**User story:** As a user, I want a clear 30-minute session flow so that I know exactly what is required.

Acceptance criteria:

- User can start a session only after selecting a valid activity mode and completing either start biometric authentication or an approved partner gym entry QR scan that launches the start verification flow.
- Partner gym QR sessions follow this visible order: entry QR scan, Face ID presence check, active timer with QR-specific status, random ping, and exit QR checkout.
- Sponsor creative is displayed during check-in and verified completion, subject to one impression per placement per workout; impressions are logged separately from biometric results.
- Session duration is 30 minutes minimum.
- Check-out and final verification cannot be started before the 30-minute minimum is reached; the mobile UI must show a locked or unavailable finish CTA until the requirement is met.
- The random mid-session face check is scheduled after the start checkpoint and opens automatically at an unpredictable time between minutes 10 and 20. The user-facing active-session UI says only that the check occurs randomly during the session and never discloses the timing window or chosen checkpoint time.
- Direct navigation cannot open or complete the face check before it is triggered. Once triggered, the user has a two-minute grace period that persists across navigation and cannot be reset by leaving the screen.
- Face-check success shows a checkpoint-confirmed state before returning to the active session.
- If the user chooses to end a session early, the UI asks for confirmation and explains that progress from that workout will not count.
- App uses local notifications and an automatic in-app route prompt for the random face check.
- Backend receives session start, checkpoint, HR summary or partner gym QR presence summary, device integrity, and session end events.
- Session validation is idempotent and produces one final status: valid, invalid, pending review, or failed technical validation.

Hard part:

- iOS may not reliably allow arbitrary background biometric prompts while the app is backgrounded or the device is locked. MVP should require the app to remain foregrounded or use persistent activity UX with notification fallback, and this limitation must be disclosed in-product.

### 3.4 Commitment Engine

**User story:** As a user, I want to set one monthly commitment and make good on it across four clear scoring periods so that the reward system is simple, predictable, and motivating.

Acceptance criteria:

- User must pre-select a whole-month commitment of 1 to 7 activity days per week.
- Registration opens at 12:00:00 AM on day 1 of the calendar month before competition month and closes at 11:59:59 PM on that registration month's final day, using the competition-region timezone.
- A registered entrant has an eligible account, verified region, locked 1-to-7 commitment, accepted competition rules, and either an advance or late-registration timestamp. A provisional postal match may continue onboarding but must be upgraded through device-location or approved partner-gym evidence before competition eligibility is final. A verified workout is not required to register.
- At least 100 total registered entrants across the region are required for a regional competition to launch.
- A campaign can set an optional sponsor-advised maximum entrant count. If it is null, the field is uncapped. A configured cap must be at least 100 and registration closes when it is reached.
- Late registration opens when a qualified competition begins and ends at 11:59:59 PM in the competition-region timezone on day 6. A sponsor cap can close it earlier.
- A late entrant starts scoring on the registration date inside scoring week 1. The only selectable goal equals the number of competition days remaining in that first week, including registration day: day 1 locks to 7, day 2 locks to 6, day 3 locks to 5, day 4 locks to 4, day 5 locks to 3, and day 6 locks to 2. The first period uses the same automatic `3x` exception as a seven-day user when the match misses because no extra day exists.
- A late entrant's random same-goal Period Match and match chat open on registration. Verified workouts before registration do not count. Registration attempts beginning on day 7 target the next competition month instead of entering the active competition.
- The selected frequency applies to all four scoring periods: days 1-7, 8-14, 15-21, and 22-28.
- The monthly commitment is the only commitment model; the same selected weekly frequency applies to all four fixed scoring periods.
- User succeeds in a period by completing at least the selected number of valid sessions on separate competition-region calendar days.
- Period multipliers are determined by the user's result and matched opponent's result: 0x for a miss, 1x for a solo success or a success without an activated partner bonus, 2x when both succeed, and 3x when the opponent misses and the successful user completes the extra workout.
- A seven-day success receives 3x automatically when the opponent misses.
- An advance entrant must meet the personal goal in all four periods to multiply every settled period result, including 2x and 3x results, by 10.
- A late entrant remains 10x eligible by meeting the reduced selected goal from the registration date through day 7 and meeting that same goal in scoring weeks 2-4.
- If the user misses any eligible period, the 10x reward is not earned, but other successful periods keep their settled results.
- Existing commitments automatically carry forward. Changes for the next month lock at 11:59:59 PM on the final day of the prior registration month in the competition-region timezone.
- After goal selection and notification permission, the native app schedules commitment-progress reminders during days 1-28 and separate weekly-goal-value entry reminders on available days 29-31. Reminder schedules refresh when verified progress changes. Profile provides a real `COMPETITION REMINDERS` toggle showing enabled/off state; enabling requests device permission, disabling cancels GoGymGo's scheduled competition reminders, and denied permission returns clear recovery copy.
- New users after the advance-registration cutoff may late-register into an active competition that launched with at least 100 regional entrants only through day 6. They start on their registration date with the goal locked to days left in scoring week 1.
- If fewer than 100 eligible regional entrants remain at the day-1 cutoff after withdrawals or eligibility checks, the competition status becomes `cancelled`; no period pairings, competition entries, category winner multipliers, or prize draw are created for that region/month, and users must register for the next month.
- Available days 29-31 are universal Bonus Days. Each day can award the user's selected weekly-goal value for one verified workout. Bonus Day entries are added after the category multiplier and are included in final Perfect Month `10x`.
- Backend stores competition month, advance-registration open/close timestamps, minimum entrants, initial entrant count, launch status, late-registration timestamp, first eligible scoring period, timezone, target frequency, cutoff timestamp, locked status, period success statuses, period multiplier statuses, perfect-month eligibility/result, bonus-day entries, and final competition entry total.

### 3.5 Entries, Tiers, Period Pairing, And Make-Up Bonus

**User story:** As a user, I want entries to reflect my commitment follow-through in each scoring period so that rewards favor people who make good on the commitment they selected.

Acceptance criteria:

- Each valid session is recorded immediately as period credit, but period entries remain pending until settlement.
- A user must complete at least the selected number of valid sessions in the period to earn any entries for that period.
- If a user misses the period goal, that user's sessions remain in history but award zero entries for that period.
- A settled successful period awards selected goal x 1, x 2, or x 3 according to pairing outcome.
- A 10x commitment result multiplies the complete sum of all four settled period results by 10. A late entrant can earn it by completing the reduced first-week goal from the registration date and the same goal in weeks 2-4. This includes results already calculated at 2x or 3x.
- Signup entries remain separate from workout-earned entries and commitment progress.
- Tiers group users by participation level, historical activity, and region size to improve period-pairing fairness.
- Pairing occurs once per scoring period among eligible users in the same goal category and competition region.
- After a 24-hour local search, matching may expand to a nearby same-timezone region. If no compatible match exists, the period becomes solo and can earn 1x.
- If both partners meet the goal, both earn 2x.
- If one partner misses, that user earns zero. The successful user earns 1x unless the optional extra workout activates 3x.
- One extra verified session beyond the claiming user's target activates 3x only if the opponent ultimately misses.
- Seven-day users do not need an eighth workout; success automatically activates 3x if their opponent misses. The same exception applies in a late entrant's first period when the selected goal uses every calendar day remaining through day 7.
- No user loses earned entries. Multipliers are calculated independently from verified outcomes.
- Users with active blocks, safety reports, or fraud holds are excluded from period pairing.

Recommended MVP scoring:

- Valid session: one verified day of period credit, not an immediate fixed entry award.
- Period miss: zero entries.
- Solo or unmatched success: selected goal x 1.
- Both matched players succeed: selected goal x 2 for each.
- Match misses and successful player completes the extra verified workout: selected goal x 3 for the successful player; failed player receives zero.
- Seven-day success plus opponent miss: selected goal x 3 automatically.
- 10x result: sum all four settled period results, then multiply the full total by 10. Late entrants must complete their reduced first-week goal and the same goal in weeks 2-4.
- Bonus Days 29-31: selected weekly-goal value per verified day, added before the Perfect Month calculation.
- Prize Draw Entries: the user-facing quantity that determines weighted random prize draw odds according to official rules. Final draw weight is the matching backend term.

Example:

- Jordan and Maya both select four sessions. Jordan completes two and receives zero for the period.
- Maya completes four and keeps the standard four entries if she stops there.
- If Maya completes a fifth verified workout before the period closes and Jordan still misses, Maya receives 12 entries for the period.
- If both complete four, each receives eight entries for the period. If both repeat that result in all four periods, each has 32 settled entries and receives 320 after the perfect-month 10x multiplier.
- A four-session user who succeeds in only three solo periods receives 12 entries and no 10x.
- In a 31-day month, verified workouts on days 29, 30, and 31 can add three times the selected weekly-goal value to the month subtotal before the final perfect-month multiplier.
### 3.6 Period Match Messaging
**User story:** As a matched player, I want to send short encouragement or competitive messages so that my Period Match feels active without becoming a full social network.

Acceptance criteria:

- Matched users can message each other during the scoring-period pairing window.
- Chat headers and message identity use each user's selected public profile mode, alias/name, and approved avatar/default avatar.
- Messages support text only in MVP.
- Messaging uses Firestore real-time updates.
- Users can block, report, and mute a period match.
- Reported messages are retained for moderation review according to retention policy.
- Expired match chats become read-only or hidden after the scoring period.
### 3.7 Regional Leaderboards

**User story:** As a user, I want to see how I rank in my region so that competition feels visible.

Acceptance criteria:

- Leaderboards show regional entry totals for the active monthly competition.
- App shows top users, current user rank, tier, entries, and public profile display according to each user's selected identity mode.
- Each region has seven goal-category standings, one for each selected goal from 1 through 7 sessions per scoring period.
- Goal-category standings use the cumulative Category Score from all scoring weeks settled so far, including each week's `1X`, `2X`, or `3X` Period Match result. The score and rankings begin updating after Week 1 closes and refresh after every later week. Perfect Month `10X`, the Free Prize Draw Entry, Bonus Day entries and podium multipliers do not determine category placement.
- Signup entries improve prize draw odds immediately and never affect category rank.
- At month end, the eligible Top Three Category Finishers receive configured multipliers on their actual settled four-week Category Score after all 1x/2x/3x Period Match results.
- Default category winner multipliers are `3x` for first, `2x` for second, and `1.5x` for third. Multipliers are campaign configuration and can be changed for a future competition before that month opens.
- Category winner multipliers change prize draw weight only. They do not add banked ledger entries, change category scores, guarantee selection, or create separate category payouts.
- A category tie resolves in this disclosed order: most verified competition days, then an audited equal-chance random tie-break. Personal streaks never affect competition rank.
- Fraud holds and competition eligibility are resolved before the category top three are finalized and their winner multipliers are applied.
- Leaderboards update near real time after session validation.
- Redis sorted sets maintain fast ranking; PostgreSQL stores the authoritative entry ledger.
- Users under review remain visible only if policy allows; confirmed fraudulent entries are removed.

### 3.7.1 Monthly Winners Circle

**User story:** As a returning player, I want one clear monthly results announcement so that I can recognize category champions and see who actually received prize draw payouts.

Acceptance criteria:

- The page reports the most recently completed competition month for the user's region.
- It lists the first-place champion from each of the seven commitment categories with public Alias, goal category, and settled category entries.
- It separately lists actual prize draw payout winners with public Alias, payout rank, and cash amount. The initial mobile view shows the ten highest payout ranks and states the complete number of paid players.
- The distinction between a category champion and a paid prize draw winner is explicit. Category placement improves draw weight but does not itself guarantee or create a cash payout.
- On competition-region day 1, an eligible returning user's successful login routes to Winners Circle only when that account has not yet seen the announcement for the current login month.
- Closing the automatic announcement persists the current login month against that account and continues to Home. A manual visit from Regional Ranks returns to Regional Ranks.
- New-account signup and first-time onboarding take priority over the automatic Winners Circle announcement.
- Winner records shown publicly respect Alias/profile visibility rules and suppress users under unresolved fraud or payout review when policy requires it.

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

- Draw settles after the last calendar day of every month closes in the competition-region timezone.
- Winners equal `max(1, floor(verified eligible users x 15%))` when at least one eligible user exists.
- Winner selection is weighted by internal final draw weight. The Period Match subtotal is multiplied by the user's top-three category-finish multiplier, or `1x` outside the top three; Bonus Day entries are added next; and the complete result is multiplied by `10x` when Perfect Month is earned. The Free Prize Draw Entry is added afterward without multiplication.
- A user can win at most once per regional monthly prize draw unless legal and sponsor rules allow otherwise.
- Winners are selected without replacement. Their selection order becomes payout rank, with the first selected winner receiving the largest payout and the final selected winner receiving the smallest payout.
- The default payout curve is a deliberately flatter poker-style ladder using `raw payout weight(rank) = 1 / rank^0.5`. The payout exponent is adjustable only in a future campaign configuration published before that month begins.
- Each ranked payout is its normalized share of the complete regional draw pool. Calculations settle in integer cents; after flooring each result, residual cents go in order to the earliest payout ranks so the ladder remains non-increasing and the complete pool balances exactly.
- Category winner multipliers affect weighted selection odds only. Once a user is selected, payout amount is determined exclusively by selection order and the published payout curve.
- Draw inputs and random seed source are logged for audit.
- Use a cryptographically secure random number generator from the backend runtime and store a prize draw audit record.
- Winners flagged by fraud scoring enter pending review before payout.
- Hyperwallet Pay Portal collects identity, tax, and transfer-method details when required.
- The GoGymGo backend authorizes Hyperwallet payments only after winner and operations approval.

Worked example using the default 10,000-verified-user campaign:

- Sponsor contribution is `10,000 x $3.00 = $30,000`.
- The regional prize draw pool is `10,000 x $2.00 = $20,000`.
- Winner count is `floor(10,000 x 15%) = 1,500` unique users.
- Under the default `0.5` exponent, projected payouts include `$263.12` for draw rank 1, `$67.94` for draw rank 15, `$21.49` for draw rank 150, and `$6.79` for draw rank 1,500. Every selected winner is paid and the complete `$20,000` pool balances to the cent.
- A user's chance at each weighted selection step is their final draw weight divided by the remaining final draw weight, adjusted after each winner is removed. More active entries and a category winner multiplier improve odds but never guarantee selection.

### 3.10 Sponsorship And App-Open Ads

**User story:** As a sponsor, I want my campaign to appear when users open the app so that I reach verified active users in a region.

Acceptance criteria:

- Each region can have a different sponsor during the same month, but only one exclusive primary sponsor can be active for a region/month campaign in MVP.
- If a campaign is missing, incomplete, expired, or not approved, the app shows a neutral GoGymGo fallback and never carries an expired sponsor into the next month.
- Sponsor branding is placement-specific and remains inside designated GoGymGo-owned surfaces; the fixed GoGymGo cyan/pink visual system does not change to match the sponsor.
- App-open creative is frequency-capped to once per day. Check-in and completion creative can appear once per verified workout. Leaderboard and creator surfaces use embedded sponsor placements with campaign-configured caps.
- Campaign creative includes brand name, placement-specific image/video assets, approved default fallback creative, CTA URL, start/end timestamps, region, disclosure text, and frequency rules.
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
- Sponsor creative and CTAs can be shown at app open, check-in, verified completion, leaderboard, creator discovery, creator detail, and approved in-app offer surfaces that are GoGymGo-owned.
- Each challenge page must reserve sponsor logo/ad safe zones in GoGymGo-owned UI, including header, below-player card, challenge detail panels, verification flow, and reward surfaces where applicable.
- If a YouTube player is embedded, GoGymGo sponsor units must stay outside the player boundary and cannot be sold as placements on or within the YouTube player or YouTube audiovisual content unless YouTube provides prior written approval.
- GoGymGo must not overlay, skin, cover, block, replace, or interfere with YouTube player controls, links, metadata, YouTube-served ads, or playback context signals.
- GoGymGo must not require users to view, click, dismiss, or complete a sponsor action before watching an embedded YouTube video; app-controlled pre-roll, mid-roll, post-roll, interstitial gates, and clickable sponsor layers tied to the YouTube player are out of scope.
- Sponsor reporting includes creator submission count, selected workout, creator referral clicks, challenge page visits, signups, starts, verified finishers, GoGymGo sponsor impressions, view duration for GoGymGo placements, CTA clicks, promo-link clicks, reward redemptions, creator payout status, and prize/reward efficiency.

**User story:** As an approved creator, I want to lead a sponsored GoGymGo challenge from YouTube or another external platform so my audience can complete verified workouts and compete for rewards.

Acceptance criteria:

- Creator profile supports display name, alias/real-name preference, avatar/profile photo, verified channels, platform URLs, bio, region, moderation status, and approval status.
- Signup contains no creator-training choice or creator-application prompt. Creator application remains explicitly available from Profile, and creator-led workout discovery begins from Session after onboarding.
- After a user's first verified workout, the app opens Creator Details unless that user has already submitted creator interest or dismissed the prompt. Manual calendar logs never trigger it.
- The post-workout Creator Details page shows Apply as a Creator first and a highlighted "Don't show this again" action beneath it. Dismissal persists on that device and prevents future automatic prompts, while Creator Details remains available from Profile or another explicit entry point.
- The combined Creator Details screen explains submission basics, rights/disclosure review, safety review, region fit, selection criteria, and the sponsor-funded payout opportunity before the user continues.
- Profile includes a user-facing Creator status row. Before application it shows Not Applied with a path to apply; after application it shows Submitted and keeps the Creator Details path available.
- Creators can submit candidate regional workouts for GoGymGo review with video URL or file-handoff reference, title, workout type, duration, intensity, equipment requirements, safety notes, usage rights attestation, disclosure language, and sponsor-copy approval status. Submissions do not award prize draw entries and remain subject to anti-spam, duplicate-submission, rights, and eligibility checks.
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
- User receives the standard secured Free Prize Draw Entry immediately when eligible; verified workouts are not a condition of that entry.
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
- Firebase owns password and token lifecycle. The current cross-platform frontend uses Firebase's supported React Native persistence adapter backed by app-scoped AsyncStorage; plaintext passwords are never stored by GoGymGo. Before production release, security review must approve this storage boundary or replace native persistence with a Keychain/Keystore-backed implementation.
- Every backend request that requires identity uses a current Firebase ID token over TLS. The backend verifies signature, issuer, audience, expiration, revocation policy, and required claims before deriving the user ID.
- Use signed device attestations and replay-resistant session event IDs.
- Restrict administrative tools with SSO, role-based access control, and audit logs.

### Privacy

- Collect the minimum health, biometric result, location, and device data needed to validate sessions and operate competitions.
- Never store raw biometric templates.
- Provide consent, data export, and deletion workflows.
- Separate sensitive health data from sponsor reporting.
- Use aggregated sponsor reporting unless legal review approves otherwise.
- Public community identity uses one user-controlled Alias across leaderboards, matches, creator surfaces, and community features.
- Payout/legal identity, email, health data, biometric results, and payout details are never exposed through public profile settings.
- Avatar and personal photo uploads are optional, replaceable, deletable, stored separately from core account records, and subject to moderation.
- Private mode must be respected on leaderboards, gym competitions, period pairings, messaging, and winner announcements unless official rules or applicable law require a different disclosure.

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
| Mobile app | React Native + TypeScript + Expo Router | One typed iOS/Android codebase, file-based routing, Expo development tooling, and native module support through Expo development builds | Separate Swift and Kotlin apps, rejected for duplicated UI, navigation, and product logic |
| Native capability layer | Expo modules plus narrowly scoped React Native native modules/config plugins | Keeps the product code shared while allowing HealthKit, Health Connect, biometrics, BLE, camera, notifications, integrity, and background-task integrations | Expo Go-only development, rejected because production verification features require custom native capabilities |
| Authentication | Firebase Authentication with Firebase JS SDK, Expo Apple Authentication, and native Nitro Google Sign-In | Provides email verification, password recovery, federated identity, persistent sessions, and Firebase ID tokens that a future API can verify | Prototype navigation-only account buttons, rejected because they provide no identity or session security |
| Backend API | TypeScript + NestJS on Cloud Run | Structured services, strong ecosystem, scalable managed containers | Go services, rejected for slower product iteration |
| Database | Cloud SQL PostgreSQL + PostGIS | Relational integrity, auditability, region queries | Firestore-only, rejected for financial/audit workflows |
| Cache/leaderboards | Memorystore Redis | Sorted sets are ideal for ranking and fast reads | PostgreSQL-only ranking, rejected for scale/latency |
| Async jobs | Pub/Sub + Cloud Tasks + Cloud Scheduler | Reliable eventing, retries, scheduled regional jobs | Cron on app servers, rejected for reliability |
| Chat | Firestore | Managed real-time sync and moderation-friendly storage | Custom WebSockets, rejected for MVP complexity |
| Profile media | Cloud Storage + signed upload URLs + moderation status in PostgreSQL | Stores optional avatars/photos outside relational rows with auditable moderation | Database BLOBs, rejected for cost and performance |
| Creator-led challenge and external platform integration | Creator/challenge service + creator submission workflow + regional workout selection records + external platform link/API metadata + official GoGymGo YouTube surface references + YouTube embed safe-zone policy + sponsor CTA attribution + disclosure and asset approval records | Enables V1 creator-led sponsored challenges and monthly regional creator payouts without requiring owned in-app GoGymGo video upload or sponsor ads inside embedded players | Owned in-app video upload and in-player ad products, deferred until moderation, creator rights, and platform approval workflows justify the complexity |
| Push | Firebase Cloud Messaging + APNs | Cross-platform notification delivery | OneSignal, rejected to reduce third-party dependency |
| Payments/KYC | Hyperwallet Pay Portal + REST API + webhooks | Provider-hosted identity, tax, and bank setup keeps sensitive payout data outside GoGymGo | Custom bank forms or a second bank-linking SDK, rejected for liability and duplicated onboarding |
| Sponsor analytics/reporting | PostgreSQL event ledger for MVP; Cloud Storage + BigQuery + Looker when volume requires it | Auditable CPM, viewability, reach, frequency, and campaign reporting without an early second-cloud stack | Product-analytics-only reporting, rejected because sponsor billing needs a first-party event ledger |
| Product analytics | PostHog for MVP, fed by normalized client and server events | Funnels, retention, cohorts, experiments, and a simple path to later warehouse export | Multiple analytics routers and warehouses at MVP, rejected as premature operational overhead |
| Observability | Cloud Logging, Cloud Monitoring, Sentry | Backend/mobile error visibility | Datadog, rejected for MVP cost |

### Required APIs And SDKs

- Expo LocalAuthentication or an approved React Native wrapper for Face ID/Touch ID and Android BiometricPrompt.
- Firebase Authentication JS SDK for email/password, verification, recovery, session observation, web social sign-in, and ID-token access.
- Expo Apple Authentication with nonce-based Firebase credential exchange on iOS.
- React Native Nitro Google Sign-In with Firebase platform files, OAuth client configuration, and an Expo development build for Android/iOS.
- Apple HealthKit and HKWorkoutSession for iOS health and workout data.
- Google Health Connect for Android health records.
- Wear OS Health Services for active wearable HR where available.
- Bluetooth LE Heart Rate Service for open chest straps and compatible devices.
- React Native native modules/config plugins for Apple DeviceCheck/App Attest and Google Play Integrity.
- Expo Notifications backed by Firebase Cloud Messaging and APNs for push notifications.
- Cloud Storage signed upload URLs for optional avatar and personal photo uploads.
- Creator-led challenge APIs, creator submission and regional selection workflow, external platform link validation, official GoGymGo YouTube channel/playlist references, official YouTube embed/IFrame player integration, YouTube Data API or equivalent platform API where permitted, Made for Kids status checks where required, sponsor safe-zone enforcement, sponsor CTA redirect/attribution service, disclosure records, sponsor asset approvals, creator payout tracking, and reward fulfillment reporting.
- V2 owned video upload, media processing, thumbnail generation, content moderation, and takedown tooling for creator/user workout videos only after V1 creator-led challenges are validated.
- V2 sponsor marketplace, promo-code, product-link, and deeper attribution services.
- Expo Location for one-time foreground device coordinates, plus a backend service-area resolver using PostGIS polygons or equivalent versioned geographic boundaries. Google Maps Geocoding or Mapbox Geocoding can support postal/address confirmation; the client must not make the final eligibility assignment. The current client-side metro and postal mapping is transitional UI logic only and must be replaced with server-authoritative region policy and verification status before production eligibility can be enabled.
- Hyperwallet Pay Portal, server-side REST API calls, and idempotent webhooks for winner onboarding and payouts.
- SendGrid for transactional email.
- Twilio Verify only if phone verification becomes required for fraud control.
- An approved React Native BLE module backed by CoreBluetooth on iOS and Android Bluetooth LE APIs for heart-rate devices and approved beacon detection.
- Expo Camera barcode scanning or an approved React Native camera module backed by AVFoundation on iOS and CameraX/ML Kit on Android for QR entry/exit verification.
- Partner gym admin tooling for manager/location request review, approval or rejection, partner-gym creation, QR checkpoint issuance and rotation, gym competition configuration, and hardware health monitoring.
- A PostgreSQL first-party exposure ledger for MVP sponsor and product event ingestion, with an outbox for reliable export.
- Cloud Storage, BigQuery, and sponsor-specific Looker reporting only when campaign volume outgrows operational reporting.
- PostHog SDK for MVP product analytics; Amplitude SDK can be added later for deeper behavioral analytics.
- A server-owned event schema and transactional outbox so analytics destinations can change without coupling the app to one vendor.

### Analytics And Sponsor Reporting Stack

GoGymGo uses two analytics views with different trust boundaries and one first-party event contract.

Sponsor-facing reporting stack:

- Source of truth: first-party ad exposure ledger, not PostHog, Amplitude, or GA4 screenshots.
- MVP ingestion and storage: the API validates client events and writes a first-party PostgreSQL exposure ledger using a transactional outbox.
- Scale storage: Cloud Storage keeps partitioned immutable exports by date, region, campaign, sponsor, gym, and placement.
- Warehouse/query: BigQuery serves campaign reporting and audit/backfill queries when scale justifies it.
- Sponsor dashboard: sponsor-specific Looker reporting or a purpose-built portal reads approved aggregate views.
- Core sponsor measures: served impressions, viewable impressions, unique reach, average frequency, average viewable seconds, total viewable time, clicks, CTR, effective CPM, viewable CPM, placement mix, fraud-filtered impressions, and workout-verification exposure.

Internal product analytics stack:

- MVP: PostHog for funnels, retention, cohorts, feature flags, experiments, surveys, and session replay where consented.
- Scale option: Amplitude for deeper product analytics and executive reporting once usage and product-team needs justify it.
- Event routing: the server-owned event schema and outbox send normalized events to PostHog and later BigQuery without coupling the app to one analytics vendor.
- Product measures: onboarding conversion, commitment creation, verified-session funnel, biometric failure stages, HR-validation failure reasons, period-pairing completion, Make-Up Bonus behavior, gym verification, retention, notification response, and payout onboarding.

### Architecture Diagram

```mermaid
flowchart TD
    A[React Native Expo App - iOS And Android] --\> B[API Gateway / Cloud Run]
    A --\> D[HealthKit / Apple Watch]
    A --\> E[Health Connect / Wear OS]
    A --\> F[BLE Heart Rate Devices]
    A --\> S[Gym Beacon / QR Checkpoint]
    S --\> B
    B --\> G[PostgreSQL + PostGIS]
    B --\> H[Redis Leaderboards]
    B --\> I[Pub/Sub Event Bus]
    I --\> J[Session Validation Workers]
    I --\> K[Fraud Scoring Workers]
    I --\> L[Prize Draw And Payout Workers]
    B --\> M[Firestore Pair Chat]
    B --\> N[Cloud Tasks / Scheduler]
    L --\> O[Hyperwallet Pay Portal + API]
    B --\> P[Sponsor Campaign Service]
    B --\> Q[PostgreSQL Event Ledger + Outbox]
    Q --\> Q1[Cloud Storage Export]
    Q1 --\> Q2[BigQuery]
    Q2 --\> Q3[Looker Sponsor Reporting]
    Q --\> Q4[PostHog Product Analytics]
    B --\> R[FCM / APNs Push]
```

### Data Model Sketch

Primary entities:

- `User`: id, auth provider, email hash, public profile mode, alias/display name, real-name display value, avatar media id, date of birth band, verified region id, region verification status, region verification method, region verified timestamp, region effective month, timezone, account status, created timestamp. Exact onboarding coordinates are processed for assignment but are not retained on the user record.
- `ProfileMedia`: id, user id, media type, storage object hash/path, moderation status, active flag, created timestamp, deleted timestamp.
- `Device`: id, user id, platform, attestation status, integrity score, last seen timestamp.
- `HealthConnection`: id, user id, source type, permission status, device metadata, last sync timestamp.
- `VerificationPreference`: id, user id, verification path, health connection id, partner gym id, QR eligibility status, active flag, updated timestamp.
- `CompetitionEnrollment`: id, sponsor campaign id, region id, competition month, user id, commitment id, registered timestamp, advance-or-late type, first eligible scoring period/date, perfect-month eligibility, eligibility status, reservation status, cancellation timestamp, source, created/updated timestamps.
- `CompetitionField`: id, sponsor campaign id, region id, competition month, advance-registration open/close timestamps, region-wide minimum entrants, optional sponsor-advised maximum entrants, initial entrant count, current entrant count, launch status, launch decision timestamp, late-registration status, cancellation reason, created/updated timestamps.
- `Commitment`: id, user id, competition month, target frequency, timezone, registration cutoff timestamp, locked status, perfect-month eligibility/status, final entry total.
- `Session`: id, user id, commitment id, region id, start/end timestamps, status, validation result, fraud score.
- `BiometricCheckpoint`: id, session id, checkpoint type, timestamp, platform result, signed payload hash.
- `HeartRateSampleSummary`: id, session id, source, sample count, elevated minutes, max gap, anomaly flags.
- `ScoringPeriodResult`: id, commitment id, period index, period start/end, user verified-day count, opponent verified-day count, match status, multiplier, settled entries, settled timestamp.
- `EntryLedger`: id, user id, session id, commitment id, scoring period result id, reason, multiplier, entries, status, source, created timestamp.
- `DrawEntryLedger`: id, user id, commitment id, scoring period result id, entries, reason, status.
- `PeriodPairing`: id, region id, gym id, tier id, goal category, user A, user B, period start/end, status, search-expanded timestamp.
- `Message`: id, period pairing id, sender id, body, moderation status, created timestamp.
- `MakeUpBonusStatus`: id, period pairing id, successful user id, missed user id, extra verified day completed, activated multiplier, status, expires at.
- `LeaderboardSnapshot`: id, region id, period id, user id, rank, entries.
- `WinnerAnnouncement`: id, region id, completed competition month, category champion snapshot ids, draw id, published timestamp, status.
- `WinnerAnnouncementView`: id, winner announcement id, user id, login month, first viewed timestamp, dismissed timestamp.
- `SponsorCampaign`: id, sponsor id, region id, month, exclusive-primary flag, verified-user rate, region-wide minimum entrants, optional sponsor-advised maximum entrants, prize-draw rate, creator-payout rate, GoGymGo rate, first/second/third category podium multipliers, draw-winner percentage, draw-payout exponent, payout-curve version, creative defaults, CTA, start/end timestamps, approval state, status.
- `SponsorAdSlot`: id, sponsor campaign id, slot type, screen/surface, placement label, sponsor-area treatment type, creative asset id, CTA/link id, disclosure text, active dates, frequency cap, viewability rules, status.
- `AdExposureEvent`: id, sponsor campaign id, user id, region id, gym id, placement, creative version, event type, served timestamp, viewable start/end timestamp, visible milliseconds, click/dismiss action, fraud-filter status.
- `ProductAnalyticsEvent`: id, user id, anonymous device id, session id, event name, properties JSON, source, timestamp, consent status.
- `SponsorLink`: id, sponsor campaign id, link type, destination URL, promo code, disclosure text, active window, moderation status, tracking parameters.
- `SponsorLinkClick`: id, sponsor link id, user id, campaign id, placement, region id, gym id, timestamp, attribution metadata, conversion status where available.
- `CreatorProfile`: id, user id, display name, alias/real-name preference, avatar/photo URL, verified channels, external platform URLs, bio, region, approval status, moderation status.
- `CreatorApplication`: id, user id, region id, application source, user-facing status, workout styles, external channel URLs, payout onboarding status, rights/disclosure acknowledgement status, moderation status, reviewer notes, created timestamp, updated timestamp.
- `UserCreatorFollow`: id, user id, creator profile id, primary flag, follow source, referral id, consent status, active status, created timestamp, updated timestamp, ended timestamp.
- `ExternalWorkoutContent`: id, creator profile id, platform, external content ID, URL, title, thumbnail URL, duration, channel/creator ID, embed/link status, moderation status, paid-promotion disclosure status, Made for Kids status where applicable, playback privacy mode, sponsor safe-zone status, takedown status, last API sync.
- `CreatorSubmission`: id, creator profile id, sponsor campaign id, region/gym scope, submission window id, video URL or file-handoff reference, title, workout type, duration, intensity, equipment requirements, safety notes, rights attestation status, disclosure status, moderation status, guideline-compliance status, review score, selected status, timestamps.
- `CategoryPodiumResult`: id, sponsor campaign id, region id, competition month, goal category, category population, first/second/third user ids, verified competition entries, verified workout days, tie resolution status, configured podium multipliers, base active entries, final draw weights, eligibility status, fraud-review status, finalized timestamp.
- `RegionalCreatorWorkout`: id, sponsor campaign id, selected creator profile id, selected creator submission id, external workout content id, region/gym scope, GoGymGo YouTube channel or playlist reference, month, payout pool amount, payout criteria, publication status, takedown status.
- `CreatorChallenge`: id, creator profile id, sponsor campaign id, regional creator workout id, region/gym scope, start/end dates, eligible workout rules, user reward mix, creator payout pool, official rules URL, approval status, challenge status.
- `CreatorChallengeReferral`: id, creator challenge id, source platform, referral URL/code, landing visit id, user id, timestamp, attribution metadata.
- `SponsorCreativeApproval`: id, sponsor campaign id, creator challenge id, asset type, approved copy, approved logos, trademark permission, required disclosure text, approval status, reviewer, timestamps.
- `SponsorLink`: id, sponsor campaign id, creator challenge id, link type, destination URL, promo code, UTM tags, active dates, click count, redemption count.
- `UserWorkoutProgress`: id, user id, creator challenge id, external workout content id, completion status, notes, chart metrics, linked verified session ids, creator attribution.
- `CreatorPayout`: id, creator profile id, regional creator workout id, sponsor campaign id, amount minor units, currency, payout reason, payout criteria status, Hyperwallet user token, Hyperwallet payment token, status, review notes, timestamps.
- `Draw`: id, sponsor campaign id, region id, period id, verified eligible user count, winner percentage, winner count, pool amount, payout exponent, payout-curve version, residual-cent policy, podium multiplier configuration, seed reference, ordered winner ids, status, executed timestamp.
- `DrawEntry`: id, draw id, user id, entry type, active signup entry count, earned entries, issued timestamp, category rank, podium multiplier, final draw weight, selected status, selection order, payout rank, payout amount.
- `Payout`: id, draw id, user id, payout rank, amount minor units, currency, Hyperwallet user token, Hyperwallet payment token, status.
- `FraudCase`: id, user id, session id, reason codes, severity, reviewer id, resolution.
- `GymPartnerRequest`: id, gym name, manager name, manager work email, street address, region id, verification status, reviewer id, rejection reason, submitted timestamp, reviewed timestamp.
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
- Treat the backend as authoritative for region assignment. The client submits device coordinates or an approved postal-code verification request; it never submits a trusted region selection. The backend resolves that evidence against versioned regional polygons or approved postal areas and returns the verified region id.
- Detect impossible travel, repeated region changes, VPN/proxy anomalies, GPS spoofing signals, and region mismatch between GPS/IP/device locale. IP and device locale are secondary risk signals only and never assign a region by themselves.
- Request foreground location in context and never request background location for competition-region assignment. Store the resulting region, method, timestamp, and boundary version rather than a continuous location history.
- A Profile region change requires reverification. Once a monthly competition is active, an approved home-region change takes effect for the next eligible competition month and does not move an existing enrollment, sponsor attribution, Period Match, or prize-draw eligibility.
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
- Hyperwallet handles hosted payee onboarding and payout rails, but GoGymGo remains responsible for program rules, winner decisions, funding, support, and jurisdictional compliance.

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

- Sponsors buy an exclusive primary sponsorship for a specific region and calendar month. Different regions can run different sponsors during the same month.
- The default commercial target is `$3.00 per verified GoGymGo user` in that region and month. This is a targeted campaign price tied to verified participation, not a CPM purchase and not a payment for raw app impressions.
- A verified user has a locked monthly commitment, at least one verified competition workout in the campaign month, the correct region and category, and a passing eligibility and fraud status. Manual calendar logs do not qualify.
- The default `$3.00` allocation per verified user is `$2.00` to one regional prize draw, `$0.05` to the selected regional creator, and `$0.95` to GoGymGo. Category standings award draw-weight boosts instead of separate cash prizes.
- All rates, weights, winner percentages, creative, frequency caps, and placement rules are campaign configuration so the business can adjust future campaigns without changing screen code or settlement logic.
- Each sponsorship includes approved placement-specific creative at app open, check-in, completion, leaderboard, creator discovery, and creator detail surfaces; prize draw underwriting; commitment-category winner incentives; creator activation; regional exclusivity; and aggregated campaign reporting.
- A sponsor contract defines region, month, verified-user definition, rate, maximum budget if applicable, allocation rates, creative requirements, prohibited claims, reporting, cancellation terms, and pre-funded payout obligations.
- Sponsor billing remains based on settled verified users rather than raw registrations. More late registrants increase campaign funding only when they become verified users under the contracted rules.
- Missing, expired, incomplete, or unapproved campaigns resolve to neutral GoGymGo creative. Expired sponsor branding never rolls into a new month.

### Creator-Led Sponsored Challenge Model
V1 should support creator-led sponsored challenges as a managed GoGymGo sales product, not an open creator sponsor marketplace.

- GoGymGo sources and manages the sponsor relationship in V1.
- Approved creators are campaign partners who drive qualified traffic into GoGymGo challenges from YouTube or other supported external platforms.
- Creator self-sourced sponsor onboarding, sponsor reservation, and sponsor-protection workflows are deferred to a later phase.
- Rewards can be a mix of cash, sponsor products, gift cards, sponsor credits, coupons, and other legally reviewed reward types.
- The default selected-creator payout is `$0.05 per verified regional user`. It is separate from the user prize draw pool.
- Creator payout terms should be based on selection, approved deliverables, content usage rights, disclosure compliance, and any legally approved verified-completion metrics, not YouTube views, watch time, likes, comments, subscriptions, or YouTube ad performance.
- Campaign contracts should define creator deliverables, approved sponsor copy, allowed claims, disclosure language, platform rules, reward obligations, reporting, cancellation rights, and brand-safety requirements.
- A campaign can change the creator rate or use a contracted fixed creator amount, but the configured creator allocation must be disclosed and funded before the month opens.
- Pricing should be justified by verified GoGymGo impressions, verified workout starts, verified finishers, creator referral traffic, CTA/promo clicks, reward redemption, content usage rights, category exclusivity, and reporting quality.
- YouTube-embedded screens should be sold as GoGymGo challenge sponsorships, not as YouTube player ad inventory. Sponsor value should come from app-open placements, verification placements, challenge-page safe-zone placements, offer panels, creator referrals, verified workouts, and reward redemption.
### Market Benchmark Basis

- CPM may be reported as a secondary media-efficiency metric, but it does not set campaign price or payout funding.
- GoGymGo sells access to a consented regional fitness audience whose participation is verified through the product's competition rules. The sponsor receives exclusive regional presence, repeated placements at meaningful workout moments, creator activation, reward underwriting, and first-party performance reporting.
- Sponsor reports must clearly separate verified-user campaign economics from served impressions, viewable impressions, clicks, and any external-platform metrics.

### Prize Pool Policy

- The sponsor funds the campaign allocation before the competition opens or provides an approved financial guarantee for the maximum contracted amount.
- The app labels campaign values as projected until the verified-user count is final, then shows settled pools.
- Prize rules disclose the immediately secured Free Prize Draw Entry, workout-based entries, commitment-category ranking and tie-break rules, top-three category-finish multipliers, winner count, internal draw-weight calculation, and payout review requirements.
- There are no separate category cash prizes. Category standings determine first-, second-, and third-place draw-weight boosts, and all cash winners come from the single regional prize draw.
- The official rules disclose that draw selection order becomes payout rank, the published payout exponent, projected payout examples, integer-cent settlement, and the residual-cent rule.
- Product prizes, credits, gift cards, or coupons may replace cash only when their value and restrictions are disclosed and legal review approves the campaign.

Default campaign formulas:

`Sponsor contribution = verified regional users x $3.00`

`Regional prize draw pool = verified regional users x $2.00`

`Selected-creator payout = verified regional users x $0.05`

`GoGymGo allocation = verified regional users x $0.95`

`Draw winner count = max(1, floor(verified eligible users x 15%))`

`Final draw weight = ((Period Match subtotal x category-finish multiplier) + (completed Bonus Days x selected weekly goal)) x Perfect Month multiplier + Free Prize Draw Entry`

`Raw payout weight(rank) = 1 / rank^payout exponent`

`Payout share(rank) = raw payout weight(rank) / sum of all winner payout weights`

### Commitment-Category Winner Multiplier Math

- Every 1-to-7-day commitment category has first-, second-, and third-place month-end winners. In user-facing copy, these category winners are distinct from the users ultimately selected and paid by the regional prize draw.
- Default category winner multipliers are `3x`, `2x`, and `1.5x`, respectively. They may be adjusted only in a future campaign configuration published before that month begins.
- Each category winner multiplier applies once to the user's actual four-period subtotal after all 1x/2x/3x match results are settled. The perfect-month `10x` is then applied as the final multiplier.
- Users outside the top three retain a `1x` category multiplier. Eligible Bonus Day entries are added after the category multiplier and before Perfect Month `10x`. The Free Prize Draw Entry is added afterward, remains flat, and is never multiplied.
- A top-three category finish improves weighted selection probability in the single regional prize draw; it does not guarantee a prize or create a category payout.
- Category rank uses settled Category Score only. Equal scores use verified competition days, then audited equal-chance random selection. Personal streaks never affect competition rank.
- Signup entries and manual calendar logs do not affect category rank.

Four-day perfect-month examples using the default multipliers:

| Match-adjusted four-period total | No category winner | First `3x` | Second `2x` | Third `1.5x` |
| --- | ---: | ---: | ---: | ---: |
| Four `1x` results = 16 | 160 | 480 | 320 | 240 |
| Four `2x` results = 32 | 320 | 960 | 640 | 480 |
| Four `3x` results = 48 | 480 | 1,440 | 960 | 720 |

For example, a four-day user with four successful `2x` Period Matches produces `32`; first place applies `32 x 3 = 96`; three verified Bonus Days produce `3 x 4 = 12`, making `96 + 12 = 108`; and Perfect Month is last, producing `108 x 10 = 1,080`. One Free Prize Draw Entry then produces `1,081` final Prize Draw Entries.

### Payout Pool Funding

Default allocation per verified user:

| Use | Rate Per Verified User | Share Of $3.00 | 10,000-User Example |
| --- | ---: | ---: | ---: |
| Regional prize draw | $2.00 | 66.67% | $20,000 |
| Selected regional creator | $0.05 | 1.67% | $500 |
| GoGymGo | $0.95 | 31.67% | $9,500 |
| Total | $3.00 | 100.00% | $30,000 |

Payout rules:

- Payout terms are fixed before the monthly competition begins.
- Registration terms, the 100-player launch minimum, late-registration treatment, and financial terms are fixed and disclosed before registration opens.
- Payout terms cannot change after the competition starts. Configuration can be changed only for a future campaign version.
- Default payout exponent is `0.5`. A lower positive exponent makes the ladder flatter; a higher exponent up to `1.0` makes it more top-heavy.
- Unused reserve is handled according to official rules: roll forward, add bonus prizes, or return to sponsor depending on contract terms.
- All payout structures require legal review before launch.

### Winner Pool Math

- Eligible player pool = registered users in a region who meet the official account, age, jurisdiction, registration, integrity, and fraud-review rules. A verified workout is not required for the one signup entry to participate.
- Winner count = `max(1, floor(eligible users x 15%))` when the pool is non-empty.
- Each eligible user's internal final draw weight follows this order: sum settled 1x/2x/3x Period Match results, apply `3x`, `2x`, `1.5x`, or `1x` for category position, add eligible Bonus Day entries, apply Perfect Month `10x` last when earned, then add the Free Prize Draw Entry as flat weight.
- Winners are selected without replacement using weighted random selection.
- Selection order is payout rank. The first selected winner receives the largest payout and the last selected winner receives the smallest payout.
- The prize draw process records inputs, total selection weight, ordered selected winners, payout exponent, normalized payout weights, integer-cent payouts, timestamp, and audit metadata.
- Entries and commitment-category winner multipliers improve selection probability only. They do not change a selected prize draw winner's payout after selection; payout rank and the published curve determine prize value.
- Integer-cent payouts are floored, then any residual cents are assigned from earliest to latest payout rank. This preserves a non-increasing ladder and makes paid amounts equal the full pool exactly.
- A signup entry is active immediately for the applicable draw. Verified workouts and manual logs do not change that entry's one-unit weight.

### Worked Example: 10,000 Verified Users

- Sponsor contribution: `$30,000`.
- Regional prize draw: `$20,000`.
- Draw winner count: `1,500` unique users.
- Default payout ladder at exponent `0.5`: draw rank 1 receives `$263.12`, rank 15 receives `$67.94`, rank 150 receives `$21.49`, and rank 1,500 receives `$6.79`. All 1,500 selected users are paid and the complete `$20,000` is allocated.
- Selected regional creator payout: `$500`.
- GoGymGo allocation: `$9,500`.
- The model balances exactly: `$20,000 + $500 + $9,500 = $30,000`.

### Sponsor Reporting

Sponsor-facing analytics stack:

- First-party ad exposure events are the sponsor reporting source of truth, separate from product analytics dashboards.
- Mobile and web clients emit `ad_requested`, `ad_rendered`, `ad_viewable_start`, `ad_viewable_end`, `ad_click`, `ad_dismissed`, `sponsor_app_open_view`, `sponsor_checkin_view`, `sponsor_completion_view`, `sponsor_leaderboard_view`, `sponsor_creator_discovery_view`, `sponsor_creator_detail_view`, `creator_referral_click`, `creator_follow_selected`, `creator_follow_changed`, `creator_guidelines_viewed`, `creator_application_started`, `creator_application_saved`, `creator_submission_started`, `creator_submission_submitted`, `regional_creator_workout_selected`, `creator_challenge_landing_view`, `creator_challenge_signup`, `creator_challenge_verified_start`, `creator_challenge_verified_finish`, `creator_payout_approved`, `creator_payout_paid`, `category_podium_finalized`, `podium_draw_weight_applied`, `prize_draw_executed`, `ranked_draw_payout_assigned`, and `reward_redemption` events.
- The API validates events and writes them to a PostgreSQL first-party exposure ledger with a transactional outbox.
- When campaign volume requires a warehouse, immutable exports flow to Cloud Storage and BigQuery for reporting, audit, and backfills.
- Sponsor-specific Looker reports or a purpose-built portal expose only approved aggregate views.
- Sponsor reports separate served impressions, viewable impressions, unique reach, average frequency per user, average viewable seconds, total viewable time, clicks, CTR, effective CPM, viewable CPM, sponsor area performance by placement, creator applications, creator submissions, selected regional workout, creator referral clicks, challenge page visits, signups, verified starts, verified finishers, promo-link clicks, marketplace clicks, offer redemptions where available, reward redemption by reward type, creator payout funding, prize-pool funding, and activation premium.
- Viewability uses a first-party measurement baseline aligned to common digital ad standards: display creative counts as viewable when at least 50% is on screen for at least 1 continuous second; video creative should require at least 2 continuous seconds.
- Fraud-filtered impressions, bot/device-integrity flags, duplicate events, and technically invalid sessions are excluded from billable sponsor reporting.
- No raw health, biometric, legal identity, or public profile media data is shared with sponsors.

Internal product analytics stack:

- PostHog is the MVP product analytics layer for funnels, retention, cohorts, feature flags, experiments, surveys, and session replay where legally consented.
- Amplitude remains the later-stage product analytics option if the team needs deeper behavioral analysis, larger product org workflows, or executive analytics beyond MVP.
- The server-owned event schema and outbox route clean client and server events to PostHog and later BigQuery, so GoGymGo avoids hard-coding analytics vendors into the app.
- Internal analytics tracks onboarding conversion, creator follow selection, commitment selection, session start/completion, biometric failure stages, HR validation failure reasons, Period Match behavior, Make-Up Bonus activation behavior, Bonus Day workouts, sponsor ad interactions, gym verification success, retention, and payout flow completion.
## 9. MVP Scope And Later Phases

### MVP Scope

- Native iOS and Android apps.
- Firebase account creation and returning-user access with Apple, Google, and email/password, including email verification, password reset, protected routes, persistent sessions, and real sign-out.
- Alias-only public profile identity with optional avatar/photo upload and private personal/payout details.
- Condensed Session choice between following a regional creator workout and starting a self-directed workout, followed by shared Heart-rate Device or Partner Gym QR verification-method selection. Creator application is available from Profile and through the one-time first-verified-workout prompt rather than signup.
- Biometric start, random mid-session, and end checkpoints.
- HealthKit, Health Connect, Wear OS, Apple Watch where available, Bluetooth LE heart-rate support, and partnered gym QR entry/exit verification.
- Weekly-goal selection across four fixed scoring weeks, Period Match 1x/2x/3x results, the no-extra-day exception, multiplier-eligible Bonus Day entries on days 29-31, and the final Perfect Month 10x reward.
- One-calendar-month advance registration, a 100-entrant region-wide launch minimum, optional sponsor-advised caps, and late registration through competition day 6 with same-day scoring, a first-week goal locked to remaining days, and 10x eligibility across all four periods.
- Entries, tiers, same-goal regional period pairing, 24-hour fallback matching, daily match progress, Make-Up Bonus, and text-only partner messaging.
- Workout Calendar with automatic verified-session check-off, personal streak status, week progress, leaderboard entry refresh, previous/next month navigation, and manual gym logs for exercises, duration, and notes. Selecting another month focuses today when returning to the current month and the first day otherwise. The personal workout form is collapsed behind `ADD PERSONAL WORKOUT LOG` until requested. Manual logs and personal streaks never affect competition results.
- Regional leaderboards with one compact 1-7 category selector and a selectable Top 10 list for every category. The user's own Weekly Goal is selected automatically. Category Score is visibly separated from Prize Draw Entries, top-three rows carry their configured pink multiplier badges, detailed rules remain collapsed, and rank remains unsettled until the scoring week closes. Before scoring week 1 settles, the live list stays hidden and local demo data is available only through an explicit `PREVIEW SAMPLE RANKINGS` action with a visible sample-data warning.
- The Prize Draw page uses one `REGIONAL PRIZE DRAW` title with region and competition month as its context label. Expand/collapse actions use symmetric labels such as `HOW ENTRIES GROW` and `HIDE HOW ENTRIES GROW`.
- All shared and screen-level interactive controls, including back, close, segmented, compact text and calendar-month controls, provide at least a 44-by-44-point touch target.
- Monthly Winners Circle with all seven category champions, named prize draw payout winners and amounts, manual access from Regional Ranks, and a once-per-account day-1 login announcement.
- Public REGISTER A GYM request flow for one location at a time, with local validation and a backend-ready pending review state. No QR code is issued or activated until GoGymGo verifies and approves the manager and location.
- Gym competition pilot with QR entry/exit verification, including QR-based session start/end for users who select a partner gym instead of a heart-rate device, and optional BLE beacon verification for approved partner gyms.
- Monthly sponsor campaigns, app-open sponsor placement, workout-verification sponsor placements, first-party sponsor reporting, and a creator-led sponsored challenge pilot.
- Seven regional category standings each month, with configurable first-, second-, and third-place multipliers that boost final prize draw weight instead of paying separate category prizes.
- Explicit neutral sponsor areas for the app-wide sponsored-by rail, app-open, creator signup, creator workout discovery, creator workout detail safe-zone, leaderboard/winner announcement, and reward surfaces. Check-in and checkout use passive compact attribution rather than interactive ads. A neutral campaign uses quiet cyan GoGymGo campaign language such as `PRIZE DETAILS PUBLISHED SOON` instead of a `$0` prize pool, repeated warnings or an expired sponsor identity.
- Monthly regional GoGymGo YouTube workout pilot where local creators submit follow-along workouts, GoGymGo selects one featured workout, a sponsor funds safe-zone placements, users earn through verified workouts, and the selected creator can earn a sponsor-funded payout. Creator submissions do not award prize draw entries.
- External workout platform link/API metadata for approved creator challenges, starting with YouTube where permitted.
- YouTube embed safe-zone checklist for creator challenge pages: official embed only, no sponsor overlays or player gates, no interference with YouTube ads/controls/links, `autoplay=false` default, Made for Kids status check where required, and link-out fallback when policy is unclear.
- Weighted random monthly prize draw by region selecting 15% of eligible registered users without replacement, then paying every selected winner through the published payout ladder.
- Hyperwallet Pay Portal onboarding, payments, webhooks, and reconciliation.
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
- Are prizes cash, gift cards, sponsor products, or a mix? Recommendation: start only with payout methods enabled in the contracted Hyperwallet program and legally approved for each launch jurisdiction.
- What is the minimum age? Recommendation: start with 18+ only.
- How strict should HR validation be for beginners and users with medical conditions? Recommendation: use conservative default thresholds and exclude medical personalization from v1.
- Can users complete sessions outside their home region while traveling? Recommendation: allow activity but attribute competition eligibility to the verified home region locked for the month. A user who is travelling during onboarding can verify an approved home postal code; location/postal mismatches should become risk or review signals rather than unrestricted manual selection.
- Which gym partners and hardware model should launch first? Recommendation: launch QR-first for broad operational simplicity, with BLE beacons piloted at higher-volume gyms where hardware can be monitored.
- Which creator/sponsor package should launch first: local/gym pilot, targeted creator challenge, regional creator challenge, or larger category-exclusive campaign? Recommendation: start with a managed creator pilot in one legally reviewed region.
- Which external platforms beyond YouTube should be approved in V1, and what API, embed, disclosure, and takedown requirements should each platform meet? Recommendation: start link-first, then add API metadata only where terms are clear.
- Should MVP embed YouTube videos in-app or link users out to YouTube? Recommendation: use link-out as the safest default and embed only on screens with official YouTube player behavior, GoGymGo-owned safe-zone sponsor placements, and legal/platform review.

### Key Risks

- Legal classification of weighted random draws could materially change the business model.
- iOS background limitations could weaken random ping reliability.
- Fraud attempts may increase as prize pools grow.
- Wearable data quality varies by device and platform.
- Sponsor acquisition risk: the `$3 per verified regional user` model is a targeted activation product rather than commodity media, so sales must clearly prove verified-user quality, regional exclusivity, repeated workout-moment exposure, creator value, and first-party reporting.
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
- Firebase Authentication is the MVP identity provider for email/password, Google, and Apple accounts. Email/password users verify their email before entering private product routes.
- Firebase public web-app values are environment configuration. Google platform files, bundle/package identifiers, OAuth clients, Apple credentials, and backend Firebase Admin credentials must be configured before native authentication is considered operational.
- Client-side legal-acceptance persistence is provisional. Production stores the accepted policy versions and timestamp in the authenticated backend account record.
- Public profile uses the required Alias entered during onboarding; users can edit it later and can upload, replace, or delete an optional avatar or personal photo while personal and payout details stay private.
- No purchase is required to participate.
- New eligible users receive one active registration prize draw entry in the signup month whether or not they complete a workout. Its timing, expiration, region, and legal eligibility remain governed by the official campaign rules.
- New users discover creator workouts from Session rather than choosing a creator during account onboarding. Referral links may preselect a creator in future campaign discovery, and users can change follows later.
- Regional competitions are legally reviewed before launch.
- The app does not store raw biometric templates.
- Biometric authentication is local-device verification, not identity proof by itself.
- Prize-eligible workout sessions require either heart-rate validation from an approved source or partnered gym QR entry/exit validation at an approved gym.
- The app may require foreground session mode for MVP reliability.
- Existing users retain their whole-month commitment automatically unless they change the upcoming goal before registration closes at 11:59:59 PM on the final day of the prior calendar month.
- Advance registration runs for the complete calendar month before competition month. The field requires at least 100 total eligible entrants across the region at cutoff and can use an optional sponsor-advised cap. A qualified competition keeps late registration open only through the conclusion of day 6 or until the cap is reached, whichever comes first.
- If fewer than 100 eligible regional entrants remain at cutoff, that month's regional competition is cancelled and creates no scoring, pairings, commitment-category top three, or prize draw. Users are notified and must register for the next month.
- A signup after cutoff may late-register into a launched competition through day 6 and begins scoring on the registration date. The only available goal is the number of days remaining through day 7. A late entrant remains 10x eligible by hitting that reduced goal in the partial first week and the same goal in weeks 2-4.
- Competition scoring periods are days 1-7, 8-14, 15-21, and 22-28 in the locked competition-region timezone.
- Period success requires at least the selected number of valid sessions on separate days. A missed period awards zero.
- Period entries equal selected goal x 1, x 2, or x 3 according to the final matchup result.
- The category-finish multiplier applies to the actual sum of eligible settled Period Match results after all 1x, 2x, and 3x outcomes. Eligible Bonus Day entries are then added, and Perfect Month `10x` multiplies that combined subtotal last. Late entrants remain eligible by completing their reduced first-week goal and the same goal in weeks 2-4.
- Each available day 29-31 awards entries equal to the user's selected weekly goal for one verified workout. These entries are included in perfect-month `10x` but do not receive the category winner multiplier.
- Pairing occurs once per period within the same goal category and region, with a 24-hour same-timezone fallback and solo 1x fallback when no compatible match exists.
- Winner count is `max(1, floor(verified eligible regional users x 15%))` when the eligible pool is non-empty.
- Draw selection order becomes payout rank. The default `0.5` exponent creates a flatter poker-style ladder, and all selected winners receive a payout from the single regional pool.
- Payouts are sponsor-funded from the configured per-verified-user campaign rates and financially secured before the competition starts.
- Category rankings exclude the Free Prize Draw Entry and use the cumulative Category Score from all completed scoring weeks. Each settled `1X`, `2X`, or `3X` Period Match result updates the score and rank after that week closes; the fourth settled week produces the final monthly Category Score. The Top Three Category Finishers are resolved by final Category Score, verified competition days, then an audited equal-chance random tie-break, and receive configurable `3x`, `2x`, and `1.5x` final-total multipliers by default. Personal streaks never affect category rank.
- Hyperwallet Pay Portal is the selected identity, tax, transfer-method, and payout workflow; GoGymGo does not collect bank details.
- Sponsor reporting uses aggregated data and excludes sensitive health, biometric, legal identity, and public profile media details.
- Sponsor reporting source of truth is GoGymGo's first-party PostgreSQL event ledger, with Cloud Storage, BigQuery, and sponsor-specific Looker reporting added only when volume requires them.
- Internal product analytics uses PostHog for MVP, with additional routing or analytics vendors added only when demonstrated product needs justify them.
- V1 includes a managed creator-led sponsored challenge pilot using approved external-platform links or APIs where permitted.
- V1 includes a monthly regional GoGymGo YouTube workout pilot where local creators submit candidate follow-along videos, GoGymGo selects one featured workout, and the selected creator can earn a sponsor-funded payout under campaign rules. Creator submissions do not award prize draw entries.
- V1 does not require owned in-app GoGymGo video upload by creators or users. Creator video submission can be handled as approved external links or controlled file handoff for official GoGymGo YouTube publication/feature after rights and moderation review.
- GoGymGo manages sponsor relationships for creator-led challenges in V1; creator self-sourced sponsor onboarding and sponsor-protection workflows are later-phase capabilities.
- Rewards can mix cash, sponsor products, gift cards, sponsor credits, coupons, and other legally reviewed reward types.
- Creator payouts are separate from the user prize draw pool. The default creator allocation is `$0.05 per verified regional user` and must be funded and approved before the campaign starts.
- Users are rewarded for verified GoGymGo workouts, not external-platform views, likes, subscribes, comments, shares, watch time, or YouTube ad impressions.
- GoGymGo sponsor placements near embedded YouTube content are outside the YouTube player and are not sold as YouTube player ad inventory, YouTube watch-time inventory, or YouTube-served ad inventory.
- YouTube embeds use official player behavior, do not block YouTube ads or controls, default to `autoplay=false`, and use link-out fallback when embed policy or rights are unclear.
- YouTube content is checked for Made for Kids status where required; Made for Kids content is excluded from personalized sponsor targeting and should be excluded from creator challenges unless legal/privacy review approves otherwise.
- V2 sponsor marketplace links and promo links are tracked through GoGymGo redirect and attribution services.
- The default campaign model charges `$3.00 per verified regional user`: `$2.00` single regional prize draw, `$0.05` selected creator, and `$0.95` GoGymGo. The draw selects 15% of eligible verified users, the payout curve defaults to exponent `0.5`, and commitment-category winner multipliers default to `3x`, `2x`, and `1.5x`. These numbers are campaign configuration and may change for a future month.
- Signup prize draw entry is one-time and active in the signup month without a workout requirement.
- Sponsor frequency defaults are app open once per day, check-in once per workout, completion once per workout, plus embedded placement-specific leaderboard and creator surfaces under campaign caps.
- Sponsor-facing analytics report served impressions, viewable impressions, unique reach, frequency, average viewable seconds, total viewable time, effective CPM, viewable CPM, clicks, CTR, placement mix, creator submissions, selected regional workout, creator referrals, challenge page visits, verified starts, verified finishers, creator payout status, and fraud-filtered exclusions, while excluding YouTube player ads, YouTube watch time, and YouTube-served ad impressions from GoGymGo billable CPM.
- The per-user allocation rates, optional sponsor-advised entrant cap, and payment protections are fixed in the sponsor contract before registration opens. UI values remain projected until the verified-user count settles.
- Partner gyms permit GoGymGo to install approved BLE beacons or display rotating QR codes at entry/exit locations.
- Gym competition QR verification can replace wearable heart-rate validation only for approved partner-gym QR sessions; it does not replace biometric verification, device integrity checks, minimum duration, fraud controls, or legal eligibility review.



