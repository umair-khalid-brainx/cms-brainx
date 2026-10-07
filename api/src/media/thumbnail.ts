import sharp from 'sharp';

export const THUMBNAIL_WIDTH = 400;

// sharp's own default is ~268 MP. A tiny, highly-compressed PNG can claim huge
// dimensions and cost hundreds of MB to decode, on the one shared EC2 box.
// 50 MP is still above any real camera photo (a 45 MP DSLR shot passes).
export const MAX_INPUT_PIXELS = 50_000_000;

// Only raster formats sharp can resize into something meaningfully smaller.
// SVG is already resolution-independent (and tiny), GIF would lose its
// animation, and video isn't an image — those three keep url as their preview.
const THUMBNAILABLE = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class InvalidImageError extends Error {}

/**
 * A 400px-wide WebP of an uploaded raster image, or null for types that don't
 * get one. Throws InvalidImageError when the bytes don't decode as an image —
 * the mimetype is client-supplied, so this is also the first real check that
 * a "photo.png" is actually a PNG.
 */
export async function makeThumbnail(buffer: Buffer, mimetype: string): Promise<Buffer | null> {
  if (!THUMBNAILABLE.has(mimetype)) return null;
  try {
    return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // honour EXIF orientation, or phone photos come out sideways
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new InvalidImageError(`File is not a valid ${mimetype} image, or is larger than ${MAX_INPUT_PIXELS / 1_000_000} megapixels`);
  }
}
