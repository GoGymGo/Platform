export function isDemoPath(pathname: string | undefined): boolean {
  return pathname === '/demo' || Boolean(pathname?.startsWith('/demo/'));
}

export function isDemoSearch(value: string | undefined): boolean {
  return value === '1';
}

export function isPublicDemoRuntime(): boolean {
  const runtime = globalThis as typeof globalThis & {
    location?: { pathname?: string; search?: string };
  };
  const search = runtime.location?.search
    ? new URLSearchParams(runtime.location.search).get('demo')
    : undefined;
  return isDemoPath(runtime.location?.pathname) || isDemoSearch(search ?? undefined);
}

export function assertLiveServicesAllowed(serviceName: string): void {
  if (isPublicDemoRuntime()) {
    throw new Error(`${serviceName} is disabled in the isolated public demo.`);
  }
}
