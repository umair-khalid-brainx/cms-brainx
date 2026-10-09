// The mimetype on an upload is whatever the browser claims. Images are proved by
// decoding them (thumbnail.ts); documents are checked here against the first
// bytes every genuine file of that kind starts with, so a renamed program or
// web page can't be stored as "a PDF" and served from our address.
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04": .docx and .xlsx are zip files
const PDF = Buffer.from('%PDF-');

const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function isDocumentType(mimetype: string): boolean {
  return DOCUMENT_TYPES.has(mimetype);
}

/** True when the bytes look like the document type claimed; always true for non-documents. */
export function matchesDocumentSignature(buffer: Buffer, mimetype: string): boolean {
  if (!isDocumentType(mimetype)) return true;
  if (mimetype === 'application/pdf') {
    // The PDF spec allows a little junk before the header, within the first 1 KiB.
    return buffer.subarray(0, 1024).includes(PDF);
  }
  return buffer.subarray(0, 4).equals(ZIP);
}
