import { isDocumentType, matchesDocumentSignature } from './file-signature.js';

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('matchesDocumentSignature', () => {
  it('accepts real PDF, Word and Excel starts', () => {
    expect(matchesDocumentSignature(Buffer.from('%PDF-1.7\n...'), PDF)).toBe(true);
    expect(matchesDocumentSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), DOCX)).toBe(true);
    expect(matchesDocumentSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), XLSX)).toBe(true);
  });

  it('accepts a PDF with a little junk before the header', () => {
    expect(matchesDocumentSignature(Buffer.concat([Buffer.from('\n\n  '), Buffer.from('%PDF-1.4')]), PDF)).toBe(true);
  });

  it.each([
    ['a web page called a PDF', Buffer.from('<html><script>alert(1)</script></html>'), PDF],
    ['a program called a PDF', Buffer.from([0x7f, 0x45, 0x4c, 0x46, 1, 1]), PDF],
    ['a PDF header far into the file', Buffer.concat([Buffer.alloc(2000), Buffer.from('%PDF-')]), PDF],
    ['plain text called a Word file', Buffer.from('hello'), DOCX],
    ['a PDF called an Excel file', Buffer.from('%PDF-1.7'), XLSX],
    ['an empty file', Buffer.alloc(0), PDF],
  ])('refuses %s', (_label, buffer, mimetype) => {
    expect(matchesDocumentSignature(buffer, mimetype)).toBe(false);
  });

  it('does not judge types it does not own', () => {
    expect(matchesDocumentSignature(Buffer.from('anything'), 'image/png')).toBe(true);
  });
});

describe('isDocumentType', () => {
  it('knows the three document types only', () => {
    expect([PDF, DOCX, XLSX].every(isDocumentType)).toBe(true);
    expect(isDocumentType('image/png')).toBe(false);
    expect(isDocumentType('application/zip')).toBe(false);
  });
});
