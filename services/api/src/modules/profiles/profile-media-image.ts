import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const profileMediaInspectionVersion = 'avatar-image-v1';
export const profileMediaMinimumDimension = 64;
export const profileMediaMaximumDimension = 2_048;
export const profileMediaMaximumPixels = 4_194_304;

export interface InspectedProfileImage {
  height: number;
  inspectionVersion: typeof profileMediaInspectionVersion;
  sha256: string;
  width: number;
}

export class ProfileImageInspectionError extends Error {
  constructor(readonly code: 'container' | 'dimensions' | 'metadata') {
    super(code);
    this.name = 'ProfileImageInspectionError';
  }
}

export async function inspectProfileImage(
  data: Buffer,
  contentType: string,
): Promise<InspectedProfileImage> {
  const dimensions =
    contentType === 'image/jpeg'
      ? inspectJpeg(data)
      : contentType === 'image/png'
        ? inspectPng(data)
        : contentType === 'image/webp'
          ? inspectWebp(data)
          : invalid('container');
  assertDimensions(dimensions.width, dimensions.height);
  try {
    const decoded = await sharp(data, {
      animated: false,
      failOn: 'warning',
      limitInputPixels: profileMediaMaximumPixels,
      pages: 1,
      sequentialRead: true,
    })
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (
      decoded.info.width !== dimensions.width ||
      decoded.info.height !== dimensions.height ||
      decoded.data.length !==
        decoded.info.width * decoded.info.height * decoded.info.channels
    ) {
      return invalid('container');
    }
  } catch (error) {
    if (error instanceof ProfileImageInspectionError) throw error;
    return invalid('container');
  }
  return {
    height: dimensions.height,
    inspectionVersion: profileMediaInspectionVersion,
    sha256: createHash('sha256').update(data).digest('hex'),
    width: dimensions.width,
  };
}

function inspectJpeg(data: Buffer): { height: number; width: number } {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return invalid('container');
  }
  let dimensions: { height: number; width: number } | null = null;
  let foundScan = false;
  let offset = 2;

  while (offset < data.length) {
    const markerOffset = offset;
    if (data[offset] !== 0xff) return invalid('container');
    while (offset < data.length && data[offset] === 0xff) offset += 1;
    if (offset >= data.length) return invalid('container');
    const marker = data[offset];
    offset += 1;

    if (marker === 0xd9) {
      if (!foundScan || !dimensions || offset !== data.length) {
        return invalid('container');
      }
      return dimensions;
    }
    if (marker === 0xd8 || marker === 0x00 || marker === 0x01) {
      return invalid('container');
    }
    if (marker >= 0xd0 && marker <= 0xd7) return invalid('container');
    if (offset + 2 > data.length) return invalid('container');
    const segmentLength = data.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > data.length) {
      return invalid('container');
    }
    const payloadStart = offset + 2;
    const payloadEnd = offset + segmentLength;

    if (marker === 0xe0) {
      inspectJfifSegment(data.subarray(payloadStart, payloadEnd));
    } else if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) {
      return invalid('metadata');
    } else if (marker === 0xc0 || marker === 0xc2) {
      if (dimensions || payloadEnd - payloadStart < 6) {
        return invalid('container');
      }
      const precision = data[payloadStart];
      const height = data.readUInt16BE(payloadStart + 1);
      const width = data.readUInt16BE(payloadStart + 3);
      const components = data[payloadStart + 5];
      if (
        precision !== 8 ||
        ![1, 3].includes(components) ||
        payloadEnd - payloadStart !== 6 + components * 3
      ) {
        return invalid('container');
      }
      dimensions = { height, width };
    } else if (![0xc4, 0xda, 0xdb, 0xdd].includes(marker)) {
      return invalid('container');
    }

    offset = payloadEnd;
    if (marker === 0xda) {
      if (!dimensions) return invalid('container');
      foundScan = true;
      offset = nextJpegMarker(data, offset);
      if (offset <= markerOffset) return invalid('container');
    }
  }
  return invalid('container');
}

function inspectJfifSegment(payload: Buffer): void {
  if (
    payload.length < 14 ||
    payload.subarray(0, 5).toString('binary') !== 'JFIF\0' ||
    payload[12] !== 0 ||
    payload[13] !== 0 ||
    payload.length !== 14
  ) {
    return invalid('metadata');
  }
}

function nextJpegMarker(data: Buffer, start: number): number {
  let offset = start;
  while (offset < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const markerOffset = offset;
    while (offset < data.length && data[offset] === 0xff) offset += 1;
    if (offset >= data.length) return invalid('container');
    const marker = data[offset];
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 1;
      continue;
    }
    return markerOffset;
  }
  return invalid('container');
}

