import { createHmac } from 'node:crypto';

export class PrivacyPseudonymizer {
  constructor(private readonly key: string) {
    if (key.length < 32) {
      throw new Error('The privacy pseudonymization key is too short.');
    }
  }

  firebaseUid(firebaseUid: string): string {
    if (firebaseUid.startsWith('deleted:')) {
      return firebaseUid;
    }
    return `deleted:${this.digest('firebase-uid', firebaseUid)}`;
  }

  callsign(userId: string): string {
    return `GG-DELETED-${this.digest('callsign', userId)
      .slice(0, 12)
      .toUpperCase()}`;
  }

  private digest(namespace: string, value: string): string {
    return createHmac('sha256', this.key)
      .update(namespace)
      .update('\0')
      .update(value)
      .digest('hex');
  }
}
