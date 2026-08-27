export const defaultRewardTermsUrl =
  'https://app.gogymgo.com/terms-of-service' as const;

export function resolveRewardTermsUrl(
  value: string | null | undefined,
): string {
  return value?.trim() || defaultRewardTermsUrl;
}
