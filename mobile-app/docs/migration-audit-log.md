# GoGymGo Expo Router Page Migration Audit

## 1. `app/_layout.tsx`

### WRITE
- Created the root Expo Router layout.
- Added the app-wide dark navigation theme using the GoGymGo cyan/pink palette from the prototype.
- Wrapped routing with `GestureHandlerRootView`, `SafeAreaProvider`, `ThemeProvider`, `StatusBar`, and the root `Stack`.
- Registered the planned route groups: `(onboarding)`, `(tabs)`, `workout`, and `(modals)`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses `StyleSheet` with `flex: 1`; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: launch the app with `npm.cmd start`, confirm the root stack starts at `(onboarding)`, verify the status bar is light on the dark GoGymGo shell, and confirm modal routes under `(modals)` present with modal animation when linked.

## 2. `app/+not-found.tsx`

### WRITE
- Created a native fallback route for unfinished or mistyped paths.
- Used `useRouter` with a `Pressable` to return users to the onboarding start.
- Kept the message in the GoGymGo system/panel visual language.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native flex alignment and spacing; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open an unknown route, tap `BACK TO START ->`, and verify `useRouter().replace('/welcome')` returns to the onboarding start once `welcome.tsx` is present.

## 3. `app/(onboarding)/_layout.tsx`

### WRITE
- Created the onboarding stack layout for the account setup flow.
- Registered the prototype's onboarding sequence: welcome, identity, creator, creator guidelines, creator application, consents, verification, how it works, commitment, and entry confirmation.
- Kept stack headers hidden so each screen can use the GoGymGo custom mobile chrome.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. This file only configures native stack navigation and does not use CSS Grid or web positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: launch the app, confirm the onboarding stack resolves to `welcome`, then navigate forward page by page and verify headers remain hidden for the custom GoGymGo screen shell.

## 4. `app/(onboarding)/welcome.tsx`

### WRITE
- Converted the prototype welcome screen into a native React Native page.
- Preserved the opening sponsor banner, `SYSTEM ONLINE // ENTRY OPEN` pill, GoGymGo wordmark, three-step value loop, `1 FREE ENTRY` panel, and two account actions.
- Used Expo Router navigation: `CREATE ACCOUNT ->` pushes to `/identity`; `I ALREADY HAVE AN ACCOUNT` replaces to `/` for the future tabbed home route.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses `View`, `ScrollView`, `Text`, `Pressable`, flex direction, gaps, padding, and native borders; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: launch the app, verify the welcome screen fits within a phone viewport, tap `CREATE ACCOUNT ->` and confirm it routes to `/identity` once that page exists, then tap `I ALREADY HAVE AN ACCOUNT` and confirm it returns to the tabbed home route once `(tabs)/index.tsx` exists.

## 5. `app/(onboarding)/identity.tsx`

### WRITE
- Converted the public identity setup screen into a native React Native form.
- Preserved the step header, username progress state, anonymous/public alias/real name choices, generated callsign with shuffle, conditional text inputs, privacy note, continue action, and back action.
- Used Expo Router navigation: `CONTINUE ->` pushes to `/creator`; `BACK` calls `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native `View`, `ScrollView`, `Text`, `TextInput`, `Pressable`, and flex layouts; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: tap each identity radio row and confirm only one state is active, verify `SHUFFLE` changes the anonymous callsign, enter alias/name text in their respective modes, tap `CONTINUE ->` and verify it routes to `/creator`.

## 6. `app/(onboarding)/creator/index.tsx`

### WRITE
- Converted the creator selection screen into a native React Native page.
- Preserved the step header, creator application card, `LEARN MORE`, `APPLY AS CREATOR ->`, solo workout option, verified creator options, follower counts, continue, skip, and back actions.
- Used Expo Router navigation: learn more routes to `/creator/guidelines`, apply routes to `/creator/apply`, and continue/skip route to `/consents`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Replaced the prototype's grid button area with a native vertical flex stack; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: select solo and each creator row to confirm active state changes, tap `LEARN MORE` and verify routing to `/creator/guidelines`, tap `APPLY AS CREATOR ->` and verify routing to `/creator/apply`, then tap `CONTINUE ->` and verify routing to `/consents`.

## 7. `app/(onboarding)/creator/guidelines.tsx`

### WRITE
- Converted the creator upload guidelines screen into a native React Native page.
- Preserved the `STEP 02A / 05` guide state, four guideline rows, cyan/pink category emphasis, application CTA, and back action.
- Used Expo Router navigation: `APPLY AS CREATOR ->` routes to `/creator/apply`; `BACK` calls `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses vertical native flex layout and row cards; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: verify all four guideline rows render in order, tap `APPLY AS CREATOR ->` and confirm routing to `/creator/apply`, then tap `BACK` and confirm return to the creator choice screen.

