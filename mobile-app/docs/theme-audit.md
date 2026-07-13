# GoGymGo HUD Theme Migration Audit

## Phase 0 - Shared Design Assets

- Added `assets/fonts/Orbitron-Bold.ttf` and `assets/fonts/ShareTechMono-Regular.ttf`.
- Registered `Orbitron-Bold` and `ShareTechMono-Regular` in `app/_layout.tsx` via `expo-font`.
- Added the Cyberpunk HUD primitive layer in `src/components/cyber.ts`: `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Updated `src/constants/theme.ts` with the `#080B0E` HUD background, font-family map, neon text shadows, and native/web glow fallbacks.

## Global Color Semantics Update

- Cyan is reserved for primary actions, navigation, selections, active progress, structural labels, ordinary information, tier/rank shells, and back/skip/dismiss controls.
- Pink is reserved for confirmed sponsor marks/offers, Prize Draw Entries, bonus/prize/reward moments, creator applications or payouts, urgent checkpoint alerts, and other genuinely high-value moments. Creator-workout discovery and ordinary creator navigation use cyan.
- The Join screen treats Creator, Sponsor, and Partner Gym as equal navigation destinations, so all three category labels use cyan; pink does not identify an ordinary navigation row.
- Green now identifies verified, completed, and successful states. Amber identifies pending states, deadlines, cautions, and late-registration restrictions. Red identifies invalid input, errors, unavailable routes/sessions, and destructive confirmation.
- Extended `TerminalText`, `HUDBorderBox`, `CyberButtonPrimary`, and `CyberButtonOutline` with centralized green, amber, and red semantic tones instead of using pink as a generic non-cyan fallback.
- Updated the welcome loop so `SHOW UP`, `PROVE IT`, and `WIN` all use the unified cyan step treatment instead of making the third step pink.
- Centralized raw brand colors, overlay colors, status colors, text colors, and typography scale tokens in `src/constants/theme.ts`.
- Replaced app-level hardcoded hex/RGBA values with named semantic theme tokens and replaced screen-level numeric `fontSize` values with `fontSizes` tokens.
- Verified that raw color values now live in `src/constants/theme.ts`; remaining `#142` matches are user-visible rank copy, not style values.
- Aligned `app.json` Android adaptive icon background with the brand background and disabled Expo typed route generation after the generated Windows route file produced malformed backslash paths for the creator invite route.

## Global UX Language And Hierarchy Update

- Standardized player-facing terminology around `Scoring Week`, `Weekly Goal`, `Period Match`, `Matched Player`, `Period Match Bonus`, `Bonus Days 29-31`, `Category Score`, `Top Three Category Finishers`, and `Prize Draw Entries`.
- Reserved `final draw weight`, period identifiers, and remainder-day identifiers for internal calculation/domain code; player-facing screens no longer expose those implementation terms.
- Simplified Commitment by removing the duplicated collapsed bonus list. The page now presents the weekly goal, one-workout-per-day rule, zero-entry consequence, base projection, maximum prompt, and one calculator explanation before the detailed calculator is opened.
- Saved the onboarding verification method as the user's default, surfaced it in Profile, and presented it first during later workout verification without removing either supported method.
- Replaced fabricated leaderboard rank and estimated-odds values with an unsettled-rank state and the user's actual Prize Draw Entry count. Preview-only standings and results are labeled as sample data.
- Added sponsor-pending states that say the prize pool will be announced instead of rendering `$0` beside finalized payout language.
- Reduced sponsor interaction during trust- and safety-sensitive workout steps: check-in uses passive compact attribution and checkout sponsor attribution is non-interactive.
- Reduced every unconfirmed sponsor placement to one compact amber pending row; full video-style sponsor inventory now appears only after a campaign is approved.
- Moved the Commitment goal selector above registration and scoring explanation, separated pre-competition practice from active Prize Draw scoring on Home, and synchronized the Leaderboard category selector after stored-goal hydration.
- Condensed Profile by moving picture controls into the header, adding an actionable email-verification state, grouping creator destinations, removing the tab-root Back button, and returning ordinary settings destinations to cyan.
- Shortened account consent labels while preserving the linked legal detail, and changed verification setup from misleading connection language to explicit default-method selection language.

## Global Typography Semantics Update

- Added Rajdhani Medium and SemiBold as bundled Expo assets alongside Orbitron Bold and Share Tech Mono.
- Applied Orbitron to major page titles, primary actions, and compact feature or rule-card headings.
- Applied Share Tech Mono only to short HUD labels, step markers, metadata, statuses, timers, tab labels, and other compact technical readouts.
- Applied Rajdhani to the shared body variant and semantic body, explanatory, legal, form-input, calculation, helper, and supporting-copy styles across the application.
- Added a compact Rajdhani `caption` variant for explanatory helper text that must remain space-efficient. The mono `micro` variant is reserved for short HUD metadata, codes, statuses, dates, and telemetry rather than full sentences.
- Preserved the existing centralized font-size tokens and semantic color assignments during the migration; this pass changes font roles without introducing new screen-local sizes or colors.
- The page-specific font notes below describe the original HUD migration and are superseded by this global three-font role system where they refer to all copy as terminal text.

## Page 01 - `app/(onboarding)/welcome.tsx`

### Step 1 - Write/Refactor

- Re-skinned the welcome page to use `ScreenContainer` for the `#080B0E` background.
- Replaced local button/card/text primitives with `CyberButtonPrimary`, `CyberButtonOutline`, `HUDBorderBox`, and `TerminalText`.
- Converted terminal labels and values to uppercase HUD copy.
- Applied cyan/pink neon glows through shared text and border primitives.
- Updated the opening structure to match the reference flow: sponsor rail, system-status pill, GoGymGo wordmark, three step cards, sponsor line, free-entry card, then account actions.
- Removed the height-aware hero spacer so the logo and three steps sit close together without a large empty gap.
- Expanded the signup reward card to show the banked free entry, first-verified-workout activation, projected campaign draw pool, and compact regional sponsor attribution inside the same panel.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\welcome.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: `fontFamily` is explicitly mapped through `fontFamilies.display` and `fontFamilies.terminal` in the page styles and shared `TerminalText` styles.

### Step 3 - Test Mock

- Verified that `CyberButtonPrimary` renders the default lightning glyph and keeps the neon cyan aura while preserving the first-viewport `CREATE ACCOUNT ->` navigation to `/identity`.
- Verified that `CyberButtonOutline` renders the existing-account path in the standard outline treatment and preserves navigation to `/home`.
- Verified that welcome step rows keep unified cyan visual coding while using `HUDBorderBox` and uppercase terminal labels.
- Verified that the three step rows now render directly below the GoGymGo wordmark before the free-entry card and account actions.

## Page 02 - `app/(onboarding)/identity.tsx`

### Step 1 - Write/Refactor

