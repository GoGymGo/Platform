const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

export function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
}

export const apiBaseUrl = normalizeApiBaseUrl(configuredApiBaseUrl);
export const apiRequestTimeoutMs = 15_000;
export const isApiConfigured = apiBaseUrl.length > 0;
