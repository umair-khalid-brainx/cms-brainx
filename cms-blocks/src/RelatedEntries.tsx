import { formatDate, type ListingEntry } from './entry';
import { Heading, Section } from './ui';

// Under an entry (TAX-02): up to three others of the same type that share a category, else a tag, as
// cards. Nothing at all when there are none, so an entry never ends in an empty heading.
export function RelatedEntries({ entries }: { entries: ListingEntry[] | undefined }) {
  if (!entries || entries.length === 0) return null;
  return (
    <Section bleed className="pt-[var(--site-section-y)] pb-[var(--site-section-y)]">
      <aside aria-labelledby="related-heading" className="border-t border-[var(--site-line)] pt-10">
        <div id="related-heading">
          <Heading level={2}>Related</Heading>
        </div>
        <ul className="mt-8 grid gap-[var(--site-gap)] sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => {
            const date = formatDate(entry.publishedAt);
            return (
              <li key={entry.path}>
                <a
                  href={entry.path}
                  className="group flex h-full flex-col gap-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--site-accent)]"
                >
                  {entry.image ? (
                    <img
                      src={entry.image.url}
                      alt={entry.image.alt}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-[var(--site-radius-md)] object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    {date ? (
                      <time
                        dateTime={entry.publishedAt ?? undefined}
                        className="font-[family-name:var(--site-font-utility)] text-sm text-[var(--site-muted)]"
                      >
                        {date}
                      </time>
                    ) : null}
                    <h3 className="mt-2 font-[family-name:var(--site-font-display)] text-[1.25rem] font-semibold leading-[1.2] tracking-[-0.01em] text-[var(--site-ink)] underline decoration-transparent decoration-2 underline-offset-[6px] transition-colors group-hover:decoration-[var(--site-accent)]">
                      {entry.title}
                    </h3>
                    {entry.summary ? (
                      <p className="mt-2 text-[1rem] leading-[1.55] text-[var(--site-muted)]">{entry.summary}</p>
                    ) : null}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </aside>
    </Section>
  );
}
