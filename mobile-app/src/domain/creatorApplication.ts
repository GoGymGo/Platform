export type CreatorApplicationInput = {
  channelUrl: string;
  region: string;
  sampleWorkoutUrl: string;
  workoutStyle: string;
};

export type CreatorApplicationErrors = Partial<
  Record<keyof CreatorApplicationInput, string>
>;

export function normalizeCreatorApplication(
  input: CreatorApplicationInput
): CreatorApplicationInput {
  return {
    channelUrl: input.channelUrl.trim(),
    region: input.region.trim(),
    sampleWorkoutUrl: input.sampleWorkoutUrl.trim(),
    workoutStyle: input.workoutStyle.trim()
  };
}

export function validateCreatorApplication(
  input: CreatorApplicationInput
): CreatorApplicationErrors {
  const errors: CreatorApplicationErrors = {};

  if (!input.region) {
    errors.region = 'REGION IS REQUIRED.';
  }
  if (!isWebUrl(input.channelUrl)) {
    errors.channelUrl = 'ENTER A VALID CREATOR CHANNEL URL.';
  }
  if (!input.workoutStyle) {
    errors.workoutStyle = 'WORKOUT STYLE IS REQUIRED.';
  }
  if (!isWebUrl(input.sampleWorkoutUrl)) {
    errors.sampleWorkoutUrl = 'ENTER A VALID SAMPLE WORKOUT URL.';
  }

  return errors;
}

export function hasCreatorApplicationErrors(errors: CreatorApplicationErrors) {
  return Object.values(errors).some(Boolean);
}

function isWebUrl(value: string) {
  return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value);
}
