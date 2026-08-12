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

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  effectiveDate: 'BROWSER PREVIEW',
  intro: 'This sample notice explains how the browser preview behaves.',
  sections: [
    {
      heading: 'BROWSER PREVIEW',
      body: 'Preview agreements stay in this browser and do not create real accounts, contest entries or prize eligibility.'
    },
    {
      heading: 'SAMPLE INFORMATION',
      body: 'Names, rewards, rankings, workouts and regions shown here are sample data used to review the GoGymGo experience.'
    }
  ]
};

export const termsOfService: LegalDocument = {
  title: 'Terms of Service',
  effectiveDate: 'BROWSER PREVIEW',
  intro: 'These sample terms support the browser preview experience.',
  sections: [
    {
      heading: 'BROWSER PREVIEW',
      body: 'Preview actions are local demonstrations and are not real contest entries, purchases or prize claims.'
    },
    {
      heading: 'SAFE TESTING',
      body: 'Use sample information only. Do not submit confidential, financial, health or identity information during preview testing.'
    }
  ]
};

export const officialContestRules: LegalDocument = {
  title: 'Contest Rules Preview',
  effectiveDate: 'BROWSER PREVIEW',
  intro: 'No live prize contest is open in this preview. This screen lets testers review the contest-rules experience with sample information.',
  sections: [
    {
      heading: 'PREVIEW ACTIVITY',
      body: 'Weekly goals, entries, rankings and rewards shown in the browser preview are sample data and do not create eligibility or a real-world prize claim.'
    },
    {
      heading: 'BEFORE A LIVE CONTEST',
      body: 'Official rules will identify the operator, eligible regions, dates, prizes, odds, entry method and winner process before any live contest opens.'
    }
  ]
};

export const biometricCameraConsent: LegalDocument = {
  title: 'DEVICE PRESENCE / QR CAMERA CONSENT',
  effectiveDate: 'BROWSER PREVIEW',
  intro: 'This notice explains the device-presence and QR steps represented in the browser preview.',
  sections: [
    {
      heading: 'WHAT THE PREVIEW DOES',
      body: 'The preview simulates device confirmation and the initial Partner gym QR selection without collecting biometric information or opening the camera.'
    },
    {
      heading: 'WHAT IS NOT COLLECTED',
      bullets: [
        'No biometric identifiers, faceprints or face geometry.',
        'No Face ID scans, fingerprints, passcodes, camera frames or raw camera streams.',
        'No biometric data or imagery is transmitted to GoGymGo servers.'
      ]
    },
    {
      heading: 'YOUR CHOICE',
      body: 'You may leave any preview screen without completing a simulated verification step.'
    }
  ]
};

export const biometricConsentCopy = {
  title: 'DEVICE PRESENCE NOTICE',
  body: 'The browser preview simulates this step without collecting biometric information or opening the QR camera.',
  checkbox: 'I understand that device-presence and QR steps are simulated in this browser preview.'
} as const;
