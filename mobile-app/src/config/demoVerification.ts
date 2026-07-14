export const demoVerificationRegionCode = 'CA-BC' as const;

export const isDemoVerificationEnabled =
  process.env.EXPO_PUBLIC_DEMO_VERIFICATION_ENABLED === 'true';
