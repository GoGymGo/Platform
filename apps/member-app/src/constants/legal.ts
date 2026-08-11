import publicLegalConfiguration from '../../../../services/api/config/legal/public-ca-bc-en.json';

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

type ConfiguredLegalDocument = {
  content: {
    intro: string;
    sections: LegalSection[];
  };
  documentKey: string;
  effectiveAt: string;
  title: string;
};

function configuredDocument(documentKey: string): LegalDocument {
  const document = (publicLegalConfiguration.documents as ConfiguredLegalDocument[]).find(
    (candidate) => candidate.documentKey === documentKey
  );
  if (!document) {
    throw new Error(`Missing public legal document: ${documentKey}`);
  }

  return {
    effectiveDate: new Intl.DateTimeFormat('en-CA', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
      year: 'numeric'
    })
      .format(new Date(document.effectiveAt))
      .toUpperCase(),
    intro: document.content.intro,
    sections: document.content.sections,
    title: document.title
  };
}

export const privacyPolicy = configuredDocument('privacy_policy');
export const termsOfService = configuredDocument('terms_of_service');
export const officialContestRules = configuredDocument('official_contest_rules');

export const biometricCameraConsent: LegalDocument = {
  title: 'DEVICE PRESENCE / GYM QR NOTICE',
  effectiveDate: 'JULY 5, 2026',
  intro:
    'This notice covers local device authentication and the initial QR scan used to select a Partner gym.',
  sections: [
    {
      heading: 'WHAT THE CHECK DOES',
      body: 'The device check confirms that the device user is present. The initial QR camera check selects the Partner gym used for later workout location verification.'
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
      body: 'GoGymGo may store a non-biometric checkpoint result, time, session ID, initial QR result, gym-location result, device-integrity signals and fraud-review status so the workout can be audited for entry and prize eligibility.'
    },
    {
      heading: 'YOUR CHOICE',
      body: 'You can decline a camera, location or device check, but enrollment or a workout may not be eligible without a required checkpoint.'
    }
  ]
};

export const biometricConsentCopy = {
  title: 'DEVICE PRESENCE NOTICE',
  body: 'Your phone handles Face ID, Touch ID, fingerprint, or passcode checks. GoGymGo receives only the result and never receives biometric data. The initial gym QR is processed locally and its camera frames are not stored.',
  checkbox: 'I understand and consent to local device presence checks for workout verification.'
} as const;
