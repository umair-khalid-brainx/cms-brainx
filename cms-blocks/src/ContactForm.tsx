'use client';

import { useState, type FormEvent } from 'react';
import type { ContactFormBlock } from './types';
import { Heading, Prose, Section } from './ui';

const fieldClass =
  'rounded-[var(--site-radius-sm)] border border-[var(--site-line)] bg-[var(--site-paper)] px-4 py-3 text-[0.9375rem] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]';

export function ContactForm({ block }: { block: ContactFormBlock }) {
  const { heading, intro, submitLabel, fields } = block;
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // No submission endpoint yet — see docs/BACKLOG.md.
    setSubmitted(true);
  }

  return (
    <Section className="border-t border-[var(--site-line)]">
      <div className="mx-auto flex max-w-[var(--site-measure)] flex-col gap-8">
        {heading || intro ? (
          <div className="flex flex-col gap-4">
            {heading ? <Heading>{heading}</Heading> : null}
            {intro ? <Prose>{intro}</Prose> : null}
          </div>
        ) : null}

        {submitted ? (
          <p className="rounded-[var(--site-radius-md)] border border-[var(--site-line)] bg-[var(--site-surface)] px-5 py-4 text-[0.9375rem] text-[var(--site-muted)]">
            Thanks — this form isn&apos;t wired up to send anywhere yet.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {fields.map((field) => (
              <label key={field.name} className="flex flex-col gap-2">
                <span className="font-[family-name:var(--site-font-utility)] text-xs uppercase tracking-[0.12em] text-[var(--site-muted)]">
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                {field.fieldType === 'textarea' ? (
                  <textarea name={field.name} required={field.required} rows={4} className={fieldClass} />
                ) : (
                  <input type={field.fieldType} name={field.name} required={field.required} className={fieldClass} />
                )}
              </label>
            ))}
            <button
              type="submit"
              className="inline-flex w-fit items-center gap-2 rounded-[var(--site-radius-pill)] bg-[var(--site-brand)] px-6 py-3 font-[family-name:var(--site-font-utility)] text-sm font-semibold tracking-[0.02em] text-[var(--site-on-brand)] transition-transform hover:-translate-y-px"
            >
              {submitLabel}
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}