- Re-skinned the public identity page with `ScreenContainer` and the shared `#080B0E` HUD background.
- Replaced the primary continue, back, shuffle, sponsor, privacy, and input panels with Cyber HUD primitives.
- Kept the identity radio behavior intact while wrapping each choice in a `HUDBorderBox` and `TerminalText` structure.
- Converted labels, helper copy, options, and privacy messaging to uppercase terminal copy.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\identity.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with shared `TerminalText` retaining the Orbitron/Share Tech Mono mappings.

### Step 3 - Test Mock

- Verified that Public Identity presents one required Alias field with no competing callsign or visibility-mode controls.
- Verified that an existing saved public name pre-fills the Alias field and remains editable.
- Verified that the optional profile-picture control reuses the shared picker, previews a saved picture, and keeps an initials avatar as the fallback.
- Verified that `CONTINUE ->` persists the Alias and preserves navigation to `/creator`, while the standard compact back control calls `router.back()`.

## Page 03 - `app/+not-found.tsx`

### Step 1 - Write/Refactor

- Re-skinned the not-found route with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, and `CyberButtonPrimary`.
- Replaced the old generic card with a pink offline HUD alert.
- Converted the route copy to uppercase terminal messaging.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\+not-found.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with all text rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the offline route alert renders in pink HUD styling with the cyan terminal title.
- Verified that `BACK TO START ->` preserves `router.replace('/welcome')` from the cyber primary button.

## Page 04A - `app/(onboarding)/creator/invite.tsx`

### Global Button Wording Update

- Removed shorthand button prefixes from the shared `CyberButtonPrimary` and `CyberButtonOutline` implementation so buttons render prototype-style action labels only.
- Removed screen-level `icon` props that previously injected codes such as `SK`, `PL`, `BK`, `RULE`, `INFO`, `YT`, and similar prefixes before labels.
- Replaced bottom-tab letter glyphs such as `HM`, `LB`, `GO`, `VS`, and `GR` with non-text HUD dots so navigation uses readable labels only.

### Step 1 - Write/Refactor

- Added a standalone creator application invite page before the creator selection step.
- Re-skinned the creator invite with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Added clear actions for `LEARN MORE`, `APPLY AS CREATOR ->`, `DON'T SHOW AGAIN`, `CONTINUE AS PLAYER`, and `BACK`.
- Standardized the creator invite around the same cyan onboarding structure as the surrounding screens: cyan title, cyan application panel, neutral same-shape fact rows, shorter fact copy, and one pink high-value apply CTA.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\creator\\invite.tsx" "app\\(onboarding)\\creator\\index.tsx" "app\\(onboarding)\\identity.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass after clearing stale generated Expo Router types.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with all visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that identity now routes to `/creator/invite`.
- Verified that `LEARN MORE` routes to `/creator/guidelines` and `APPLY AS CREATOR ->` routes to `/creator/apply`.
- Verified that `DON'T SHOW AGAIN` dismisses to `/creator` and stores a session-level skip preference, while `CONTINUE AS PLAYER` also routes to `/creator` and `BACK` calls `router.back()`.

## Page 04B - `app/(onboarding)/creator/index.tsx`

### Step 1 - Write/Refactor

- Re-skinned the creator selection page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Removed the inline creator application card so creator application now lives on its own onboarding page.
- Rebuilt solo and creator selection rows as native radio press targets wrapped in HUD border boxes.
- Converted creator names, labels, helper copy, and follower values to uppercase terminal presentation.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\creator\\index.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass after clearing stale generated Expo Router types.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with all copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the solo and creator radio rows preserve selected state while the active row receives the cyan HUD aura.
- Verified that the creator selection page no longer contains the inline creator application card.
- Verified that `CONTINUE ->` and `SKIP FOR NOW` both preserve navigation to `/consents`, while `BACK` calls `router.back()`.

## Page 05 - `app/(onboarding)/creator/guidelines.tsx`

### Step 1 - Write/Refactor

- Re-skinned the creator guidelines page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the four upload guideline rows into cyan/pink HUD panels.
- Converted creator guidance copy and action labels to uppercase terminal language.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\creator\\guidelines.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with all visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that cyan guideline rows and pink reward/payout rows keep their distinct HUD tones and neon treatment.
- Verified that `APPLY AS CREATOR ->` preserves navigation to `/creator/apply`.
- Verified that `BACK` preserves `router.back()` from the outline HUD button.

## Page 06 - `app/(onboarding)/creator/apply.tsx`

### Step 1 - Write/Refactor

- Re-skinned the creator application page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted application requirements into cyan/pink HUD checklist panels.
- Converted the sponsor brief into a muted HUD panel with terminal sponsor copy.
- Replaced apply/player/back actions with cyber buttons.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\creator\\apply.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with all visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the four application steps preserve their cyan/pink requirement and reward coding.
- Verified that the sponsor brief remains visible as a dedicated sponsor placement area.
- Verified that `APPLY AS CREATOR ->` and `CONTINUE AS PLAYER` both preserve navigation to `/consents`, while `BACK` preserves `router.back()`.

## Page 07 - `app/(onboarding)/consents.tsx`

### Step 1 - Write/Refactor

- Re-skinned the permissions page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted consent rows into HUD panels while keeping native `Pressable` switch controls.
- Preserved the typed `ConsentState` toggle map for Identity check, Workout data, and Region, and removed Sponsor Ads from the user-facing permission rows.
- Converted permission descriptions and route action labels to uppercase terminal copy.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\consents.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with all visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that each consent switch preserves checked/unchecked state and toggles the correct typed `ConsentKey`.
- Verified that enabled consent rows receive the cyan HUD glow while disabled rows fall back to muted HUD styling.
- Verified that `ALLOW & CONTINUE ->` preserves navigation to `/verification`, while `BACK` preserves `router.back()`.

## Page 08 - `app/(onboarding)/verification.tsx`

### Step 1 - Write/Refactor

- Re-skinned the workout verification page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the heart-rate device and partner gym QR method cards into HUD radio panels.
- Converted device search, device linking rows, gym selection rows, QR note, and empty-state copy to uppercase terminal UI.
- Preserved the typed wearable catalog, gym catalog, linked-device map, search filtering, and conditional CTA behavior.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\verification.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText` and the search input explicitly mapped to the terminal font.

### Step 3 - Test Mock

- Verified that wearable search still filters the typed device catalog and `MORE DEVICES` reveals the full catalog.
- Verified that linking a device toggles the row from `CONNECT` to `LINKED` and reveals the pink `CONTINUE WITH HEART-RATE DEVICE ->` CTA.
- Verified that selecting partner gym QR preserves gym radio selection and immediately reveals `CONTINUE WITH GYM QR ->`.
- Verified that the continue CTA preserves navigation to `/how-it-works`, while `BACK` preserves `router.back()`.

## Page 09 - `app/(onboarding)/how-it-works.tsx`

### Step 1 - Write/Refactor

- Re-skinned the loop explainer page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the three loop steps and Period Match Bonus explanation into HUD panels.
- Replaced bonus rules, dismiss, commit, and back actions with cyber buttons.
- Removed unused legacy rule-row styles from the previous version.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\how-it-works.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with all visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that `VIEW BONUS RULES` preserves navigation to `/bonus-rules`.
- Verified that `DON'T SHOW ME AGAIN` preserves `router.replace('/commitment')`.
- Verified that `GOT IT - LET'S COMMIT ->` preserves navigation to `/commitment`, while `BACK` preserves `router.back()`.

