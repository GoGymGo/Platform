import { PrivacyPseudonymizer } from './privacy-pseudonymizer';

describe('privacy pseudonymization', () => {
  const pseudonymizer = new PrivacyPseudonymizer('k'.repeat(32));

  it('creates deterministic, namespace-separated identifiers', () => {
    const firebaseUid = pseudonymizer.firebaseUid('firebase-user-1');
    const callsign = pseudonymizer.callsign('firebase-user-1');

    expect(firebaseUid).toBe(pseudonymizer.firebaseUid('firebase-user-1'));
    expect(firebaseUid).toMatch(/^deleted:[a-f0-9]{64}$/);
    expect(callsign).toMatch(/^GG-DELETED-[A-F0-9]{12}$/);
    expect(firebaseUid).not.toContain('firebase-user-1');
    expect(firebaseUid).not.toContain(callsign.slice(11).toLowerCase());
  });

  it('does not re-pseudonymize a completed Firebase identifier', () => {
    const once = pseudonymizer.firebaseUid('firebase-user-2');
    expect(pseudonymizer.firebaseUid(once)).toBe(once);
  });

  it('rejects a key that is too short for production use', () => {
    expect(() => new PrivacyPseudonymizer('too-short')).toThrow(/too short/i);
  });
});
