# GoGymGo Compliance Implementation Audit

## Scope

This audit maps the current Expo Router app to the North American privacy and biometric/camera touchpoints needed before production legal review. It is not legal advice. The implementation adds mobile-friendly disclosures and native consent controls for US and Canada readiness, including CCPA/CPRA-style privacy rights, PIPEDA meaningful consent expectations, and BIPA-style biometric/camera safeguards.

## Architecture Map

- `app/(onboarding)/welcome.tsx`: account-start page, Privacy Policy modal access, Terms of Service modal access, required account-level checkboxes.
- `app/(onboarding)/consents.tsx`: Identity check, Workout data, Region permissions, Privacy/Terms access, required Biometric / Camera Notice checkbox.
- `app/(onboarding)/verification.tsx`: heart-rate, HealthKit/Health Connect, wearable, partner-gym QR, and phone-camera PPG verification setup copy.
- `app/(modals)/privacy-policy.tsx`: native Privacy Policy modal.
- `app/(modals)/terms-of-service.tsx`: native Terms of Service modal.
- `app/(modals)/biometric-camera-consent.tsx`: native Biometric / Camera Consent modal.
- `app/(modals)/qr-scanner.tsx`: temporary QR camera view, required camera consent checkbox before scan CTA.
- `app/workout/check-in.tsx`: session-start Face ID/local biometric check, required consent checkbox before scan CTA.
- `app/workout/identity-check.tsx`: partner-gym QR identity confirmation, required consent checkbox before continue CTA.
- `app/workout/ping.tsx`: random mid-session Face ID/local biometric ping, required consent checkbox before ping CTA.
- `app/workout/check-out.tsx`: final Face ID/local biometric checkpoint, required consent checkbox before finish CTA.
- `app/(tabs)/profile/index.tsx`: post-onboarding access to Privacy Policy, Terms of Service, and Biometric / Camera Consent.

## Centralized Legal Components

- `src/constants/legal.ts` defines the Privacy Policy, Terms of Service, Biometric / Camera Consent, account checkbox labels, and reusable biometric/camera notice copy.
- `src/components/legal.tsx` defines `LegalDocumentScreen`, `LegalDocumentLinks`, `LegalConsentCheckbox`, and `BiometricCameraConsentBanner`.
- Legal screens use React Native `ScrollView`, `View`, `Pressable`, `StyleSheet`, and existing Cyber HUD primitives. No web anchors, divs, spans, className, or window alerts are used.

## Legal Copy Coverage

- Privacy Policy covers account data, workout verification events, sponsor/creator interaction events, payout provider flows, CCPA/CPRA-style California rights, PIPEDA-style Canadian rights, retention, and contact/request placeholders.
- Terms of Service covers account eligibility, workout verification rules, biometric/camera prompts, prize draw entries, creators/sponsors, acceptable use, and product limits.
- Biometric / Camera Consent states that GoGymGo does not store or transmit biometric identifiers, faceprints, face geometry, Face ID scans, selfie images, camera frames, raw camera streams, biometric data, or imagery.
- Biometric / Camera Consent states that GoGymGo may store only non-biometric checkpoint results, timestamps, QR results, session IDs, device integrity signals, and fraud-review status.

## Page-By-Page Write / Purge / Test Notes

### Welcome

- STEP 1 WRITE: Added Privacy Policy and Terms buttons plus required native checkbox acknowledgements before `CREATE ACCOUNT ->` can proceed.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src` for web tags, `className`, `onClick`, `window.alert`, and `any`.
- STEP 3 TEST MOCK: Browser-verified that checking both legal boxes updates local state and enables the create-account CTA; leaving either unchecked keeps the CTA disabled.

### Permissions

- STEP 1 WRITE: Added Privacy/Terms links and required Biometric / Camera Notice checkbox after the three verification permission rows.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 TEST MOCK: Browser-verified that `ALLOW & CONTINUE ->` starts disabled and enables only after the Biometric / Camera Notice checkbox is checked while required permission toggles are on.

### Verification Setup

- STEP 1 WRITE: Added health-data notice for wearable data and phone-camera PPG backup; updated phone-camera PPG copy to say local camera and no frames stored.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 TEST MOCK: Verify that selecting wearable or partner-gym QR still shows the correct CTA behavior, and the health/QR notices remain visible in the selected path.

### QR Scanner

- STEP 1 WRITE: Added required Biometric / Camera Consent banner before the entry or exit QR scan CTA.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 TEST MOCK: Verify that checking the consent box updates local state and enables `SCAN ENTRY QR - CONTINUE ->` or `SCAN EXIT QR - FINISH ->`.

### Workout Checkpoints

- STEP 1 WRITE: Added required Biometric / Camera Consent banners to check-in, partner-gym identity-check, random ping, and check-out.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 TEST MOCK: Verify that each screen keeps its scan or continue CTA disabled until the local consent checkbox is checked, then preserves the existing route transition.

### Profile

- STEP 1 WRITE: Added settings rows linking to Privacy Policy, Terms of Service, and Biometric / Camera Consent.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 TEST MOCK: Verify that each legal settings row opens the matching native modal route and back/close returns to Profile.

## Production Legal Follow-Ups

- Replace placeholder legal contact details with verified production email, mailing address, request workflow, and app-store privacy nutrition labels.
- Have counsel confirm whether any stored checkpoint result, fraud score, or device integrity event is treated as biometric information in specific US states or Canadian provinces.
- Add official sweepstakes rules, regional eligibility rules, tax language, payout terms, sponsor disclosure templates, and data-retention schedule before launch.
