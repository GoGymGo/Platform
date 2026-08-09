export type MobileWebRuntime = {
  maxTouchPoints?: number;
  userAgent?: string;
};

export function isMobileWebGymVerificationDevice(
  runtime: MobileWebRuntime | null = readBrowserRuntime()
) {
  if (!runtime) return false;
  const userAgent = runtime.userAgent ?? '';
  return (
    /Android|iPhone|iPad|iPod|IEMobile|Mobile|Opera Mini/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && (runtime.maxTouchPoints ?? 0) > 1)
  );
}

function readBrowserRuntime(): MobileWebRuntime | null {
  if (typeof navigator === 'undefined') return null;
  return {
    maxTouchPoints: navigator.maxTouchPoints,
    userAgent: navigator.userAgent
  };
}
