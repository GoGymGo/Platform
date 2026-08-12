export type PresenceVerificationResult =
  | { status: 'verified' }
  | { message: string; status: 'cancelled' | 'failed' | 'unavailable' };

export async function verifyLocalPresence(): Promise<PresenceVerificationResult> {
  return {
    message: 'Device-presence verification is not included in the Partner gym pilot.',
    status: 'unavailable'
  };
}
