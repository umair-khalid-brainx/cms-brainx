import sharp from 'sharp';
import { InvalidImageError, makeThumbnail, THUMBNAIL_WIDTH } from './thumbnail.js';

function solidImage(width: number, height: number, format: 'png' | 'jpeg' | 'webp') {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .toFormat(format)
    .toBuffer();
}

describe('makeThumbnail', () => {
  it.each(['png', 'jpeg', 'webp'] as const)('shrinks a large %s to a 400px-wide WebP, keeping its aspect ratio', async (format) => {
    const thumb = await makeThumbnail(await solidImage(1600, 900, format), `image/${format}`);
    const meta = await sharp(thumb!).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(THUMBNAIL_WIDTH);
    expect(meta.height).toBe(225);
  });

  it('never enlarges an image smaller than the thumbnail width', async () => {
    const thumb = await makeThumbnail(await solidImage(120, 80, 'png'), 'image/png');
    const meta = await sharp(thumb!).metadata();
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(80);
  });

  it.each(['image/svg+xml', 'image/gif', 'video/mp4', 'video/webm'])('returns null for %s', async (mimetype) => {
    expect(await makeThumbnail(Buffer.from('anything'), mimetype)).toBeNull();
  });

  it('rejects bytes that do not decode as the claimed image type', async () => {
    await expect(makeThumbnail(Buffer.from('not really a png'), 'image/png')).rejects.toBeInstanceOf(InvalidImageError);
  });

  it('rejects images over the pixel limit before decoding them', async () => {
    const huge = await solidImage(7100, 7100, 'png'); // ~50.4 MP, just over the limit
    await expect(makeThumbnail(huge, 'image/png')).rejects.toBeInstanceOf(InvalidImageError);
  });
});
