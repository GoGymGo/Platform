import { normalizeEmail, validateEmail } from '@/domain/auth';

export type GymRegistrationInput = {
  consent: boolean;
  gymAddress: string;
  gymName: string;
  managerName: string;
  region: string;
  workEmail: string;
};

export type GymRegistrationErrors = Partial<
  Record<keyof GymRegistrationInput, string>
>;

export function normalizeGymRegistration(
  input: GymRegistrationInput
): GymRegistrationInput {
  return {
    consent: input.consent,
    gymAddress: input.gymAddress.trim(),
    gymName: input.gymName.trim(),
    managerName: input.managerName.trim(),
    region: input.region.trim(),
    workEmail: normalizeEmail(input.workEmail)
  };
}

export function validateGymRegistration(
  input: GymRegistrationInput
): GymRegistrationErrors {
  const errors: GymRegistrationErrors = {};

  if (!input.gymName) {
    errors.gymName = 'GYM NAME IS REQUIRED.';
  } else if (input.gymName.length < 2 || input.gymName.length > 160) {
    errors.gymName = 'GYM NAME MUST BE 2 TO 160 CHARACTERS.';
  }
  if (!input.managerName) {
    errors.managerName = 'MANAGER NAME IS REQUIRED.';
  } else if (input.managerName.length < 2 || input.managerName.length > 160) {
    errors.managerName = 'MANAGER NAME MUST BE 2 TO 160 CHARACTERS.';
  }
  const emailError = validateEmail(input.workEmail);
  if (emailError || input.workEmail.length > 320) {
    errors.workEmail = emailError ?? 'EMAIL MUST BE 320 CHARACTERS OR FEWER.';
  }
  if (!input.gymAddress) {
    errors.gymAddress = 'GYM ADDRESS IS REQUIRED.';
  } else if (input.gymAddress.length < 5 || input.gymAddress.length > 500) {
    errors.gymAddress = 'GYM ADDRESS MUST BE 5 TO 500 CHARACTERS.';
  }
  if (!input.region) {
    errors.region = 'REGION IS REQUIRED.';
  } else if (input.region.length < 2 || input.region.length > 120) {
    errors.region = 'REGION MUST BE 2 TO 120 CHARACTERS.';
  }
  if (!input.consent) {
    errors.consent = 'CONSENT IS REQUIRED TO SUBMIT.';
  }

  return errors;
}

export function hasGymRegistrationErrors(errors: GymRegistrationErrors) {
  return Object.values(errors).some(Boolean);
}
