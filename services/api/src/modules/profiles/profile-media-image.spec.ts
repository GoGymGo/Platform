import sharp from 'sharp';
import {
  inspectProfileImage,
  ProfileImageInspectionError,
  profileMediaInspectionVersion,
} from './profile-media-image';

async function image(
  format: 'jpeg' | 'png' | 'webp',
  width = 640,
  height = 640,
): Promise<Buffer> {
  return sharp({
    create: {
      background: { alpha: 1, b: 120, g: 80, r: 40 },
      channels: 4,
      height,
      width,
    },
  })
    [format]({ quality: 82 })
    .toBuffer();
}

describe('strict profile image inspection', () => {
  it.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ] as const)('fully decodes metadata-free %s images', async (format, type) => {
    const data = await image(format);
    await expect(inspectProfileImage(data, type)).resolves.toEqual({
      height: 640,
      inspectionVersion: profileMediaInspectionVersion,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      width: 640,
    });
  });

  it('rejects invalid dimensions and MIME mismatches', async () => {
    const tooSmall = await image('png', 63, 640);
    const jpeg = await image('jpeg');
    await expect(
      inspectProfileImage(tooSmall, 'image/png'),
    ).rejects.toMatchObject({ code: 'dimensions' });
    await expect(inspectProfileImage(jpeg, 'image/png')).rejects.toBeInstanceOf(
      ProfileImageInspectionError,
    );
  });

  it('rejects metadata, trailing polyglot bytes, and corrupt encoded content', async () => {
    const jpeg = await image('jpeg');
    const app1 = Buffer.concat([
      jpeg.subarray(0, 2),
      Buffer.from([0xff, 0xe1, 0x00, 0x08]),
      Buffer.from('Exif\0\0'),
      jpeg.subarray(2),
    ]);
    const polyglot = Buffer.concat([
      jpeg,
      Buffer.from('<script>bad()</script>'),
    ]);
    const png = await image('png');
    const corruptPng = Buffer.from(png);
    corruptPng[Math.floor(corruptPng.length / 2)] ^= 0xff;

    await expect(inspectProfileImage(app1, 'image/jpeg')).rejects.toMatchObject(
      {
        code: 'metadata',
      },
    );
    await expect(
      inspectProfileImage(polyglot, 'image/jpeg'),
    ).rejects.toMatchObject({ code: 'container' });
    await expect(
      inspectProfileImage(corruptPng, 'image/png'),
    ).rejects.toMatchObject({ code: 'container' });
  });
});