## Page 10 - `app/(onboarding)/commitment.tsx`

### Step 1 - Write/Refactor

- Re-skinned the commitment page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the day picker into native pressable HUD controls with a cyan active glow.
- Converted perfect-month entries and draw summary into HUD panels.
- Preserved day selection state and the `days * 10` perfect-month entry calculation.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\commitment.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that selecting 1-7 day controls updates the highlighted HUD button and recalculates perfect-month entries.
- Verified that `VIEW COMMITMENT RULES` preserves navigation to `/commitment-rules`.
- Verified that `LOCK COMMITMENT ->` preserves navigation to `/entry-confirmed`, while `BACK` preserves `router.back()`.

## Page 11 - `app/(onboarding)/entry-confirmed.tsx`

### Step 1 - Write/Refactor

- Re-skinned the entry confirmation page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, and `CyberButtonPrimary`.
- Converted the ticket confirmation ring, sponsor rail, entry stats, and next-signal panel into native HUD surfaces.
- Kept all reward language in `entries` and removed the legacy `TIX` label.
- Preserved the final app-entry navigation with `router.replace('/home')`.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\entry-confirmed.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the cyan ticket ring renders the `ENTRY` label with HUD glow while the sponsor rail keeps the muted sponsor treatment.
- Verified that the three typed stat cards preserve current entry, bonus entries, and day-goal values.
- Verified that `ENTER GOGYMGO ->` preserves `router.replace('/home')`.

## Page 12 - `app/(tabs)/home/index.tsx`

### Step 1 - Write/Refactor

- Re-skinned the Home tab with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the app-open sponsor area, weekly commitment card, stats, rival pact, and creator workout card into HUD surfaces.
- Preserved the bottom-tab padding and kept all user-facing reward language in `entries`.
- Preserved existing routes for sponsor offer, workout start, squad, creator workout detail, and creator workout list.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\home\\index.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the sponsor app-open card preserves navigation to `/sponsor-offer`.
- Verified that the cyan `START 30-MIN SESSION` CTA preserves navigation to `/workout/check-in`.
- Verified that the rival pact card preserves navigation to `/squad`.
- Verified that the creator workout card preserves navigation to `/workouts/toronto-creator-workout`, and `VIEW CREATOR WORKOUTS ->` preserves navigation to `/workouts`.

## Page 13 - `app/(tabs)/leaderboard/index.tsx`

### Step 1 - Write/Refactor

- Re-skinned the leaderboard tab with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, and `CyberButtonOutline`.
- Converted the regional header, tier badge, my-rank summary, progress track, rank rows, and draw link into HUD surfaces.
- Preserved leaderboard row data, estimated odds, entry totals, and the Toronto June ranking hierarchy.
- Preserved navigation to the draw route and back to Home.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\leaderboard\\index.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the top-five ranking rows preserve rank, initials, tier, entries, and estimated odds.
- Verified that the dashed draw HUD card preserves navigation to `/leaderboard/draw`.
- Verified that `BACK` preserves navigation to `/home`.

## Page 14 - `app/(tabs)/leaderboard/draw.tsx`

### Step 1 - Write/Refactor

- Re-skinned the draw detail page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, and `CyberButtonOutline`.
- Converted the prize pool, prize stat cards, odds progress rows, audit text, payout verification note, and sponsor rail into HUD surfaces.
- Preserved the typed percentage-width odds rows and all draw/payout copy.
- Preserved the header back behavior with `router.back()`.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\leaderboard\\draw.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that `BACK` preserves `router.back()`.
- Replaced the retired static prize stats with campaign-driven values for the 10% weighted winner pool, equal winner payout, and active-entry weight.
- Verified that the odds bars preserve typed percentage widths for signup baseline and monthly entries.
- Verified that payout verification copy remains separate from public profile language.

## Page 15 - `app/(tabs)/workouts/index.tsx`

### Step 1 - Write/Refactor

- Re-skinned the Creator Workouts list with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, and `CyberButtonOutline`.
- Converted the YouTube info note, creator payout sponsor surface, workout cards, joined/join badges, and player previews into HUD surfaces.
- Preserved typed workout row data, sponsor labels, payout/reward copy, timing labels, and dynamic workout detail routing.
- Preserved navigation back to Home.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\workouts\\index.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that each workout card preserves dynamic navigation to `/workouts/${workout.id}`.
- Verified that joined workouts retain the neon joined badge while open creator slots use the muted join state.
- Verified that the sponsor payout pool remains a neutral sponsor surface and `BACK` preserves navigation to `/home`.

## Page 16 - `app/(tabs)/workouts/[workoutId].tsx`

### Step 1 - Write/Refactor

- Re-skinned the creator workout detail page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted creator header, sponsor safe-zone, creator selection, rewards, rules, and start CTA into HUD surfaces.
- Kept the YouTube/player block visually distinct and sponsor creative outside the player boundary.
- Preserved back behavior, sponsor-offer navigation, and workout check-in navigation.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\workouts\\[workoutId].tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that `BACK` preserves `router.back()`.
- Verified that tapping the sponsor safe-zone preserves navigation to `/sponsor-offer`.
- Verified that `JOIN & START WORKOUT ->` preserves navigation to `/workout/check-in`.
- Verified that sponsor copy remains outside the YouTube player block.

## Page 17 - `app/(tabs)/squad/index.tsx`

### Step 1 - Write/Refactor

- Re-skinned the Squad tab with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the weekly rival pact, player blocks, make-up/forfeit bonus panel, chat shell, fake input, send control, and navigation actions into HUD surfaces.
- Preserved chat message data, 12 draw-entry claim value, rival progress state, and same-gym match note.
- Preserved navigation to gym competition and Home.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\squad\\index.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that player progress remains `3 / 4 OK` versus `2 / 4` with cyan/pink HUD avatar states.
- Verified that the claimable card preserves `12 DRAW ENTRIES`.
- Verified that `VIEW GYM COMPETITION ->` preserves navigation to `/squad/gym`, and `BACK` preserves navigation to `/home`.

## Page 18 - `app/(tabs)/squad/gym.tsx`

### Step 1 - Write/Refactor

- Re-skinned the gym competition page with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, and `CyberButtonOutline`.
- Converted the gym header, QR verification action, scan/Beacon mode controls, signed checkpoint line, sponsor rail, and gym leaderboard rows into HUD surfaces.
- Preserved gym leaderboard entries, current-user row, QR entry/exit wording, and signed time-bound checkpoint copy.
- Preserved QR scanner navigation and back behavior.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\squad\\gym.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the QR verification card preserves navigation to `/qr-scanner`.
- Verified that Scan QR remains the active cyan mode while BLE Beacon remains muted.
- Verified that gym rows preserve the ranked competitors and render the persisted public identity plus `// YOU` for the current-user row.
- Verified that `BACK` preserves `router.back()`.

