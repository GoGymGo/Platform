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
  } else if (input.region.length < 2 || input.region.length > 120) {
    errors.region = 'REGION MUST BE 2 TO 120 CHARACTERS.';
  }
  if (!isWebUrl(input.channelUrl)) {
    errors.channelUrl = 'ENTER A VALID CREATOR CHANNEL URL.';
  }
  if (!input.workoutStyle) {
    errors.workoutStyle = 'WORKOUT STYLE IS REQUIRED.';
  } else if (input.workoutStyle.length < 2 || input.workoutStyle.length > 120) {
    errors.workoutStyle = 'WORKOUT STYLE MUST BE 2 TO 120 CHARACTERS.';
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
  if (value.length > 2048) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
