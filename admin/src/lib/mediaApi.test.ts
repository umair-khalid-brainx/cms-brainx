import { describe, expect, it } from 'vitest';
import { documentKind, isDocument, isImage, isVideo, typeLabel } from './mediaApi';

describe('file kinds (MED-04)', () => {
  it('names types the way a person would', () => {
    expect(typeLabel('application/pdf')).toBe('PDF document');
    expect(typeLabel('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('Word document');
    expect(typeLabel('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('Excel spreadsheet');
    expect(typeLabel('image/jpeg')).toBe('JPEG image');
    expect(typeLabel('application/x-unknown')).toBe('application/x-unknown');
  });

  it('tells images, videos and documents apart', () => {
    expect(isImage({ mimetype: 'image/png' })).toBe(true);
    expect(isVideo({ mimetype: 'video/mp4' })).toBe(true);
    expect(isDocument({ mimetype: 'application/pdf' })).toBe(true);
    expect(isDocument({ mimetype: 'image/png' })).toBe(false);
    expect(isDocument({ mimetype: 'video/webm' })).toBe(false);
  });

  it('gives each document its own label and colour family', () => {
    expect(documentKind('application/pdf')).toMatchObject({ extension: 'PDF', tone: 'pdf' });
    expect(documentKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toMatchObject({
      extension: 'DOCX',
      tone: 'word',
    });
    expect(documentKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toMatchObject({
      extension: 'XLSX',
      tone: 'excel',
    });
    expect(documentKind('application/x-unknown')).toMatchObject({ extension: 'FILE', tone: null });
  });
});