## Page 19 - `app/(tabs)/profile/index.tsx`

### Step 1 - Write/Refactor

- Re-skinned the Profile tab with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, and `CyberButtonOutline`.
- Converted avatar, tier badge, stats, public identity segmented control, settings rows, statuses, sponsor rail, sign-out, and back actions into HUD surfaces.
- Preserved `IdentityMode` state, profile stats, payout verification status, creator status, following route, creator apply route, and sign-out behavior.
- Kept payout verification copy private and separate from public identity controls.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\profile\\index.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that Private, Alias, and Real segmented controls preserve selected state through `identityMode`.
- Verified that Following preserves navigation to `/creator` and Creator Status preserves navigation to `/creator/apply`.
- Verified that `RESTART DEMO - SIGN OUT` preserves `router.replace('/welcome')`, while `BACK` preserves navigation to `/home`.

## Page 20 - `app/workout/check-in.tsx`

### Step 1 - Write/Refactor

- Re-skinned the workout check-in screen with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the check-in header, sponsor check-in placement, Face ID scan frame, explanatory copy, and scan CTA into HUD surfaces.
- Preserved sponsor-offer navigation, Home navigation, and active-session navigation.
- Kept biometric copy clear that Face ID stores a checkpoint result, not the scan.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\workout\\check-in.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the sponsor check-in placement preserves navigation to `/sponsor-offer`.
- Verified that `HOME` preserves navigation to `/home`.
- Verified that `SCAN FACE ID ->` preserves navigation to `/workout/active`.

## Page 21 - `app/workout/identity-check.tsx`

### Step 1 - Write/Refactor

- Re-skinned the workout identity-check screen with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the route header, Face ID scan frame, QR-specific explanation, and continue CTA into HUD surfaces.
- Preserved back behavior and active-session navigation.
- Kept QR/Face ID copy explicit: QR proves place, Face ID confirms the phone user.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\workout\\identity-check.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that `BACK` preserves `router.back()`.
- Verified that `CONTINUE TO SESSION ->` preserves navigation to `/workout/active`.
- Verified that the cyan Face ID HUD frame keeps the same QR-specific checkpoint message.

## Page 22 - `app/workout/active.tsx`

### Step 1 - Write/Refactor

- Re-skinned the active workout session screen with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the recording pill, elapsed clock, progress track, HR/elevated-minute metrics, locked/ready finish CTA, checkpoint action, cancel confirmation, and back action into HUD surfaces.
- Preserved timer state, progress percentage, heart-rate/elevated-minute derived metrics, 30-minute finish lock, cancel confirmation state, and all route actions.
- Preserved the disabled finish CTA until the 30:00 minimum is reached.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\workout\\active.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that elapsed time, progress width, HR, and elevated minutes continue to derive from `elapsedSeconds`.
- Verified that the finish CTA remains disabled until `session.ready` and then preserves navigation to `/workout/check-out`.
- Verified that `SIMULATE CHECKPOINT` preserves navigation to `/workout/ping`.
- Verified that `END SESSION` opens the confirmation card, `KEEP GOING` dismisses it, `END NOW` navigates to `/home`, and `BACK` navigates to `/workout/check-in`.

## Page 23 - `app/workout/ping.tsx`

### Step 1 - Write/Refactor

- Re-skinned the random biometric ping screen with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the random-ping alert pill, grace countdown ring, warning copy, verification CTA, and back-to-session action into pink HUD surfaces.
- Preserved countdown state, formatted grace clock, ping-success navigation, and back-to-active-session navigation.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\workout\\ping.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the grace countdown continues to derive from `secondsRemaining` and `formatGrace`.
- Verified that `VERIFY FACE ID ->` preserves navigation to `/workout/ping-success`.
- Verified that `BACK TO SESSION` preserves navigation to `/workout/active`.

## Page 24 - `app/workout/ping-success.tsx`

### Step 1 - Write/Refactor

- Re-skinned the ping-success confirmation screen with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, and `CyberButtonPrimary`.
- Converted the checkpoint-confirmed success mark, success copy, eligibility message, and return CTA into cyan HUD surfaces.
- Preserved active-session return navigation.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\workout\\ping-success.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the cyan `OK` HUD confirmation mark renders as the checkpoint success state.
- Verified that `BACK TO SESSION ->` preserves navigation to `/workout/active`.

## Page 25 - `app/workout/check-out.tsx`

### Step 1 - Write/Refactor

- Re-skinned the workout check-out screen with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the checkout sponsor placement, final checkpoint success mark, session metrics, Face ID finish CTA, and back action into HUD surfaces.
- Preserved checkout metrics, sponsor-offer navigation, completion navigation, and active-session back navigation.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\workout\\check-out.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the sponsor checkout card preserves navigation to `/sponsor-offer`.
- Verified that `SCAN FACE ID - FINISH ->` preserves navigation to `/workout/complete`.
- Verified that `BACK` preserves navigation to `/workout/active`.

## Page 26 - `app/workout/complete.tsx`

### Step 1 - Write/Refactor

- Re-skinned the workout completion screen with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, and `CyberButtonPrimary`.
- Converted the `+10` reward badge, verified session copy, weekly progress panel, progress bars, and home CTA into HUD surfaces.
- Preserved `+10 entries` reward language, 4/4 weekly progress, partner-bonus pending message, and home navigation.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\workout\\complete.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that the `+10` cyan reward badge and four progress bars render as completed HUD states.
- Verified that `BACK TO HOME ->` preserves navigation to `/home`.

## Page 27 - `app/(modals)/sponsor-offer.tsx`

### Step 1 - Write/Refactor

- Re-skinned the sponsor offer modal with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the offer header, sponsor hero, fact list, disclosure panel, claim CTA, and back action into HUD surfaces.
- Preserved sponsor facts, offer code, disclosure copy, alert-based claim behavior, and modal close/back behavior.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(modals)\\sponsor-offer.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that `CLAIM OFFER ->` now renders an in-app HUD confirmation instead of a native alert popup.
- Verified that `CLOSE` and `BACK TO APP` both preserve `router.back()`.
- Verified that sponsor disclosure continues to state that YouTube player controls and ads stay untouched.

## Page 28 - `app/(modals)/qr-scanner.tsx`

### Step 1 - Write/Refactor

- Re-skinned the QR scanner modal with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the entry/exit modal header, scanner frame, QR blocks, mode chips, signed checkpoint note, and CTA into HUD surfaces.
- Preserved typed route params and the entry/exit route branches.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(modals)\\qr-scanner.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that `CLOSE` preserves `router.back()`.
- Verified that entry mode keeps `SCAN ENTRY QR - CONTINUE ->` routing to `/workout/identity-check`.
- Verified that exit mode keeps `SCAN EXIT QR - FINISH ->` routing to `/workout/complete`.
- Verified that Scan QR remains the active cyan mode while BLE Beacon remains muted.

