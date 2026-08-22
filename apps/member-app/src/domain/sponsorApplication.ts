import { normalizeEmail, validateEmail } from '@/domain/auth';

export type SponsorApplicationInput = {
  companyName: string;
  consent: boolean;
  contactEmail: string;
  targetRegion: string;
};

export type SponsorApplicationErrors = Partial<Record<keyof SponsorApplicationInput, string>>;

export function normalizeSponsorApplication(
  input: SponsorApplicationInput
): SponsorApplicationInput {
  return {
    companyName: input.companyName.trim(),
    consent: input.consent,
    contactEmail: normalizeEmail(input.contactEmail),
    targetRegion: input.targetRegion.trim()
  };
}

export function validateSponsorApplication(
  input: SponsorApplicationInput
): SponsorApplicationErrors {
  const errors: SponsorApplicationErrors = {};

  if (!input.companyName) {
    errors.companyName = 'COMPANY NAME IS REQUIRED.';
  } else if (input.companyName.length < 2 || input.companyName.length > 160) {
    errors.companyName = 'COMPANY NAME MUST BE 2 TO 160 CHARACTERS.';
  }
  const emailError = validateEmail(input.contactEmail);
  if (emailError || input.contactEmail.length > 320) {
    errors.contactEmail = emailError ?? 'EMAIL MUST BE 320 CHARACTERS OR FEWER.';
  }
  if (!input.targetRegion) {
    errors.targetRegion = 'TARGET REGION IS REQUIRED.';
  } else if (input.targetRegion.length < 2 || input.targetRegion.length > 120) {
    errors.targetRegion = 'TARGET REGION MUST BE 2 TO 120 CHARACTERS.';
  }
  if (!input.consent) {
    errors.consent = 'CONSENT IS REQUIRED TO SUBMIT.';
  }

  return errors;
}

export function hasSponsorApplicationErrors(errors: SponsorApplicationErrors) {
  return Object.values(errors).some(Boolean);
}