## 8. `app/(onboarding)/creator/apply.tsx`

### WRITE
- Converted the creator application screen into a native React Native page.
- Preserved the application copy, four submission/review/reward steps, sponsor brief slot, apply CTA, continue-as-player action, and back action.
- Used Expo Router navigation: `APPLY AS CREATOR ->` and `CONTINUE AS PLAYER` route to `/consents`; `BACK` calls `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native vertical and row flex layouts; the sponsor brief label was adapted into normal flow instead of web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: verify the sponsor brief slot appears below the four application steps, tap `APPLY AS CREATOR ->` and confirm routing to `/consents`, tap `CONTINUE AS PLAYER` and confirm the same route, then tap `BACK` and confirm return to the prior creator screen.

## 9. `app/(onboarding)/consents.tsx`

### WRITE
- Converted the permissions screen into a native React Native page.
- Preserved the step header, permissions explanation, identity/workout/region/sponsor consent rows, default enabled states, native switches, allow/continue action, and back action.
- Used Expo Router navigation: `ALLOW & CONTINUE ->` routes to `/verification`; `BACK` calls `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Switch knobs use flex alignment instead of absolute positioning; no CSS Grid or web positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: toggle each permission and confirm switch state changes, tap `ALLOW & CONTINUE ->` and verify routing to `/verification`, then tap `BACK` and confirm return to the creator page.

## 10. `app/(onboarding)/verification.tsx`

### WRITE
- Converted the verification method screen into a native React Native page.
- Preserved the heart-rate device vs partner gym QR selector, searchable device catalog, connect/linked states, more-devices expansion, QR explanation, partner gym selection, conditional continue CTA, and back action.
- Used Expo Router navigation: the continue CTA routes to `/how-it-works`; `BACK` calls `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native row/column flex layouts for method cards, device rows, gym rows, and search; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: select `Heart-rate device`, search for `Garmin`, connect a device and confirm the CTA appears; switch to `Partner gym QR`, select each gym and confirm selected state changes, then tap the CTA and verify routing to `/how-it-works`.

## 11. `app/(onboarding)/how-it-works.tsx`

### WRITE
- Converted the loop explanation screen into a native React Native page.
- Preserved the three-step explanation, pairing bonus language, collapsible bonus rules, `DON'T SHOW ME AGAIN`, primary commitment CTA, and back action.
- Used Expo Router navigation: the primary CTA routes to `/commitment`; `DON'T SHOW ME AGAIN` replaces to `/commitment`; `BACK` calls `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native vertical and row flex layouts; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: tap `VIEW BONUS RULES` and confirm the rule rows expand, tap it again and confirm they collapse, tap `DON'T SHOW ME AGAIN` and verify replacement navigation to `/commitment`, then use the primary CTA to verify push navigation to `/commitment`.

## 12. `app/(onboarding)/commitment.tsx`

