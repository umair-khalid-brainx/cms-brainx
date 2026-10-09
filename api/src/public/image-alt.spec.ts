import { filenamesNeedingAlt, uploadFilename, withLibraryAlt } from './image-alt.js';

const SITE = 'site1';
const URL_A = `http://localhost:4001/uploads/${SITE}/aaa-111.png`;
const URL_B = `http://localhost:4001/uploads/${SITE}/bbb-222.jpg`;
const OTHER = `http://localhost:4001/uploads/site2/ccc-333.png`;

describe('uploadFilename', () => {
  it('reads the file name of this site’s own uploads', () => {
    expect(uploadFilename(URL_A, SITE)).toBe('aaa-111.png');
    expect(uploadFilename(`${URL_A}?v=3#x`, SITE)).toBe('aaa-111.png');
    expect(uploadFilename(`/uploads/${SITE}/aaa-111.png`, SITE)).toBe('aaa-111.png');
  });

  it.each([OTHER, 'https://cdn.example.com/x.png', `${URL_A}/../x.png`, `http://x/uploads/${SITE}/../site2/c.png`, ''])(
    'ignores %j',
    (src) => {
      expect(uploadFilename(src, SITE)).toBeNull();
    },
  );
});

describe('withLibraryAlt', () => {
  const alts = new Map([
    ['aaa-111.png', 'A photo of oysters'],
    ['bbb-222.jpg', 'Library text for B'],
  ]);

  it('fills an empty or missing alt, wherever the image sits in the blocks', () => {
    const blocks = [
      { type: 'hero', headline: 'x', image: { src: URL_A, alt: '' } },
      { type: 'gallery', images: [{ src: URL_B }, { src: URL_A, alt: '   ' }] },
      { type: 'teamGrid', members: [{ name: 'Ada', photo: { src: URL_A, alt: '' } }] },
    ];
    expect(withLibraryAlt(blocks, SITE, alts)).toEqual([
      { type: 'hero', headline: 'x', image: { src: URL_A, alt: 'A photo of oysters' } },
      { type: 'gallery', images: [{ src: URL_B, alt: 'Library text for B' }, { src: URL_A, alt: 'A photo of oysters' }] },
      { type: 'teamGrid', members: [{ name: 'Ada', photo: { src: URL_A, alt: 'A photo of oysters' } }] },
    ]);
  });

  it('never overrides alt text typed on the page', () => {
    const blocks = [{ type: 'hero', image: { src: URL_A, alt: 'My own words' } }];
    expect(withLibraryAlt(blocks, SITE, alts)).toEqual(blocks);
  });

  it('leaves other sites’ files, outside images and files with no library text alone', () => {
    const blocks = [
      { type: 'hero', image: { src: OTHER, alt: '' } },
      { type: 'hero', image: { src: 'https://cdn.example.com/x.png', alt: '' } },
      { type: 'hero', image: { src: `http://x/uploads/${SITE}/zzz-999.png`, alt: '' } },
    ];
    expect(withLibraryAlt(blocks, SITE, alts)).toEqual(blocks);
  });

  it('does not change what it was given', () => {
    const blocks = [{ type: 'hero', image: { src: URL_A, alt: '' } }];
    withLibraryAlt(blocks, SITE, alts);
    expect(blocks[0].image.alt).toBe('');
  });

  it('does not touch things that merely have a src or no images at all', () => {
    const blocks = [{ type: 'richText', html: '<p>x</p>' }, { type: 'videoEmbed', src: 3 }];
    expect(withLibraryAlt(blocks, SITE, alts)).toEqual(blocks);
  });
});

describe('filenamesNeedingAlt', () => {
  it('lists each of this site’s files once, only for images with no alt of their own', () => {
    const blocks = [
      { image: { src: URL_A, alt: '' } },
      { images: [{ src: URL_A }, { src: URL_B, alt: 'typed' }, { src: OTHER, alt: '' }] },
    ];
    expect(filenamesNeedingAlt(blocks, SITE)).toEqual(['aaa-111.png']);
  });

  it('is empty when there is nothing to look up', () => {
    expect(filenamesNeedingAlt([{ type: 'richText', html: '' }], SITE)).toEqual([]);
  });
});
