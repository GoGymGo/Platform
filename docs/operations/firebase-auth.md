# GoGymGo Firebase Authentication Setup

The frontend contains a real Firebase Authentication integration. It intentionally ships without project-specific credentials, so account actions remain unavailable until a GoGymGo Firebase project is connected.

## 1. Create The Firebase Project

1. Create or select the production GoGymGo project in Firebase Console.
2. Add a Firebase Web app and copy its public configuration values.
3. In Authentication, enable Email/Password and Google.
4. Configure Apple only after the Apple Developer identifiers, key, Service ID, and return URL are available.
5. Add `localhost` and each approved production hostname to Authentication authorized domains.

## 2. Configure Local Environment Values

Create `.env.local` from `.env.example` and populate:

```text
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=false
EXPO_PUBLIC_ENABLE_APPLE_AUTH=false
GOGYMGO_IOS_BUNDLE_ID=
GOGYMGO_ANDROID_PACKAGE=
```

Firebase Web API keys identify a project and are not server secrets. Firebase Admin credentials, Apple private keys, service-account files, password values, access tokens, and refresh tokens must never be added to `EXPO_PUBLIC_*` variables or committed to the repository.

## 3. Register Native Apps

1. Lock the final iOS bundle identifier and Android package name.
2. Register matching iOS and Android apps in Firebase.
3. Download `GoogleService-Info.plist` and `google-services.json` into `apps/member-app` for local development.
4. Both files are ignored by Git. The dynamic Expo config enables the native Google plugin only when both files are present.
5. Add Android debug, EAS upload, and Google Play signing SHA-1 fingerprints to the Firebase Android app.
6. Confirm that the Web OAuth client ID is used by `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
7. Keep the Google and Apple enable flags set to `false` until each provider is configured and tested in Firebase and on its supported platforms. This prevents unavailable sign-in choices from appearing in the app.

## 4. Build A Development Client

Native Google authentication uses custom native code and cannot run inside Expo Go.

Expo's current Google authentication guide recommends `react-native-nitro-google-signin`. React Native Directory has not yet marked that package as tested on the New Architecture, so GoGymGo carries a package-specific Expo Doctor exclusion. Keep the package on its latest Expo-compatible version and remove the exclusion once Directory metadata catches up or device testing exposes an incompatibility.

```powershell
npx.cmd expo prebuild --clean
npx.cmd expo run:android
```

On Windows, use EAS Build for iOS. Apple authentication also requires the Apple Sign In capability and a correctly configured Apple Developer account.

## 5. Configure Email Messages

Customize Firebase Authentication templates for email verification and password reset. Use a verified GoGymGo sender domain before production and test links on iOS, Android, and web.

## 6. Backend Contract

The member API client obtains `getIdToken()` from the authentication provider
and sends it as `Authorization: Bearer <token>`. If the API rejects a cached
token with `401`, the client asks Firebase for one forced refresh and retries
once. A revoked, disabled, malformed, or otherwise unrecoverable identity stays
failed closed; the client does not fabricate a successful response or continue
retrying.

The API's global guard verifies every non-public route with Firebase Admin and
enables revocation checking. It derives the account from the verified `uid`
claim and never accepts client-supplied ownership. The `users.firebase_uid`
unique constraint and transactional profile bootstrap converge concurrent
first-use requests on one durable user and profile. Database account status and
roles remain authoritative and are not promoted from token claims.

The backend is authoritative for:

- account status and moderation;
- accepted Privacy Policy and Terms versions;
- onboarding completion;
- public profile and region;
- contest and reward eligibility;
- revoked or blocked sessions;
- account deletion and data-retention workflows.

Email verification refresh reloads the Firebase user and forces a fresh ID
token before verified navigation continues. A restored session receives the
same reconciliation before authenticated screens render. The initial
verification-email attempt is awaited; if delivery fails after Firebase has
created the account, the verification screen reports that partial outcome and
offers the authoritative resend action.

### AWS staging credentials

The AWS-hosted API and worker should authenticate to Firebase through Google
Workload Identity Federation, not a downloaded service-account private key:

1. In Google Cloud Shell, sign in to an account that can administer the existing
   `gogymgo-8cb8b` project.
2. Run `infrastructure/aws/firebase-wif/setup.sh plan`, review the fixed staging
   boundaries, then run `apply` and `verify`.
3. The script restricts federation to AWS account `340700539877` and the
   `gogymgo-staging-api` and `gogymgo-staging-worker` task roles. It grants only
   `firebaseauth.users.get` and `firebaseauth.users.delete` through a dedicated
   staging service account.
4. Generate an AWS external-account credential configuration that uses service
   account impersonation. Store that JSON in the existing staging
   `FIREBASE_SERVICE_ACCOUNT_JSON` AWS secret.

The bootstrap does not link a Google billing account, activate a Google trial,
or create a service-account key. Google IAM and Workload Identity Federation
have no IAM usage charge; Firebase Authentication remains subject to the
existing Firebase project's plan and quotas. Keep the Souvenote Google project,
any production role, and every production Firebase project outside these
bindings.

At runtime, the application validates the configuration's Google endpoints and
project-scoped service-account URL, obtains temporary credentials from the ECS
task role, and exchanges them for a short-lived Google access token. No Google
private key or long-lived AWS access key is stored in GitHub, the task definition,
or the repository.

## 7. Required Validation

Before authentication is called production-ready, verify:

- email creation, verification, sign-in, reset, and sign-out;
- Google sign-in on EAS Android and iOS development builds;
- Apple sign-in on a physical iPhone;
- session restoration after force-close and device restart;
- revoked and disabled accounts;
- offline and interrupted authentication;
- Firebase authorized domains and OAuth redirect configuration;
- backend rejection of expired, forged, revoked, or wrong-project ID tokens.

Repository CI covers normalization, fail-closed provider availability,
authoritative verification/token refresh, one-time bearer recovery, revocation
checking, malformed-token rejection, and concurrent stable profile bootstrap
without contacting a hosted Firebase project. The remaining provider/device and
hosted-project checks above are release-environment smoke tests and require
separate deployment authorization and credentials.
