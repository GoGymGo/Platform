import { normalizeEmail, validateEmail } from '@/domain/auth';

export type SponsorApplicationInput = {
  companyName: string;
  contactEmail: string;
  targetRegion: string;
};

export type SponsorApplicationErrors = Partial<Record<keyof SponsorApplicationInput, string>>;

export function normalizeSponsorApplication(
  input: SponsorApplicationInput
): SponsorApplicationInput {
  return {
    companyName: input.companyName.trim(),
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
  }
  const emailError = validateEmail(input.contactEmail);
  if (emailError) {
    errors.contactEmail = emailError;
  }
  if (!input.targetRegion) {
    errors.targetRegion = 'TARGET REGION IS REQUIRED.';
  }

  return errors;
}

export function hasSponsorApplicationErrors(errors: SponsorApplicationErrors) {
  return Object.values(errors).some(Boolean);
}