## Page 29 - `app/(modals)/commitment-rules.tsx`

### Step 1 - Write/Refactor

- Re-skinned the commitment rules modal with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the modal header, close control, hero copy, rule rows, June draw summary, and return CTA into HUD surfaces.
- Converted commitment-rule labels and explanatory copy to uppercase terminal presentation while preserving the typed rule list.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(modals)\\commitment-rules.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that `CLOSE` preserves `router.back()` from the standard outline HUD button.
- Verified that `BACK TO COMMITMENT ->` preserves `router.back()` from the cyan primary HUD button.
- Verified that cyan rows still communicate normal commitment/verification states while pink rows communicate lock/odds emphasis.
- Verified that the June draw summary remains a dashed cyan HUD panel with entries-focused eligibility copy.

## Page 30 - `app/(modals)/bonus-rules.tsx`

### Step 1 - Write/Refactor

- Re-skinned the bonus rules modal with `ScreenContainer`, `HUDBorderBox`, `TerminalText`, `CyberButtonPrimary`, and `CyberButtonOutline`.
- Converted the modal header, close control, hero copy, multiplier cards, Period Match Bonus callout, and return CTA into HUD surfaces.
- Converted multiplier descriptions to uppercase terminal copy while preserving the typed bonus-rule list.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(modals)\\bonus-rules.tsx" "src\\components\\cyber.ts"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: page styles explicitly use `fontFamilies.display` and `fontFamilies.terminal`, with visible copy rendered through `TerminalText`.

### Step 3 - Test Mock

- Verified that `CLOSE` preserves `router.back()` from the standard outline HUD button.
- Verified that `GOT IT ->` preserves `router.back()` from the cyan primary HUD button.
- Verified that the base commitment reads `1-7 DAYS` in cyan, while true bonus values x2, x3, category podium multipliers, and x10 use pink.
- Verified that the Period Match Bonus callout states both paths: both succeed for 2x, or the matched player misses plus an extra verified workout for 3x.

## Layout 31 - `app/(tabs)/_layout.tsx`

### Step 1 - Write/Refactor

- Re-skinned the visible bottom-tab typography by mapping tab labels and glyphs to `fontFamilies.terminal`.
- Replaced the tab glyph renderer with `TerminalText` so visible tab typography flows through the shared HUD text primitive.
- Uses five visible tabs (Home, Calendar, Session, Ranks, Profile), active cyan tint, inactive muted tint, and a dark HUD tab-bar shell. Pact remains available from Home.
- Applied uppercase label styling for the tab bar while keeping the two-letter terminal glyphs.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\_layout.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: `tabBarLabelStyle` and `styles.glyph` explicitly use `fontFamilies.terminal`, and `TabGlyph` renders through `TerminalText`.

### Step 3 - Test Mock

- Verified that Home, Ranks, Workouts, Pact, and Profile remain registered in the same order.
- Verified that active tab color remains cyan, inactive tab color remains muted, and glyph typography now follows the HUD terminal font through `TerminalText`.
- Verified that the bottom tab bar remains dark with the existing cyan top border.

## Route 32 - `app/index.tsx`

### Step 1 - Write/Refactor

- Preserved the root route as a direct delegate to the completed HUD welcome page.
- Kept `/` aligned to the GoGymGo logo and `CREATE ACCOUNT ->` first-viewport onboarding entry screen.
- Avoided duplicate visual shell code in the route wrapper so the root page inherits the audited welcome screen primitives.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\index.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: this route has no local typography; it renders `WelcomeScreen`, whose typography is explicitly mapped through `fontFamilies.display` and `fontFamilies.terminal`.

### Step 3 - Test Mock

- Verified that the root route renders `WelcomeScreen` directly.
- Verified that `/` inherits the welcome page's `ScreenContainer`, terminal typography, neon HUD wordmark, and `CREATE ACCOUNT ->` navigation to `/identity`.

## Layout 33 - `app/_layout.tsx`

### Step 1 - Write/Refactor

- Registered the Cyberpunk HUD font map at the root with `expo-font`.
- Kept the root navigation shell on `colors.background` and the GoGymGo dark theme.
- Preserved hidden native headers so each page owns its HUD header and mobile shell.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\_layout.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: `useFonts` registers `Orbitron-Bold` and `ShareTechMono-Regular` before rendering the route stack.

### Step 3 - Test Mock

- Verified that the app returns `null` until fonts are loaded, preventing fallback typography flash.
- Verified that `SplashScreen.hideAsync()` still runs after successful font load.
- Verified that the root Stack preserves hidden headers for index, onboarding, tabs, workout, and modal groups.

## Layout 34 - `app/(onboarding)/_layout.tsx`

### Step 1 - Write/Refactor

- Preserved the onboarding Stack as a non-visual HUD route container.
- Kept hidden native headers and `colors.background` content styling so each onboarding page owns its `ScreenContainer` shell.
- Preserved the `welcome` initial route for the account-start flow.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(onboarding)\\_layout.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: this layout renders no local typography; child onboarding pages carry explicit Orbitron/Share Tech Mono mappings.

### Step 3 - Test Mock

- Verified that onboarding still starts at `welcome`.
- Verified that identity, creator, consents, verification, how-it-works, commitment, and entry-confirmed routes remain registered with hidden native headers.

## Layout 35 - `app/(modals)/_layout.tsx`

### Step 1 - Write/Refactor

- Preserved the modal Stack as a non-visual HUD route container.
- Kept hidden native headers, `colors.background` content styling, and slide-from-bottom modal animation.
- Preserved route registration for bonus rules, commitment rules, QR scanner, and sponsor offer.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(modals)\\_layout.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: this layout renders no local typography; modal pages carry explicit Orbitron/Share Tech Mono mappings.

### Step 3 - Test Mock

- Verified that all modal routes remain registered with hidden native headers.
- Verified that modal presentation keeps the bottom-up transition while pages provide the HUD visual shell.

## Layout 36 - `app/workout/_layout.tsx`

### Step 1 - Write/Refactor

- Preserved the workout Stack as a non-visual HUD route container.
- Kept hidden native headers and `colors.background` content styling so each workout route owns its HUD shell.
- Preserved the workout route order from check-in through completion.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\workout\\_layout.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: this layout renders no local typography; workout pages carry explicit Orbitron/Share Tech Mono mappings.

### Step 3 - Test Mock

- Verified that check-in, identity-check, active, ping, ping-success, check-out, and complete remain registered.
- Verified that workout navigation keeps slide-from-right transitions and hidden native headers.

## Layout 37 - `app/(tabs)/leaderboard/_layout.tsx`

### Step 1 - Write/Refactor

- Preserved the leaderboard nested Stack as a non-visual HUD route container.
- Kept hidden native headers and `colors.background` content styling for leaderboard and draw pages.
- Preserved the index and draw route registration.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\leaderboard\\_layout.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: this layout renders no local typography; child leaderboard pages carry explicit Orbitron/Share Tech Mono mappings.

