import sanitizeHtml from 'sanitize-html';

// Sanitise on write, never on read (root invariant 5): this runs when content
// is saved, so what is stored is already safe and the public site renders it
// as-is. The allowlist is exactly what the editor's toolbar can produce (req. 2:
// headings, paragraphs, lists, links, quotations, plus bold and italic — see
// admin/src/puck/config.tsx `richTextOptions`). Anything else is not something
// a person made with the editor, so it is dropped: scripts, event handlers,
// styles, images, `javascript:` links.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'a'],
  // Links carry only their address: no `target`, `rel`, `style` or `on*`.
  allowedAttributes: { a: ['href'] },
  // Relative links (`/about`, `#pricing`) have no scheme and pass; anything
  // with a scheme must be one of these.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  // Pasted content often arrives as <b>/<i>; keep the formatting.
  transformTags: { b: 'strong', i: 'em' },
};

// A link whose address was refused above is left as a bare `<a>`, which the
// site would still style as a link. Second pass: an `<a>` with no `href` becomes
// plain text (its tag is not allowed as `span`, so only the text survives).
const UNLINK_OPTIONS: sanitizeHtml.IOptions = {
  ...OPTIONS,
  transformTags: {
    ...OPTIONS.transformTags,
    a: (tagName, attribs) => (attribs.href ? { tagName, attribs } : { tagName: 'span', attribs: {} }),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(sanitizeHtml(html, OPTIONS), UNLINK_OPTIONS);
}

type Block = { type: string } & Record<string, unknown>;

/**
 * Sanitises the HTML held in a page's blocks. Today that is only the rich text
 * block's `html`; every other block's text props are plain text that the
 * renderer escapes. A new block with an HTML prop must be added here.
 */
export function sanitizeBlocks<T extends Block>(blocks: T[]): T[] {
  return blocks.map((block) =>
    block.type === 'richText' && typeof block.html === 'string' ? { ...block, html: sanitizeRichText(block.html) } : block,
  );
}
