import type { FaqBlock } from './types';
import { Heading, Prose, Section } from './ui';

export function Faq({ block }: { block: FaqBlock }) {
  const { heading, intro, items } = block;

  return (
    <Section className="border-t border-[var(--site-line)]">
      {heading || intro ? (
        <div className="mb-10 flex flex-col gap-4">
          {heading ? <Heading>{heading}</Heading> : null}
          {intro ? <Prose>{intro}</Prose> : null}
        </div>
      ) : null}
      <div className="mx-auto flex max-w-[var(--site-measure)] flex-col divide-y divide-[var(--site-line)] border-t border-[var(--site-line)]">
        {items.map((item, index) => (
          <details key={`${item.question}-${index}`} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-[family-name:var(--site-font-display)] text-lg">
              {item.question}
              <span aria-hidden="true" className="shrink-0 text-[var(--site-muted)] transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-[0.9375rem] leading-[1.6] text-[var(--site-muted)]">{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