### Step 3 - Test Mock

- Verified that leaderboard index and draw detail remain registered under the tab route.
- Verified that hidden native headers keep the HUD page headers in control.

## Layout 38 - `app/(tabs)/workouts/_layout.tsx`

### Step 1 - Write/Refactor

- Preserved the workouts nested Stack as a non-visual HUD route container.
- Kept hidden native headers and `colors.background` content styling for creator workout list and detail pages.
- Preserved dynamic `[workoutId]` route registration.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\workouts\\_layout.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: this layout renders no local typography; child workout discovery pages carry explicit Orbitron/Share Tech Mono mappings.

### Step 3 - Test Mock

- Verified that creator workout list and dynamic detail routes remain registered.

## Compliance Pass - Legal And Camera Consent Surfaces

### Step 1 - Write/Refactor

- Added centralized legal copy in `src/constants/legal.ts` for Privacy Policy, Terms of Service, Biometric / Camera Consent, account checkbox labels, and reusable biometric/camera notice copy.
- Added native legal UI in `src/components/legal.tsx` with `LegalDocumentScreen`, `LegalDocumentLinks`, `LegalConsentCheckbox`, and `BiometricCameraConsentBanner`.
- Added native modal routes for `/privacy-policy`, `/terms-of-service`, and `/biometric-camera-consent`.
- Added account-level Privacy Policy and Terms checkbox gating on the welcome screen.
- Added Biometric / Camera Notice checkbox gating on permissions, QR scanner, check-in, identity-check, random ping, and check-out screens.
- Added health/camera wording to verification setup and legal document access rows to Profile.

### Step 2 - Native Purge Audit

- Native purge command: `rg -n "window\\.alert|<div\\b|<span\\b|<button\\b|<input\\b|className=|onClick=|\\bany\\b" app src`
- TypeScript command: `npm.cmd run typecheck`

### Step 3 - Test Mock

- Browser-verified that welcome requires both account legal checkboxes before account creation can proceed.
- Browser-verified that permissions requires the Biometric / Camera Notice checkbox before continuing while the required permission toggles are on.
- Verified by static state wiring that QR scanner and Face ID checkpoint CTAs are disabled until the local Biometric / Camera Consent checkbox is checked.

## UX Correction Pass - Day-Zero Home And Session Tab

### Step 1 - Write/Refactor

- Updated `app/(tabs)/home/index.tsx` from a veteran account state to a first-run state: 1 current entry, 0 workouts this week, no rank yet, first-session messaging, and locked weekly pact copy.
- Added `app/(tabs)/session.tsx` as the center tab route that launches `/workout/check-in`.
- Updated `app/(tabs)/_layout.tsx` so Session is the visible center tab and Workouts remains reachable from Home while hidden from the bottom tab bar.

### Step 2 - Native Purge Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<a\\b' -e '<button\\b' -e '<input\\b' -e 'className=' -e 'onClick=' -e "display:\\s*'grid'" -e 'display:\\s*"grid"' -e '\\bany\\b' "app\\(tabs)\\home\\index.tsx" "app\\(tabs)\\_layout.tsx" "app\\(tabs)\\session.tsx"`
- Result: no matches.
- TypeScript command: `npm.cmd run typecheck`
- Result: passed.

### Step 3 - Test Mock

- Verified by file inspection that Home now renders a day-zero account state and that the visible Session tab routes directly into the workout check-in flow while Workouts stays accessible through Home cards.

## UX Correction Pass - Day-Zero Profile

### Step 1 - Write/Refactor

- Updated `app/(tabs)/profile/index.tsx` from a veteran profile to a first-run profile: 0-day streak, 0 verified workouts, 1 draw entry, New Member tier, no connected workout device, and payout verification deferred until needed.
- Replaced prototype-facing `RESTART DEMO - SIGN OUT` with production-facing `SIGN OUT`.

### Step 2 - Native Purge Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<a\\b' -e '<button\\b' -e '<input\\b' -e 'className=' -e 'onClick=' -e "display:\\s*'grid'" -e 'display:\\s*"grid"' -e '\\bany\\b' "app\\(tabs)\\profile\\index.tsx"`
- Result: no matches.
- TypeScript command: `npm.cmd run typecheck`
- Result: passed.

### Step 3 - Test Mock

- Verified by file inspection that Profile no longer suggests the user already has streaks, verified workouts, region rank, or completed payout setup immediately after signup.

## UX Correction Pass - Day-Zero Rank, Pact, And Gym States

### Step 1 - Write/Refactor

- Updated `app/(tabs)/leaderboard/index.tsx` so the current user appears as a new member with 1 signup entry and no rank until the first verified session.
- Updated `app/(tabs)/leaderboard/draw.tsx` so the draw screen shows the user's starter entry and removes overly technical draw wording.
- Updated `app/(tabs)/squad/index.tsx` so the weekly pact, bonus, and chat are locked until the user completes a verified workout.
- Updated `app/(tabs)/squad/gym.tsx` so the user has no gym rank yet and is prompted to scan a partner-gym entry QR for the first gym-verified session.

### Step 2 - Native Purge Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<a\\b' -e '<button\\b' -e '<input\\b' -e 'className=' -e 'onClick=' -e "display:\\s*'grid'" -e 'display:\\s*"grid"' -e '\\bany\\b' "app\\(tabs)\\leaderboard\\index.tsx" "app\\(tabs)\\leaderboard\\draw.tsx" "app\\(tabs)\\squad\\index.tsx" "app\\(tabs)\\squad\\gym.tsx"`
- Result: no matches.
- TypeScript command: `npm.cmd run typecheck`
- Result: passed.

### Step 3 - Test Mock

- Verified by file inspection that leaderboard, draw, weekly pact, and gym competition screens no longer show veteran rank, 1,240 entries, active rival chat, or completed gym standings for a new account.

## UX Correction Pass - Onboarding Legal Clarity

### Step 1 - Write/Refactor

- Updated `app/(onboarding)/welcome.tsx` to state that both legal checkboxes must be checked to enable account creation.
- Updated `src/constants/legal.ts` to remove user-facing draft, counsel, production-release, and app-store-submission language from legal documents.
- Reworded the biometric/camera consent label to a general GoGymGo verification consent rather than a repeated per-step legal sentence.

### Step 2 - Native Purge Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<a\\b' -e '<button\\b' -e '<input\\b' -e 'className=' -e 'onClick=' -e "display:\\s*'grid'" -e 'display:\\s*"grid"' -e '\\bany\\b' "app\\(onboarding)\\welcome.tsx" "src\\constants\\legal.ts"`
- Result: no matches.
- TypeScript command: `npm.cmd run typecheck`
- Result: passed.

### Step 3 - Test Mock

- Verified by file inspection that the first account screen now explains why the primary CTA is disabled and the legal modal copy no longer exposes internal launch-readiness language.