### WRITE
- Converted the commitment screen into a native React Native page.
- Preserved the weekly day selector, live days/week display, perfect-month entries calculation, June draw summary, commitment copy, collapsible bonus rules, lock CTA, and back action.
- Used Expo Router navigation: `LOCK COMMITMENT ->` routes to `/entry-confirmed`; `BACK` calls `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native flex rows for the day picker, draw summary, and rule rows; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: tap days 1 through 7 and confirm the selected state and perfect-month entries update, expand and collapse `VIEW BONUS RULES`, tap `LOCK COMMITMENT ->` and verify routing to `/entry-confirmed`.

## 13. `app/(onboarding)/entry-confirmed.tsx`

### WRITE
- Converted the entry confirmation screen into a native React Native page.
- Preserved the confirmed-entry state, June draw copy, entry/bonus/day-goal stat cards, and `ENTER GOGYMGO ->` CTA.
- Used Expo Router navigation: `ENTER GOGYMGO ->` replaces to `/`, which will resolve to the tabbed home route once `(tabs)/index.tsx` is migrated.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Replaced animated absolute web rings with nested native circular `View` elements; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: verify the confirmation panel centers in a phone viewport, confirm stats read `1 ENTRY`, `0 BONUS ENTRIES`, and `4 DAY GOAL`, then tap `ENTER GOGYMGO ->` and verify replacement navigation to the tabbed home route once it exists.

## 14. `app/(tabs)/_layout.tsx`

### WRITE
- Created the native Expo Router tab layout for the signed-in app shell.
- Registered the five primary tabs: Home, Ranks, Workouts, Pact, and Profile.
- Added compact text glyphs that match the prototype's technical GoGymGo tab style without using web markup.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. This file configures native tab navigation and tab bar styling; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: launch the app after tab screens exist, verify the bottom tab bar shows Home, Ranks, Workouts, Pact, and Profile, then tap each tab and confirm Expo Router switches route groups without showing native headers.

## 15. `app/(tabs)/index.tsx`

### WRITE
- Converted the signed-in home dashboard into a native React Native tab screen.
- Preserved the welcome header, avatar state, sponsor app-open slot, weekly commitment progress, start session CTA, entries stats, monthly odds note, rival pact preview, creator workout preview, and creator workouts CTA.
- Used Expo Router navigation: start session routes to `/workout/check-in`, pact preview routes to `/squad`, creator workout routes to `/workouts/toronto-creator-workout`, and the workouts CTA routes to `/workouts`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native scroll, row, and column flex layouts; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: verify the home tab scrolls cleanly with the bottom tab bar visible, tap `START 30-MIN SESSION` and confirm route to `/workout/check-in`, tap the rival pact card and confirm route to `/squad`, then tap `VIEW CREATOR WORKOUTS ->` and confirm route to `/workouts`.

## 16. `app/(tabs)/leaderboard/_layout.tsx`

### WRITE
- Created the leaderboard nested stack inside the Ranks tab.
- Registered the leaderboard index route and draw detail route.
- Kept native headers hidden so each screen can use the GoGymGo custom chrome.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. This file only configures native stack routing; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open the Ranks tab, verify the leaderboard index loads without a native header, then navigate to `/leaderboard/draw` and confirm the nested stack transition keeps the tab bar context.

## 17. `app/(tabs)/leaderboard/index.tsx`

### WRITE
- Converted the regional ranks leaderboard into a native React Native tab screen.
- Preserved the regional header, tier badge, current user rank card, tier progress, top-period rows, estimated odds, draw CTA, and back action.
- Used Expo Router navigation: the draw card routes to `/leaderboard/draw`; `BACK` routes to `/`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native row/column flex layouts for rank cards and leaderboard rows; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open the Ranks tab, verify the user card and five leaderboard rows render, tap `View the June draw ->` and confirm navigation to `/leaderboard/draw`, then tap `BACK` and confirm route to the Home tab.

## 18. `app/(tabs)/leaderboard/draw.tsx`

### WRITE
- Converted the June regional draw screen into a native React Native page.
- Preserved the prize pool panel, winner/value/odds stat cards, weighted-random odds explainer, signup/monthly entries progress rows, audit timing copy, and payout verification note.
- Used Expo Router navigation: the back glyph calls `router.back()` to return to the leaderboard stack.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Replaced web corner accents and absolute positioning with native bordered panels and flex progress rows; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: navigate from `/leaderboard` to `/leaderboard/draw`, verify the prize pool, odds progress rows, and payout note render, then tap the back glyph and confirm return to `/leaderboard`.

## 19. `app/(tabs)/squad/_layout.tsx`

### WRITE
- Created the nested Pact tab stack for weekly rival pact and gym competition screens.
- Registered the squad index route and gym competition route.
- Kept headers hidden for the custom GoGymGo screen chrome.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. This file only configures native stack routing; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open the Pact tab, confirm the squad screen loads without a native header, navigate to `/squad/gym`, and verify the nested stack keeps the bottom tab context.

## 20. `app/(tabs)/squad/index.tsx`

### WRITE
- Converted the weekly rival pact screen into a native React Native tab screen.
- Preserved the matchup status, both athletes' weekly progress, pairing bonus note, forfeited bonus entries panel, text-only pact chat, fake encouragement input, gym competition CTA, and back action.
- Used Expo Router navigation: `VIEW GYM COMPETITION ->` routes to `/squad/gym`; `BACK` routes to `/`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native row/column flex layouts for matchup, chat, and CTA areas; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open the Pact tab, verify player progress and chat bubbles render, tap `VIEW GYM COMPETITION ->` and confirm route to `/squad/gym`, then tap `BACK` and confirm route to Home.

## 21. `app/(tabs)/squad/gym.tsx`

### WRITE
- Converted the gym competition screen into a native React Native page.
- Preserved the back/header row, gym presence verification card, QR/Beacon verification modes, signed time-bound requirement copy, and gym leaderboard rows.
- Used Expo Router navigation: the back glyph calls `router.back()` to return to the Pact screen.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Replaced web QR scan animation and absolute scan line with a native static QR panel; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: navigate from `/squad` to `/squad/gym`, verify the QR card and three gym leaderboard rows render, then tap the back glyph and confirm return to `/squad`.

## 22. `app/(tabs)/workouts/_layout.tsx`

### WRITE
- Created the nested Workouts tab stack for creator workout discovery and detail screens.
- Registered the workouts index route and dynamic workout detail route.
- Kept headers hidden for the custom GoGymGo screen chrome.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. This file only configures native stack routing; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open the Workouts tab, verify the creator workouts index loads without a native header, navigate to a workout detail route, and confirm the tab bar context remains.

## 23. `app/(tabs)/workouts/index.tsx`

### WRITE
- Converted the creator workout discovery screen into a native React Native tab screen.
- Preserved the creator workouts header, official-channel info note, sponsor payout slot, three workout cards, joined/join states, sponsor/reward metadata, and back action.
- Used Expo Router navigation: each workout card routes to `/workouts/[workoutId]`; `BACK` routes to `/`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Replaced the web video-card absolute badges with native flow badges and flex rows; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open the Workouts tab, verify all three workout cards render, tap the featured Toronto creator workout and confirm navigation to `/workouts/toronto-creator-workout`, then tap `BACK` and confirm route to Home.

## 24. `app/(tabs)/workouts/[workoutId].tsx`

### WRITE
- Converted the creator workout detail screen into a native React Native dynamic route.
- Preserved the creator header, YouTube player-safe zone, sponsor card outside the player, creator selection explanation, user reward/creator payout cards, official rules, and join/start CTA.
- Used Expo Router navigation: the back glyph calls `router.back()`; `JOIN & START WORKOUT ->` routes to `/workout/check-in`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Replaced web absolute player labels and sponsor positioning with native flow layout; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: navigate to `/workouts/toronto-creator-workout`, verify the YouTube player placeholder and sponsor safe-zone card remain separate, tap `JOIN & START WORKOUT ->` and confirm routing to `/workout/check-in`, then tap the back glyph and confirm return to Workouts.

## 25. `app/(tabs)/profile/_layout.tsx`

### WRITE
- Created the nested Profile tab stack.
- Registered the profile index route.
- Kept native headers hidden for the custom GoGymGo profile screen.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. This file only configures native stack routing; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open the Profile tab and verify the profile index route loads without a native header while staying inside the tab bar shell.

## 26. `app/(tabs)/profile/index.tsx`

### WRITE
- Converted the profile/settings screen into a native React Native tab screen.
- Preserved the avatar, tier/rank badge, streak/verified/perfect-month stats, public identity segmented control, payout/device/following/creator-status/notification rows, restart demo action, and back action.
- Used Expo Router navigation: following routes to `/creator`, creator status routes to `/creator/apply`, restart demo replaces to `/welcome`, and `BACK` routes to `/`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native scroll, row, segmented-control, and settings-list layouts; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open the Profile tab, switch between PRIVATE/ALIAS/REAL and confirm selected state changes, tap Creator status and confirm routing to `/creator/apply`, tap `RESTART DEMO - SIGN OUT` and confirm replacement navigation to `/welcome`.

## 27. `app/workout/_layout.tsx`

### WRITE
- Created the workout session nested stack.
- Registered check-in, identity check, active session, random ping, ping success, checkout, and completion routes.
- Kept native headers hidden for the custom GoGymGo session screens.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. This file only configures native stack routing; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/workout/check-in`, step through the workout stack routes, and verify each transition stays inside the custom full-screen workout shell with no native headers.

