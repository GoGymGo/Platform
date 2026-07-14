const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';

export const apiBaseUrl = configuredApiBaseUrl.replace(/\/+$/, '');
export const apiRequestTimeoutMs = 15_000;
export const isApiConfigured = apiBaseUrl.length > 0;
