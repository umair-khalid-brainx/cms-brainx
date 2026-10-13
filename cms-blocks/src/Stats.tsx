import type { StatsBlock } from './types';
import { Heading, Section } from './ui';

// Columns follow the number of figures, so three never leave an empty fourth cell (found with Kestrel's pages,
// GOV-08b). Whole class names, not built from parts: Tailwind only ships classes it can read in the source.
function columnsFor(count: number): string {
  if (count <= 1) return '';
  if (count === 2) return 'sm:grid-cols-2';
  if (count === 3) return 'sm:grid-cols-3';
  return 'sm:grid-cols-2 lg:grid-cols-4';
}

export function Stats({ block }: { block: StatsBlock }) {
  const { heading, items } = block;

  return (
    <Section className="border-t border-[var(--site-line)]">
      {heading ? <Heading className="mb-10">{heading}</Heading> : null}
      <dl className={`grid gap-px overflow-hidden rounded-[var(--site-radius-md)] border border-[var(--site-line)] bg-[var(--site-line)] ${columnsFor(items.length)}`}>
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex flex-col gap-1 bg-[var(--site-surface)] px-6 py-8 text-center">
            <dd className="font-[family-name:var(--site-font-display)] text-[clamp(2rem,4vw,3rem)] leading-none text-[var(--site-accent)]">
              {item.value}
            </dd>
            <dt className="font-[family-name:var(--site-font-utility)] text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--site-muted)]">
              {item.label}
            </dt>
          </div>
        ))}
      </dl>
    </Section>
  );
}