## 28. `app/workout/check-in.tsx`

### WRITE
- Converted the workout check-in screen into a native React Native page.
- Preserved the session step label, check-in sponsor slot, Face ID checkpoint panel, privacy copy, and start CTA.
- Used Expo Router navigation: the back glyph routes to `/`; `SCAN FACE ID ->` routes to `/workout/active`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Replaced animated absolute scan frame with a native bordered panel; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/workout/check-in`, verify sponsor and Face ID copy render, tap `SCAN FACE ID ->` and confirm navigation to `/workout/active`, then use the back glyph and confirm route to Home.

## 29. `app/workout/identity-check.tsx`

### WRITE
- Converted the post-QR identity confirmation screen into a native React Native page.
- Preserved the `IDENTITY - 2 OF 4` step label, Face ID confirmation panel, gym QR identity copy, primary continue CTA, and back action.
- Used Expo Router navigation: the back glyph calls `router.back()`; `CONTINUE TO SESSION ->` routes to `/workout/active`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Replaced animated absolute scan frame with a native bordered panel; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/workout/identity-check`, verify the identity copy renders, tap `CONTINUE TO SESSION ->` and confirm routing to `/workout/active`, then tap the back glyph and confirm return to `/workout/check-in`.

## 30. `app/workout/active.tsx`

