export function isDemoPath(pathname: string | undefined): boolean {
  return pathname === '/demo' || Boolean(pathname?.startsWith('/demo/'));
}

export function isPublicDemoRuntime(): boolean {
  const runtime = globalThis as typeof globalThis & {
    location?: { pathname?: string };
  };
  return isDemoPath(runtime.location?.pathname);
}

export function assertLiveServicesAllowed(serviceName: string): void {
  if (isPublicDemoRuntime()) {
    throw new Error(`${serviceName} is disabled in the isolated public demo.`);
  }
}
