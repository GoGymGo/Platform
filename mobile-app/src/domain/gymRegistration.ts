import { normalizeEmail, validateEmail } from '@/domain/auth';

export type GymRegistrationInput = {
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
  }
  if (!input.managerName) {
    errors.managerName = 'MANAGER NAME IS REQUIRED.';
  }
  const emailError = validateEmail(input.workEmail);
  if (emailError) {
    errors.workEmail = emailError;
  }
  if (!input.gymAddress) {
    errors.gymAddress = 'GYM ADDRESS IS REQUIRED.';
  }
  if (!input.region) {
    errors.region = 'REGION IS REQUIRED.';
  }

  return errors;
}

export function hasGymRegistrationErrors(errors: GymRegistrationErrors) {
  return Object.values(errors).some(Boolean);
}
