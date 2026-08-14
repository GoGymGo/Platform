import { Buffer } from 'node:buffer';

const rewardCodeKeyPattern = /^[A-Za-z0-9+/]{43}=$/;

export function decodeRewardCodeEncryptionKey(
  encoded: string | undefined,
): Buffer | null {
  if (!encoded || !rewardCodeKeyPattern.test(encoded)) {
    return null;
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    return null;
  }
  return key;
}