### WRITE
- Converted the active session screen into a native React Native page.
- Preserved the live timer, 30-minute eligibility gate, progress bar, heart-rate/elevated-minute cards, random checkpoint action, session-end confirmation, and back action.
- Used Expo Router navigation: checkpoint routes to `/workout/ping`, the unlocked finish CTA routes to `/workout/check-out`, ending routes to `/`, and back routes to `/workout/check-in`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native flex rows, cards, and progress view composition; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/workout/active`, verify the timer increments and progress fills, confirm the finish CTA is locked before 30:00, tap `SIMULATE CHECKPOINT` and confirm navigation to `/workout/ping`, then tap `END SESSION` and verify the keep/end confirmation appears.

## 31. `app/workout/ping.tsx`

### WRITE
- Converted the random ping interruption into a native React Native page.
- Preserved the pink warning state, grace countdown, Face ID verification CTA, and return-to-session action.
- Used Expo Router navigation: `VERIFY FACE ID ->` routes to `/workout/ping-success`; back returns to `/workout/active`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses centered native flex layout and circular timer views; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/workout/ping`, verify the grace countdown decreases, tap `VERIFY FACE ID ->` and confirm navigation to `/workout/ping-success`, then return and tap `BACK TO SESSION` to confirm routing to `/workout/active`.

