export const creatorFeaturesEnabled = false;

export const creatorFeatureStatusLabel = 'NOT AVAILABLE';

export const creatorFeaturePausedMessage =
  'Creator workouts and applications are not available in this release.';

export function rejectPausedCreatorAction(): Promise<never> {
  return Promise.reject(new Error('CREATOR_FEATURES_PAUSED'));
}
