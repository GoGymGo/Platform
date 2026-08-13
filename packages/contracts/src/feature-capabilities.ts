export type FeatureCapabilities = Readonly<{
  creatorFeaturesEnabled: boolean;
}>;

export type FeatureCapabilityEnvironment = Readonly<{
  creatorFeaturesEnabled?: string;
}>;

export const defaultFeatureCapabilities: FeatureCapabilities = Object.freeze({
  creatorFeaturesEnabled: false,
});

export function resolveFeatureCapabilities(
  environment: FeatureCapabilityEnvironment = {},
): FeatureCapabilities {
  return Object.freeze({
    creatorFeaturesEnabled: resolveBooleanCapability(
      environment.creatorFeaturesEnabled,
      'creatorFeaturesEnabled',
      defaultFeatureCapabilities.creatorFeaturesEnabled,
    ),
  });
}

function resolveBooleanCapability(
  value: string | undefined,
  name: keyof FeatureCapabilities,
  fallback: boolean,
): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(
    `Invalid ${name} feature capability. Expected "true" or "false".`,
  );
}