## 32. `app/workout/ping-success.tsx`

### WRITE
- Converted the checkpoint success confirmation into a native React Native page.
- Preserved the cyan success mark, checkpoint confirmation label, eligibility copy, and return CTA.
- Used Expo Router navigation: `BACK TO SESSION ->` routes to `/workout/active`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses centered native flex layout; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/workout/ping-success`, verify the confirmation message renders, then tap `BACK TO SESSION ->` and confirm navigation to `/workout/active`.

## 33. `app/workout/check-out.tsx`

### WRITE
- Converted the final checkout checkpoint into a native React Native page.
- Preserved the checkout step label, sponsor area, final checkpoint copy, workout metrics, finish CTA, and back action.
- Used Expo Router navigation: `SCAN FACE ID - FINISH ->` routes to `/workout/complete`; back routes to `/workout/active`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native sponsor card, metric row, and centered content layout; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/workout/check-out`, verify the sponsor slot and three metrics render, tap `SCAN FACE ID - FINISH ->` and confirm navigation to `/workout/complete`, then return and tap back to confirm routing to `/workout/active`.

## 34. `app/workout/complete.tsx`

### WRITE
- Converted the session completion screen into a native React Native page.
- Preserved the verified-session state, `+10 entries` reward copy, 2x partner bonus message, week progress card, and home CTA.
- Used Expo Router navigation: `BACK TO HOME ->` routes to `/`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses centered native flex layout and progress bars; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/workout/complete`, verify the `+10 entries` reward, partner bonus copy, and 4 / 4 progress render, then tap `BACK TO HOME ->` and confirm routing to Home.

## 35. `app/(modals)/_layout.tsx`

### WRITE
- Created the modal route stack.
- Registered bonus rules, commitment rules, QR scanner, and sponsor offer modal routes.
- Kept native headers hidden so each modal can render its own GoGymGo-styled chrome.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. This file only configures native stack routing; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: open `/bonus-rules`, `/commitment-rules`, `/qr-scanner`, and `/sponsor-offer` once content pages exist, then verify each renders as a modal route without a native header.

## 36. `app/(modals)/bonus-rules.tsx`

### WRITE
- Converted the bonus rules panel into a native React Native modal route.
- Clarified base commitment as `1-7 DAYS`; preserved x2, x3, and x10 as actual bonus language plus the pairing-bonus explanation.
- Used Expo Router navigation: both close actions call `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native scroll, rules cards, and callout layout; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/bonus-rules`, verify all four bonus rows and pairing copy render, then tap `CLOSE` and `GOT IT ->` in separate visits to confirm both dismiss the modal.

## 37. `app/(modals)/commitment-rules.tsx`

### WRITE
- Converted commitment rules into a native React Native modal route.
- Preserved the commitment lock, verified session, draw entries, and perfect-month rule intent from the commitment flow.
- Used Expo Router navigation: close and primary actions call `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native scroll, rule rows, and summary card layout; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/commitment-rules`, verify all four commitment rule rows and the June draw summary render, then tap `CLOSE` and `BACK TO COMMITMENT ->` in separate visits to confirm both dismiss the modal.

## 38. `app/(modals)/qr-scanner.tsx`

### WRITE
- Converted the partner gym QR scanner state into a native React Native modal route.
- Preserved entry and exit QR language, signed/time-bound QR note, scan QR versus BLE beacon options, and the QR visual frame.
- Used Expo Router navigation: default scan routes to `/workout/identity-check`; `mode=exit` routes to `/workout/complete`; close calls `router.back()`.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native flex wrapping for the QR mark and native row layout for scan modes; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/qr-scanner`, verify entry QR copy and scan modes render, tap the primary CTA and confirm routing to `/workout/identity-check`; then route to `/qr-scanner?mode=exit`, verify exit copy, tap the CTA, and confirm routing to `/workout/complete`.

