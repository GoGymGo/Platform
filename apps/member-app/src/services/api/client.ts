export type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: (forceRefresh?: boolean) => Promise<string>;
  timeoutMs?: number;
};

export type ApiRequestOptions<TBody = never> = {
  authenticated?: boolean;
  body?: TBody;
  headers?: Readonly<Record<string, string>>;
  idempotencyKey?: string;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  signal?: AbortSignal;
};

export type ApiClient = {
  request: <TResponse, TBody = never>(
    path: string,
    options?: ApiRequestOptions<TBody>
  ) => Promise<TResponse>;
};

export class ApiError extends Error {
  readonly body: unknown;
  readonly status: number;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.body = body;
    this.status = status;
  }
}

export function createApiClient({
  baseUrl,
  getAccessToken,
  timeoutMs = 15_000
}: ApiClientOptions): ApiClient {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');

  if (!normalizedBaseUrl) {
    throw new Error('An API base URL is required.');
  }

  return {
    request: async <TResponse, TBody = never>(
      path: string,
      options: ApiRequestOptions<TBody> = {}
    ) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const abortFromCaller = () => controller.abort();
      options.signal?.addEventListener('abort', abortFromCaller, { once: true });

      try {
        const token = options.authenticated === false ? null : await getAccessToken();
        const response = await fetch(buildApiUrl(normalizedBaseUrl, path), {
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(options.idempotencyKey
              ? { 'Idempotency-Key': options.idempotencyKey }
              : {}),
            ...options.headers
          },
          method: options.method ?? 'GET',
          signal: controller.signal
        });
        const body = await parseResponseBody(response);

        if (!response.ok) {
          throw new ApiError(
            getApiErrorMessage(body, response.status),
            response.status,
            body
          );
        }

        return body as TResponse;
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abortFromCaller);
      }
    }
  };
}

export function buildApiUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl.replace(/\/+$/, '')}${normalizedPath}`;
}

async function parseResponseBody(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json')
    ? response.json()
    : response.text();
}

function getApiErrorMessage(body: unknown, status: number) {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'message' in body.error &&
    typeof body.error.message === 'string'
  ) {
    return body.error.message;
  }

  return `GoGymGo API request failed with status ${status}.`;
}
