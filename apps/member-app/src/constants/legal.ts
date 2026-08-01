export type LegalSection = {
  body?: string;
  bullets?: readonly string[];
  heading: string;
};

export type LegalDocument = {
  effectiveDate: string;
  intro: string;
  sections: readonly LegalSection[];
  title: string;
};

const unavailableSection: LegalSection = {
  heading: 'DOCUMENT UNAVAILABLE',
  body: 'This document has not been published for your region. Please try again later. You cannot complete registration until the current document is available for review and acceptance.'
};

export const privacyPolicy: LegalDocument = {
  title: 'PRIVACY POLICY',
  effectiveDate: 'NOT PUBLISHED',
  intro: 'The current Privacy Policy is temporarily unavailable.',
  sections: [unavailableSection]
};

export const termsOfService: LegalDocument = {
  title: 'TERMS OF SERVICE',
  effectiveDate: 'NOT PUBLISHED',
  intro: 'The current Terms of Service are temporarily unavailable.',
  sections: [unavailableSection]
};

export const officialContestRules: LegalDocument = {
  title: 'OFFICIAL CONTEST RULES',
  effectiveDate: 'NOT PUBLISHED',
  intro: 'No GoGymGo competition is open unless its current official rules are published in the app.',
  sections: [
    {
      heading: 'BEFORE YOU JOIN',
      body: 'Review the published eligibility, dates, entry method, prize, odds, verification requirements and winner process. Registration remains unavailable until those rules are published.'
    }
  ]
};

export const biometricCameraConsent: LegalDocument = {
  title: 'DEVICE PRESENCE / QR CAMERA NOTICE',
  effectiveDate: 'JULY 5, 2026',
  intro:
    'This notice covers local device authentication and QR scanning used to verify GoGymGo workouts.',
  sections: [
    {
      heading: 'WHAT THE CHECK DOES',
      body: 'The device check confirms that the phone user is present. The separate QR camera check confirms a partner-gym entry or exit code.'
    },
    {
      heading: 'WHAT IS NOT STORED',
      bullets: [
        'No biometric identifiers.',
        'No faceprints or face geometry.',
        'No Face ID scans, selfie images, camera frames or raw camera streams.',
        'No biometric data or imagery is transmitted to GoGymGo servers.'
      ]
    },
    {
      heading: 'WHAT MAY BE STORED',
      body: 'GoGymGo may store a non-biometric checkpoint result, time, session ID, QR result, device-integrity signals and fraud-review status so the workout can be audited for entry and prize eligibility.'
    },
    {
      heading: 'YOUR CHOICE',
      body: 'You can decline a camera or device check, but a workout or QR session may not be eligible without a required checkpoint.'
    }
  ]
};

export const biometricConsentCopy = {
  title: 'DEVICE PRESENCE NOTICE',
  body: 'Your phone handles Face ID, Touch ID, fingerprint, or passcode checks. GoGymGo receives only the result and never receives biometric data. QR scanning is a separate camera step; its frames are processed locally and are not stored.',
  checkbox: 'I understand and consent to local device presence checks for workout verification.'
} as const;
