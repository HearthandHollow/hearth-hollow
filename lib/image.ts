/**
 * HEIC/HEIF → JPEG conversion using heic-convert (pure JS via libheif —
 * works on serverless without native HEIC libraries).
 */

export function isHeic(mimeType: string, filename: string): boolean {
  return (
    mimeType === 'image/heic' ||
    mimeType === 'image/heif' ||
    /\.(heic|heif)$/i.test(filename || '')
  );
}

/** Convert a HEIC/HEIF buffer to a JPEG buffer. Throws if conversion fails. */
export async function heicToJpeg(input: Buffer): Promise<Buffer> {
  const mod: any = await import('heic-convert');
  const convert = mod.default || mod;
  const output = await convert({
    buffer: input,
    format: 'JPEG',
    quality: 0.85,
  });
  return Buffer.from(output);
}
