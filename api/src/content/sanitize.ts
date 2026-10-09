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

// A link whose address was refused is left by the pass above as a bare `<a>`
// (no attributes), which the site would still style as a link. It should become
// plain text. This is done on the already-clean output with a plain text
// unwrap, not with a second `sanitize-html` pass using a function-form
// `transformTags`: that leaks state in sanitize-html 2.18 and rewrote the next
// unrelated closing tag to `</span>` (found by BLK-05's verifier).
//
// Safe to do with a pattern because the first pass has normalised the markup:
// tags are balanced, and a literal "<a>" in text is already `&lt;a&gt;`. Real
// links always carry `href`, so only bare anchors match.
const BARE_ANCHOR = /<a>((?:(?!<a[\s>]).)*?)<\/a>/gs;
const WITHOUT_LINKS: sanitizeHtml.IOptions = {
  ...OPTIONS,
  allowedTags: OPTIONS.allowedTags && OPTIONS.allowedTags.filter((tag) => tag !== 'a'),
};

function unlinkBareAnchors(html: string): string {
  let out = html;
  let previous: string;
  do {
    previous = out;
    out = out.replace(BARE_ANCHOR, '$1'); // innermost first, so nesting unwinds
  } while (out !== previous);
  // A bare anchor still standing is wrapped around a real link (invalid HTML no
  // editor produces). Drop every link in that one document rather than leave a
  // dangling tag.
  return /<a>/.test(out) ? sanitizeHtml(out, WITHOUT_LINKS) : out;
}

export function sanitizeRichText(html: string): string {
  return unlinkBareAnchors(sanitizeHtml(html, OPTIONS));
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