function inspectPng(data: Buffer): { height: number; width: number } {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (data.length < 33 || !data.subarray(0, 8).equals(signature)) {
    return invalid('container');
  }
  let dimensions: { height: number; width: number } | null = null;
  let colorType: number | null = null;
  let foundIdat = false;
  let idatEnded = false;
  let foundPalette = false;
  let foundPhysicalDimensions = false;
  let offset = 8;

  while (offset < data.length) {
    if (offset + 12 > data.length) return invalid('container');
    const length = data.readUInt32BE(offset);
    const typeStart = offset + 4;
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + length;
    const chunkEnd = payloadEnd + 4;
    if (chunkEnd > data.length) return invalid('container');
    const typeBytes = data.subarray(typeStart, payloadStart);
    const type = typeBytes.toString('ascii');
    if (!/^[A-Za-z]{4}$/.test(type)) return invalid('container');
    if (
      crc32(data.subarray(typeStart, payloadEnd)) !==
      data.readUInt32BE(payloadEnd)
    ) {
      return invalid('container');
    }

    if (type === 'IHDR') {
      if (offset !== 8 || length !== 13 || dimensions) {
        return invalid('container');
      }
      const width = data.readUInt32BE(payloadStart);
      const height = data.readUInt32BE(payloadStart + 4);
      const bitDepth = data[payloadStart + 8];
      colorType = data[payloadStart + 9];
      const validDepths: Record<number, readonly number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (
        !validDepths[colorType]?.includes(bitDepth) ||
        data[payloadStart + 10] !== 0 ||
        data[payloadStart + 11] !== 0 ||
        ![0, 1].includes(data[payloadStart + 12])
      ) {
        return invalid('container');
      }
      dimensions = { height, width };
    } else if (type === 'PLTE') {
      if (
        !dimensions ||
        foundIdat ||
        foundPalette ||
        length < 3 ||
        length > 768 ||
        length % 3 !== 0
      ) {
        return invalid('container');
      }
      foundPalette = true;
    } else if (type === 'tRNS') {
      if (!dimensions || foundIdat || colorType === 4 || colorType === 6) {
        return invalid('container');
      }
    } else if (type === 'pHYs') {
      if (!dimensions || foundIdat || foundPhysicalDimensions || length !== 9) {
        return invalid('container');
      }
      // Pixel density is structural rendering data, not user-authored metadata.
      // Units other than the PNG-defined unknown/metres values are invalid.
      if (data[payloadStart + 8] > 1) return invalid('container');
      foundPhysicalDimensions = true;
    } else if (type === 'IDAT') {
      if (!dimensions || idatEnded || (colorType === 3 && !foundPalette)) {
        return invalid('container');
      }
      foundIdat = true;
    } else if (type === 'IEND') {
      if (
        !dimensions ||
        !foundIdat ||
        length !== 0 ||
        chunkEnd !== data.length
      ) {
        return invalid('container');
      }
      return dimensions;
    } else {
      return type[0] === type[0]?.toLowerCase()
        ? invalid('metadata')
        : invalid('container');
    }

    if (foundIdat && type !== 'IDAT') idatEnded = true;
    offset = chunkEnd;
  }
  return invalid('container');
}

function inspectWebp(data: Buffer): { height: number; width: number } {
  if (
    data.length < 20 ||
    data.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    data.subarray(8, 12).toString('ascii') !== 'WEBP' ||
    data.readUInt32LE(4) + 8 !== data.length
  ) {
    return invalid('container');
  }
  let canvas: { height: number; width: number } | null = null;
  let image: { height: number; width: number } | null = null;
  let foundAlpha = false;
  let offset = 12;

  while (offset < data.length) {
    if (offset + 8 > data.length) return invalid('container');
    const type = data.subarray(offset, offset + 4).toString('ascii');
    const length = data.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + length;
    const chunkEnd = payloadEnd + (length % 2);
    if (chunkEnd > data.length) return invalid('container');
    const payload = data.subarray(payloadStart, payloadEnd);

    if (type === 'VP8X') {
      if (canvas || image || length !== 10) return invalid('container');
      const flags = payload[0];
      if (
        (flags & ~0x10) !== 0 ||
        payload[1] !== 0 ||
        payload[2] !== 0 ||
        payload[3] !== 0
      ) {
        return invalid('metadata');
      }
      canvas = {
        height: readUInt24LE(payload, 7) + 1,
        width: readUInt24LE(payload, 4) + 1,
      };
    } else if (type === 'ALPH') {
      if (foundAlpha || image || !canvas || length < 2) {
        return invalid('container');
      }
      foundAlpha = true;
    } else if (type === 'VP8 ') {
      if (
        image ||
        length < 10 ||
        !payload.subarray(3, 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))
      ) {
        return invalid('container');
      }
      image = {
        height: payload.readUInt16LE(8) & 0x3fff,
        width: payload.readUInt16LE(6) & 0x3fff,
      };
    } else if (type === 'VP8L') {
      if (image || length < 5 || payload[0] !== 0x2f) {
        return invalid('container');
      }
      const bits = payload.readUInt32LE(1);
      image = {
        height: ((bits >>> 14) & 0x3fff) + 1,
        width: (bits & 0x3fff) + 1,
      };
    } else if (['EXIF', 'XMP ', 'ICCP'].includes(type)) {
      return invalid('metadata');
    } else {
      return invalid('container');
    }
    offset = chunkEnd;
  }
  if (!image || offset !== data.length) return invalid('container');
  if (
    canvas &&
    (canvas.width !== image.width || canvas.height !== image.height)
  ) {
    return invalid('container');
  }
  return canvas ?? image;
}

function assertDimensions(width: number, height: number): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < profileMediaMinimumDimension ||
    height < profileMediaMinimumDimension ||
    width > profileMediaMaximumDimension ||
    height > profileMediaMaximumDimension ||
    width * height > profileMediaMaximumPixels
  ) {
    return invalid('dimensions');
  }
}

function readUInt24LE(data: Buffer, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function invalid(code: ProfileImageInspectionError['code']): never {
  throw new ProfileImageInspectionError(code);
}
