import { Eyebrow, Heading, Section } from './ui';
import { termHref, type TermArchiveView } from './entry';
import { EntryRows } from './EntryList';

const KIND_LABEL = { category: 'Category', tag: 'Tag' } as const;

const focus = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--site-accent)]';

// The page at `/category/news` or `/tag/launch` (TAX-02): a heading that names the term, then the same
// ruled list as a type's listing, then a way to the other pages when there are more than one.
export function TermArchive({ archive }: { archive: TermArchiveView }) {
  const { term, entries, page, pageCount } = archive;
  const label = KIND_LABEL[term.kind];
  return (
    <Section>
      <Eyebrow>Archive</Eyebrow>
      <div className="mt-4">
        <Heading level={1}>
          {label}: {term.name}
        </Heading>
      </div>
      <EntryRows entries={entries} empty={`Nothing has been published under this ${label.toLowerCase()} yet.`} />
      {pageCount > 1 ? <Pagination kind={term.kind} slug={term.slug} page={page} pageCount={pageCount} /> : null}
    </Section>
  );
}

function Pagination({
  kind,
  slug,
  page,
  pageCount,
}: {
  kind: TermArchiveView['term']['kind'];
  slug: string;
  page: number;
  pageCount: number;
}) {
  const link =
    'font-[family-name:var(--site-font-utility)] text-sm font-semibold text-[var(--site-ink)] underline decoration-[var(--site-line)] underline-offset-4 hover:decoration-[var(--site-accent)]';
  return (
    <nav aria-label="Pages" className="mt-10 flex items-center justify-between gap-6">
      {page > 1 ? (
        <a href={termHref(kind, slug, page - 1)} rel="prev" className={`${link} ${focus}`}>
          <span aria-hidden="true">&larr; </span>Newer
        </a>
      ) : (
        <span />
      )}
      <p className="font-[family-name:var(--site-font-utility)] text-sm text-[var(--site-muted)]">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <a href={termHref(kind, slug, page + 1)} rel="next" className={`${link} ${focus}`}>
          Older<span aria-hidden="true"> &rarr;</span>
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
