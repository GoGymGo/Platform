import { resolveFeatureCapabilities } from '@gogymgo/contracts/feature-capabilities';

const featureCapabilities = resolveFeatureCapabilities({
  creatorFeaturesEnabled: process.env.EXPO_PUBLIC_ENABLE_CREATOR_FEATURES,
});

export const { creatorFeaturesEnabled } = featureCapabilities;

export const creatorFeatureStatusLabel = 'NOT AVAILABLE';

export const creatorFeaturePausedMessage =
  'Creator workouts and applications are not available in this release.';

export function rejectPausedCreatorAction(): Promise<never> {
  return Promise.reject(new Error('CREATOR_FEATURES_PAUSED'));
}