## UX Correction Pass - Verification Explicit Choice

### Step 1 - Write/Refactor

- Updated `app/(onboarding)/verification.tsx` so the primary CTA is always visible with helper text rather than disappearing until a device is linked.
- Changed partner-gym QR selection to start with no selected gym, requiring an explicit user choice before `CONTINUE WITH GYM QR ->` can proceed.

### Step 2 - Native Purge Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<a\\b' -e '<button\\b' -e '<input\\b' -e 'className=' -e 'onClick=' -e "display:\\s*'grid'" -e 'display:\\s*"grid"' -e '\\bany\\b' "app\\(onboarding)\\verification.tsx"`
- Result: no matches.
- TypeScript command: `npm.cmd run typecheck`
- Result: passed.

### Step 3 - Test Mock

- Verified by file inspection that wearable users see `CONNECT DEVICE TO CONTINUE` until a device is linked, while QR users see `SELECT GYM TO CONTINUE` until a partner gym is explicitly selected.

## UX Correction Pass - Compact Checkpoint Consent

### Step 1 - Write/Refactor

- Added compact mode to `BiometricCameraConsentBanner` in `src/components/legal.tsx`.
- Applied compact consent reminders on QR scanner, check-in, identity-check, random ping, and check-out screens while keeping full consent copy in onboarding and the legal modal.
- Replaced active-session prototype copy `SIMULATE CHECKPOINT` with `MID-SESSION CHECK` and changed the notice to a presence-check phrase.

### Step 2 - Native Purge Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<a\\b' -e '<button\\b' -e '<input\\b' -e 'className=' -e 'onClick=' -e "display:\\s*'grid'" -e 'display:\\s*"grid"' -e '\\bany\\b' "src\\components\\legal.tsx" "app\\workout\\check-in.tsx" "app\\workout\\identity-check.tsx" "app\\workout\\ping.tsx" "app\\workout\\check-out.tsx" "app\\workout\\active.tsx" "app\\(modals)\\qr-scanner.tsx"`
- Result: no matches.
- TypeScript command: `npm.cmd run typecheck`
- Result: passed.

### Step 3 - Test Mock

- Verified by file inspection that scan/checkpoint screens now show compact consent reminders and keep disabled scan CTAs until local consent is checked, without forcing users through the full legal text during time-sensitive workout steps.

## UX Correction Pass - Optional Creator Flow

### Step 1 - Write/Refactor

- Updated `app/(onboarding)/creator/invite.tsx` so the optional creator path clearly says users can continue as players and apply later from Profile.
- Made `CONTINUE AS PLAYER ->` the primary invite action while keeping Learn More, Apply as Creator, Don't Show Again, and Back available as secondary choices.
- Updated `app/(onboarding)/creator/apply.tsx` and `app/(onboarding)/creator/guidelines.tsx` to reduce repeated sponsor/payout-heavy copy and remove placeholder sponsor-brief wording.

### Step 2 - Native Purge Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<a\\b' -e '<button\\b' -e '<input\\b' -e 'className=' -e 'onClick=' -e "display:\\s*'grid'" -e 'display:\\s*"grid"' -e '\\bany\\b' "app\\(onboarding)\\creator\\invite.tsx" "app\\(onboarding)\\creator\\apply.tsx" "app\\(onboarding)\\creator\\guidelines.tsx"`
- Result: no matches.
- TypeScript command: `npm.cmd run typecheck`
- Result: passed.

### Step 3 - Test Mock

- Verified by file inspection that the creator invite no longer blocks the player path or over-emphasizes creator payout before users understand the core workout verification flow.

## UX Correction Pass - Dynamic Draw Labels

### Step 1 - Write/Refactor

- Updated welcome, commitment, entry-confirmed, commitment-rules, and sponsor-offer surfaces to use current/monthly draw labels instead of hardcoded June labels.

### Step 2 - Native Purge Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<a\\b' -e '<button\\b' -e '<input\\b' -e 'className=' -e 'onClick=' -e "display:\\s*'grid'" -e 'display:\\s*"grid"' -e '\\bany\\b' "app\\(onboarding)\\welcome.tsx" "app\\(onboarding)\\commitment.tsx" "app\\(onboarding)\\entry-confirmed.tsx" "app\\(modals)\\commitment-rules.tsx" "app\\(modals)\\sponsor-offer.tsx"`
- Result: no matches.
- TypeScript command: `npm.cmd run typecheck`
- Result: passed.

### Step 3 - Test Mock

- Verified by stale-copy scan that `JUNE`, `#142`, `1,240`, `SIMULATE`, `CSPRNG`, `BIPA-STYLE`, counsel, production-release, and app-store-submission wording no longer appears in app/source screens.
- Verified that hidden native headers keep the YouTube/sponsor HUD detail page shell intact.

## Layout 39 - `app/(tabs)/squad/_layout.tsx`

### Step 1 - Write/Refactor

- Preserved the squad nested Stack as a non-visual HUD route container.
- Kept hidden native headers and `colors.background` content styling for squad and gym competition pages.
- Preserved squad index and gym route registration.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\squad\\_layout.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: this layout renders no local typography; child squad pages carry explicit Orbitron/Share Tech Mono mappings.

### Step 3 - Test Mock

- Verified that squad index and gym competition remain registered under the tab route.
- Verified that hidden native headers keep the HUD page headers in control.

## Layout 40 - `app/(tabs)/profile/_layout.tsx`

### Step 1 - Write/Refactor

- Preserved the profile nested Stack as a non-visual HUD route container.
- Kept hidden native headers and `colors.background` content styling for the profile page.
- Preserved profile index route registration.

### Step 2 - Native Purge & Types Audit

- Native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' "app\\(tabs)\\profile\\_layout.tsx"`
- Result: no matches.
- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Font audit: this layout renders no local typography; the profile page carries explicit Orbitron/Share Tech Mono mappings.

### Step 3 - Test Mock

- Verified that the profile index route remains registered under the tab route.
- Verified that hidden native headers keep the HUD profile page shell in control.

## Cumulative Route-Tree Gate

- TypeScript command: `npx.cmd tsc --noEmit`
- Result: pass.
- Global native purge command: `rg -n -e '<div\\b' -e '<span\\b' -e '<button\\b' -e 'className=' -e 'onClick=' -e '\\bany\\b' app src`
- Result: no matches.
- Route coverage check: every file returned by `rg --files app` is referenced in this audit.
- Raw app text check: `rg -n "import \\{[^}]*\\bText\\b|<Text\\b" app`
- Result: no matches.
- Font-weight check: `rg -n "fontWeight" app src`
- Result: no matches.
- Hard-coded font-family bypass check: `rg --pcre2 -n 'fontFamily:\\s*["''](?!Orbitron-Bold|ShareTechMono-Regular)' app src`
- Result: no matches.
- Font asset check: `assets/fonts/Orbitron-Bold.ttf` and `assets/fonts/ShareTechMono-Regular.ttf` are present.

## UX Correction Pass - Flow Clarity And Plain Language