## 39. `app/(modals)/sponsor-offer.tsx`

### WRITE
- Converted sponsor offer details into a native React Native modal route.
- Preserved VOLT sponsor identity, offer code, prize-pool funding context, creator payout support, and YouTube-safe disclosure.
- Used Expo Router navigation: close/back actions call `router.back()`; claim action shows a native saved-offer alert.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Uses native scroll, hero card, fact rows, and disclosure card layout; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for this file: route to `/sponsor-offer`, verify VOLT offer details and disclosure render, tap `CLAIM OFFER ->` and confirm the in-app HUD saved confirmation appears, then tap `CLOSE` or `BACK TO APP` and confirm the modal dismisses.

## 40. Modal Wiring Re-Audit

### WRITE
- Updated `app/(onboarding)/how-it-works.tsx` so `VIEW BONUS RULES` opens `/bonus-rules`.
- Updated `app/(onboarding)/commitment.tsx` so `VIEW COMMITMENT RULES` opens `/commitment-rules`.
- Updated `app/(tabs)/index.tsx`, `app/(tabs)/workouts/[workoutId].tsx`, `app/workout/check-in.tsx`, and `app/workout/check-out.tsx` so primary sponsor cards open `/sponsor-offer`.
- Updated `app/(tabs)/squad/gym.tsx` so the QR verification card opens `/qr-scanner`.

### AUDIT
- Web tag leakage: passed across all touched files. No `<div>`, `<span>`, or `<button>` tags.
- Flexbox layout integrity: passed. Only native `Pressable` wiring changed; no CSS Grid or web absolute positioning.
- Strict TypeScript: passed. No `any`; `npm.cmd run typecheck` completed successfully.

### TEST MOCK
- Manual check for these files: tap each rules, sponsor, and QR entry point and confirm it opens the corresponding Expo Router modal route; dismiss the modal and verify the originating screen remains usable.

## 41. Expo Bundle Verification

### WRITE
- Updated `babel.config.js` for Expo SDK 51 by removing the deprecated `expo-router/babel` plugin and keeping `react-native-reanimated/plugin`.

### AUDIT
- Expo Android export initially failed on the deprecated Babel plugin.
- After the config update, `npx.cmd expo export --platform android --output-dir .expo-export-check` completed successfully.
- Temporary `.expo-export-check` output was removed after verification.

### TEST MOCK
- Manual check for this project config: run the Android export command and verify Metro bundles `expo-router/entry.js` and writes the Android bundle without Babel errors.

## 42. Brand Video Ad Placeholder Surfaces

### WRITE
- Added `src/components/sponsor.tsx` with a reusable `BrandVideoAdPlaceholder` component built from native React Native primitives and the existing cyber HUD design system.
- Added brand video ad placeholders for signed-in app open, leaderboard view, workout start check-in, and verified workout completion.
- Kept each placeholder wired to `/sponsor-offer` so brand creative, offer detail, and future impression tracking have a single current destination.
- Made the workout check-in surface scroll-safe so the start-video slot, biometric consent, and CTA can fit on smaller devices.

### AUDIT
- Web tag leakage: passed. No `<div>`, `<span>`, `<button>`, `className`, `onClick`, or `any` matches in touched files.
- Placement coverage: passed. `APP OPEN`, `LEADERBOARD`, `WORKOUT START`, and `WORKOUT COMPLETE` slots are all present through `BrandVideoAdPlaceholder`.
- Strict TypeScript: passed. `npm.cmd run typecheck` completed successfully.
- Expo bundle smoke test: passed. `npx.cmd expo export --platform android --output-dir .expo-export-check` bundled `expo-router/entry.js` successfully; temporary export output was removed after verification.

### TEST MOCK
- Manual check for these files: after sign-in/home, leaderboard, workout check-in, and workout completion, verify each video ad placeholder renders with the correct placement label and opens `/sponsor-offer` when tapped.
