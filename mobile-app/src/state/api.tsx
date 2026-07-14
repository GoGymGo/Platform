import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren
} from 'react';

import { apiBaseUrl, apiRequestTimeoutMs, isApiConfigured } from '@/config/api';
import { createApiClient, type ApiClient } from '@/services/api/client';
import { useAuth } from '@/state/auth';

type ApiContextValue = {
  api: ApiClient | null;
  configured: boolean;
};

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: PropsWithChildren) {
  const { getIdToken } = useAuth();
  const api = useMemo(
    () => isApiConfigured
      ? createApiClient({
          baseUrl: apiBaseUrl,
          getAccessToken: getIdToken,
          timeoutMs: apiRequestTimeoutMs
        })
      : null,
    [getIdToken]
  );
  const value = useMemo(
    () => ({ api, configured: isApiConfigured }),
    [api]
  );

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const context = useContext(ApiContext);

  if (!context) {
    throw new Error('useApi must be used inside ApiProvider');
  }

  return context;
}