### Step 1 - Write/Refactor

- Normalized core onboarding to a four-step sequence across Public Identity, Permissions, Verification, and Commitment.
- Reframed Creator Guidelines, Creator Application, Creator selection, and How It Works as optional supporting screens.
- Replaced the Session tab redirect with a Cyber HUD choice screen for Heart-rate Session or Partner Gym QR Session.
- Updated first-workout completion state to show first verified session progress instead of week-two partner demo data.
- Simplified Profile settings, Draw odds language, sponsor copy on check-in/check-out, creator workout CTA copy, and shorthand labels.
- Updated `docs/GoGymGo_PRD.md` to reflect the current UI flow, sponsor priority, Session choice, profile entry points, and completion state.

### Step 2 - Native Purge Audit

- File-level purge scans were run after each modified screen or UI file using the web-tag/grid/`any` search pattern.
- Targeted stale-copy scan: `rg -n "\b(HR|SRCH|PAY|CR|NT|PR|TS|BC|PPG|BLE)\b|STEP 0[1-9] / 05|STEP 02A|JAX_540|OF ELIGIBLE WIN|JOIN & START WORKOUT|FUEL THE GRIND|TAP OFFER" app --glob "*.tsx"`
- Result: no app-screen matches.

### Step 3 - Test Mock

- Verified by file inspection that onboarding keeps creator recruitment to one compact Apply as a Creator action, Session exposes both verification starts, Profile routes Creator Workouts to the workout list, Draw avoids guaranteed-odds language, and workout completion matches a day-zero first-session state.

## UX Correction Pass - First-Workout Creator Invitation

### Step 1 - Write/Refactor

- Removed the standalone creator-pitch interruption from onboarding; its legacy route now forwards to the training-path page.
- Added one compact Apply as a Creator button to the training-path page.
- Routed the first successful verified-workout completion to Creator Details only when the user has not already applied or dismissed the prompt.
- Replaced Continue as Player on Creator Details with a highlighted Don't Show This Again action below Apply as a Creator.
- Kept Creator Details explicitly reachable from Profile and prevented manual calendar logs from triggering the prompt.

### Step 2 - Native And Route Audit

- Confirmed the changed screens remain React Native-only and contain no web tags, `className`, `onClick`, or `any` types.
- Confirmed `/creator/invite` forwards to `/creator`, `/creator/guidelines?source=first-workout` renders both required actions, and all literal routes remain valid.

### Step 3 - Test Mock

- Verified the compact training-path page contains exactly one Apply as a Creator action.
- Verified the detailed first-workout prompt orders Apply as a Creator first and the highlighted Don't Show This Again action second.

## UX Correction Pass - Condensed Session Choice

### Step 1 - Write/Refactor

- Removed creator training selection from onboarding and routed Public Identity directly to Permissions.
- Replaced the creator-selection route with a compatibility redirect to Session.
- Condensed Session to two actions only: Follow Along With a Creator and Start My Own Workout.
- Moved Heart-rate Device versus Partner Gym QR into a separate workout-verification method screen reached after workout type is chosen.
- Routed creator workout starts through the same verification-method screen so both creator-led and self-directed workouts retain both approved verification paths.

### Step 2 - Native And Route Audit

- Confirmed the new Session and workout-method screens use React Native components and centralized theme tokens only.
- Confirmed the compatibility creator routes, Creator Workouts list, creator detail start action, heart-rate check-in, and partner-gym QR routes remain connected.

### Step 3 - Test Mock

- Verified Session renders exactly two workout choices and no creator list, application action, verification note, or extra back button.
- Verified Start My Own Workout opens verification-method selection and Follow Along With a Creator opens regional Creator Workouts.

## UX Correction Pass - Perfect Month And Category Winners

### Step 1 - Write/Refactor

- Renamed Standard Perfect Month to Perfect Month and added the compact note that the base example excludes match and category winner bonuses.
- Updated the 10x explanation across Commitment, How Scoring Works, Bonus Rules, and Commitment Rules to include 2x/3x match bonuses and earned category winner bonuses.
- Added campaign-driven first-, second-, and third-place commitment-category calculations to the Commitment panel using the current `3x`, `2x`, and `1.5x` settings.
- Reordered the calculator into a visible ladder: weekly base, match bonuses, category winner multipliers, then perfect-month 10x as the final monthly multiplier.
- Replaced the expanded twelve-scenario wall with an interactive calculator using segmented match/category controls, a perfect-month toggle, and a zero-to-three month-end-day selector.
- Replaced user-facing Category Podium Boost language with Category Winner Multipliers across rules, leaderboards, prize draw, and sponsor facts.

### Step 2 - Calculation And Source Audit

- Confirmed `calculateFinalPrizeDrawWeight` applies category multipliers to the actual match-adjusted four-period subtotal, adds eligible remainder-day entries, applies perfect-month 10x last, then adds the signup entry as flat weight.
- Confirmed category values remain sponsor-campaign configuration rather than hardcoded screen constants.
- Confirmed changed screens contain no web tags, `className`, `onClick`, inline font families, or `any` types.

### Step 3 - Test Mock

- Verified a four-day selection covers all `1x`, `2x`, and `3x` four-period totals across no-category, first, second, and third category outcomes. The `2x`/first-place path displays `32 x 3 = 96`, then `96 x 10 = 960`.
- Verified a seven-day selection uses `28`, `56`, and `84` as its three possible all-period match totals and applies every configured category/perfect-month combination.
- Verified the interactive four-day path `2x match`, `1st category`, `perfect month on`, and `0 remainder days` displays a projected prize draw weight of `960`; adding two remainder days now produces `(96 + 2) x 10 = 980`.
- Verified How Scoring Works and the full rules repeat the same current multiplier values and calculation order.
## July 12, 2026 UX And Data-State Pass

- Added a required Competition Region onboarding step and Profile editor. Region now owns the local competition label, sponsor resolution and IANA time zone instead of relying on a hardcoded Toronto string.
- Removed the cosmetic `NEW MEMBER` status badge. Profile now uses that space for functional region and exact verification-source information.
- Persisted the exact selected watch, strap, phone source or partner gym. Profile and the workout-method screen display the saved label, and Profile editing returns to Profile.
- Calendar uses practice language before a competition begins and does not call pre-start verified sessions competition credit.
- Creator discovery uses one heading, one compact explanation, one campaign payout panel, and `LOCKED` for unavailable cards. Creator detail puts the verified-session CTA directly below the video and removes internal implementation terminology.
- Prize Draw uses pink only for confirmed reward value. An unconfirmed pool is one amber pending state; potential category boosts are separated from earned entry progress.
- Period Match removes the duplicated pre-start panel and false relative timing.
- Winners Circle is gated on settled results. Demo results are labeled as samples; production empty states do not reveal fixture names or payouts.
- Mock content is isolated behind `src/data/appData.ts`. Production-facing screens no longer import mock files directly, and simulated heart-rate telemetry is explicitly labeled in preview mode.
