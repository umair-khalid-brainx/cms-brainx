import type { ReactNode } from 'react';
import type { RichTextBlock } from './types';
import { Heading, Section } from './ui';

// The typography of stored rich text (req. 2: headings, paragraphs, lists,
// links, quotations). Lives here, not in a stylesheet, so the public site and
// the editor canvas share one implementation (invariant 3) and the colours can
// only be `--site-*` (invariant 2).
//
// Descendant selectors, not `>`: in the editor canvas Puck wraps the content in
// a few extra elements, so the blocks are not direct children there.
// Spacing rules are written so no element matches two of them (a heading is
// spaced by what precedes it; a body block by what precedes it), because
// competing utilities of equal specificity would be order-dependent.
export const richTextClass = [
  'max-w-[var(--site-measure)] text-[1.0625rem] leading-[1.7] text-[var(--site-muted)]',
  // rhythm
  '[&_:is(p,ul,ol,blockquote)+:is(p,ul,ol,blockquote)]:mt-[1.15em]',
  '[&_:is(p,ul,ol,blockquote)+h2]:mt-[1.9em] [&_:is(p,ul,ol,blockquote)+h3]:mt-[1.6em]',
  '[&_:is(h2,h3)+*]:mt-[0.6em]',
  '[&_li+li]:mt-[0.4em]',
  // headings
  '[&_:is(h2,h3)]:font-[family-name:var(--site-font-display)] [&_:is(h2,h3)]:font-semibold',
  '[&_:is(h2,h3)]:tracking-[-0.015em] [&_:is(h2,h3)]:text-[var(--site-ink)] [&_:is(h2,h3)]:text-balance',
  '[&_h2]:text-[1.5rem] [&_h2]:leading-[1.2]',
  '[&_h3]:text-[1.2rem] [&_h3]:leading-[1.3]',
  // lists: the accent colours the marker only, the text stays body colour
  '[&_ul]:list-disc [&_ul]:pl-[1.25em] [&_ol]:list-decimal [&_ol]:pl-[1.4em]',
  '[&_li]:marker:text-[var(--site-accent)]',
  // the one expressive element: a quotation set in the display face
  // `!` because Puck's own editor stylesheet also styles the quote rule inside the canvas.
  '[&_blockquote]:border-l-2! [&_blockquote]:border-[var(--site-accent)]! [&_blockquote]:pl-[1.25em]',
  '[&_blockquote]:font-[family-name:var(--site-font-display)] [&_blockquote]:text-[1.25rem]',
  '[&_blockquote]:leading-[1.4] [&_blockquote]:text-[var(--site-ink)]',
  // inline
  '[&_strong]:font-semibold [&_strong]:text-[var(--site-ink)]',
  '[&_a]:text-[var(--site-ink)] [&_a]:underline [&_a]:decoration-[var(--site-accent)] [&_a]:underline-offset-[3px]',
  '[&_a:hover]:decoration-2',
].join(' ');

export function RichText({ block }: { block: RichTextBlock }) {
  return (
    <Section>
      <div className="grid gap-[var(--site-gap)] lg:grid-cols-[0.35fr_0.65fr]">
        {block.heading ? <Heading>{block.heading}</Heading> : <div />}
        {/* Sanitised on write — see the TipTap decision in the scope doc. */}
        {typeof block.html === 'string' ? (
          <div className={richTextClass} dangerouslySetInnerHTML={{ __html: block.html }} />
        ) : (
          // Editor canvas only: Puck passes a live, editable node instead of the stored string.
          <div className={richTextClass}>{block.html as unknown as ReactNode}</div>
        )}
      </div>
    </Section>
  );
}
