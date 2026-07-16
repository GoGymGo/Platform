export type PresenceVerificationResult =
  | { status: 'verified' | 'simulated' }
  | { message: string; status: 'cancelled' | 'failed' | 'unavailable' };

export async function verifyLocalPresence(): Promise<PresenceVerificationResult> {
  return {
    message: 'Device authentication is available in the iOS and Android apps.',
    status: 'unavailable'
  };
}
