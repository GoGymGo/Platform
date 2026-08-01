import { isExpectedProfileImageSignature } from './profile-media-signature';

describe('profile media signatures', () => {
  it.each([
    [
      'image/jpeg',
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ],
    [
      'image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
    ],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
  ])('accepts a real %s signature', (contentType, data) => {
    expect(isExpectedProfileImageSignature(data, contentType)).toBe(true);
  });

  it('rejects mismatched, unknown, and truncated payloads', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(isExpectedProfileImageSignature(jpeg, 'image/png')).toBe(false);
    expect(isExpectedProfileImageSignature(jpeg, 'image/svg+xml')).toBe(false);
    expect(
      isExpectedProfileImageSignature(
        Buffer.from([0xff, 0xd8, 0xff]),
        'image/jpeg',
      ),
    ).toBe(false);
  });
});
