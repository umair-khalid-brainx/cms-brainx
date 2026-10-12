import { Heading, Section } from './ui';
import { formatDate, type ListingEntry, type TypeListing } from './entry';

// The page at a content type's address, `/events` (TYP-03): its published entries,
// newest first, as a ruled list, not a grid of cards. Each row is a date, a title
// that links to the entry, a short summary, and its picture when it has one.
export function EntryList({ listing }: { listing: TypeListing }) {
  return (
    <Section>
      <Heading level={1}>{listing.type.name}</Heading>
      <EntryRows entries={listing.entries} empty="Nothing has been published here yet." />
    </Section>
  );
}

/** The ruled list itself, shared by a type's listing and the category and tag archives (TAX-02). */
export function EntryRows({ entries, empty }: { entries: ListingEntry[]; empty: string }) {
  return entries.length === 0 ? (
    <p className="mt-10 max-w-[var(--site-measure)] text-[var(--site-muted)]">{empty}</p>
  ) : (
    <ol className="mt-12 border-t border-[var(--site-line)]">
      {entries.map((entry) => {
        const date = formatDate(entry.publishedAt);
        return (
          <li key={entry.path} className="border-b border-[var(--site-line)]">
            <a
              href={entry.path}
              className="group grid gap-6 py-8 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--site-accent)] sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-start"
            >
              <div className="min-w-0 [overflow-wrap:anywhere]">
                {date ? (
                  <time
                    dateTime={entry.publishedAt ?? undefined}
                    className="font-[family-name:var(--site-font-utility)] text-sm text-[var(--site-muted)]"
                  >
                    {date}
                  </time>
                ) : null}
                <h2 className="mt-2 font-[family-name:var(--site-font-display)] text-[clamp(1.4rem,2.4vw,1.9rem)] font-semibold leading-[1.15] tracking-[-0.015em] text-[var(--site-ink)] underline decoration-transparent decoration-2 underline-offset-[6px] transition-colors group-hover:decoration-[var(--site-accent)]">
                  {entry.title}
                </h2>
                {entry.summary ? (
                  <p className="mt-3 max-w-[var(--site-measure)] text-[1.0625rem] leading-[1.6] text-[var(--site-muted)]">
                    {entry.summary}
                  </p>
                ) : null}
              </div>
              {entry.image ? (
                <img
                  src={entry.image.url}
                  alt={entry.image.alt}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-[var(--site-radius-md)] object-cover sm:order-last"
                />
              ) : null}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
