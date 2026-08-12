# GoGymGo Compliance Implementation Audit

## Scope

This audit maps the current Expo Router app to the North American privacy and biometric/camera touchpoints needed before production legal review. It is not legal advice. The implementation adds mobile-friendly disclosures and native consent controls for US and Canada readiness, including CCPA/CPRA-style privacy rights, PIPEDA meaningful consent expectations, and BIPA-style biometric/camera safeguards.

## Architecture Map

- `app/(onboarding)/welcome.tsx`: account-start page with links into account creation and sign-in.
- `app/(onboarding)/region.tsx`: one-time device-location verification plus jurisdiction-aware Privacy/Terms review and receipt capture on the same setup screen.
- `app/(onboarding)/consents.tsx`: legacy route that redirects to the combined Region + Agreements screen.
- `app/(onboarding)/verification.tsx`: just-in-time heart-rate, HealthKit/Health Connect, wearable, partner-gym QR, and phone-camera PPG setup shown at the first verified workout or from Profile.
- `app/(modals)/privacy-policy.tsx`: native Privacy Policy modal.
- `app/(modals)/terms-of-service.tsx`: native Terms of Service modal.
- `app/(modals)/biometric-camera-consent.tsx`: native Biometric / Camera Consent modal.
- `app/(modals)/qr-scanner.tsx`: one-time QR camera view for gym selection plus start and finish location-check controls.
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

- Privacy Policy covers account data, workout verification events, sponsor/creator interactions, reward claims, CCPA/CPRA-style California rights, PIPEDA-style Canadian rights, retention, and contact/request placeholders.
- Terms of Service covers account eligibility, workout verification rules, biometric/camera prompts, prize draw entries, creators/sponsors, acceptable use, and product limits.
- Biometric / Camera Consent states that GoGymGo does not store or transmit biometric identifiers, faceprints, face geometry, Face ID scans, selfie images, camera frames, raw camera streams, biometric data, or imagery.
- Biometric / Camera Consent states that GoGymGo may store only non-biometric checkpoint results, timestamps, QR results, session IDs, device integrity signals, and fraud-review status.

## Page-By-Page Write / Purge / Test Notes

### Account creation

- STEP 1 WRITE: Privacy Policy and Terms remain available from account creation, while authoritative acceptance is recorded once on the jurisdiction-aware Region + Agreements screen.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src` for web tags, `className`, `onClick`, `window.alert`, and `any`.
- STEP 3 MANUAL TEST: Browser-verify that account creation remains independent of stale local checkbox state and that setup resumes at Region + Agreements.

### Region + Agreements

- STEP 1 WRITE: Location verification resolves the applicable jurisdiction, then the same screen displays current Privacy/Terms links and records the required legal receipt.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 MANUAL TEST: Browser-verify that agreement acceptance stays disabled until current documents load and that the CTA continues directly to Weekly Goal.

### Verification Setup

- STEP 1 WRITE: Added health-data notice for wearable data and phone-camera PPG backup; updated phone-camera PPG copy to say local camera and no frames stored.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 MANUAL TEST: Verify that first-workout device selection saves the default and continues directly to check-in; device-presence consent is then requested at the moment of use.

### Partner Gym Verification

- STEP 1 WRITE: A new player scans the initial Contest QR before account creation. Region eligibility uses a separate broad location check, and the selected Partner gym is stored on the Contest enrollment. Returning players use fresh start and finish location checks without rescanning, including on a new device.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 MANUAL TEST: Verify that Start Workout and Finish Workout each request a fresh location reading at the selected Partner gym.

### Workout Checkpoints

- STEP 1 WRITE: Added required Biometric / Camera Consent banners to check-in, partner-gym identity-check, random ping, and check-out.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 MANUAL TEST: Verify that each enabled checkpoint keeps its continue CTA disabled until the local consent checkbox is checked, then preserves the existing route transition.

### Profile

- STEP 1 WRITE: Added settings rows linking to Privacy Policy and Terms of Service, plus guarded Contest withdrawal and local-device reset actions. Withdrawal retains required Contest-integrity history while ending workout, ranking, pairing, and prize eligibility. Device reset signs out and removes app storage, accessible browser cookies, and caches without claiming to delete server data.
- STEP 2 NATIVE PURGE AUDIT: Covered by workspace purge command across `app` and `src`.
- STEP 3 MANUAL TEST: Verify that each legal settings row opens the matching native modal route and back/close returns to Profile.

## Production Legal Follow-Ups

- Replace placeholder legal contact details with verified production email, mailing address, request workflow, and app-store privacy nutrition labels.
- Have counsel confirm whether any stored checkpoint result, fraud score, or device integrity event is treated as biometric information in specific US states or Canadian provinces.
- Add official contest rules, regional eligibility, physical/coupon fulfillment terms, sponsor disclosure templates, and a data-retention schedule before launch.
