'use client';

import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react';
import type { ContactFormBlock } from './types';
import { Heading, Prose, Section } from './ui';

const fieldClass =
  'rounded-[var(--site-radius-sm)] border border-[var(--site-line)] bg-[var(--site-paper)] px-4 py-3 text-[0.9375rem] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]';

/** Hidden from people, tempting to bots. Anything in it marks the submission as spam (D-034). */
export const CONTACT_FORM_HONEYPOT = 'hp_website';

export type ContactFormSubmission = {
  /** The page the form is on, e.g. `/contact`. */
  path: string;
  /** Which block on that page — the API reads the form's fields from it. */
  blockIndex: number;
  values: Record<string, string>;
  honeypot: string;
};

export type ContactFormResult = { ok: true } | { ok: false; error: string };
export type ContactFormSubmit = (submission: ContactFormSubmission) => Promise<ContactFormResult>;

const ContactFormSubmitContext = createContext<ContactFormSubmit | null>(null);

/**
 * How a surface tells `ContactForm` where submissions go. `web` provides its
 * server action here; the editor canvas provides nothing, so the form there
 * is a preview that never sends. Keeps cms-blocks free of any network code.
 */
export function ContactFormProvider({ submit, children }: { submit: ContactFormSubmit; children: ReactNode }) {
  return <ContactFormSubmitContext.Provider value={submit}>{children}</ContactFormSubmitContext.Provider>;
}

type FormState = { status: 'idle' } | { status: 'sending' } | { status: 'sent' } | { status: 'preview' } | { status: 'error'; message: string };

export function ContactForm({ block, index }: { block: ContactFormBlock; index?: number }) {
  const { heading, intro, submitLabel, fields } = block;
  const submit = useContext(ContactFormSubmitContext);
  const [state, setState] = useState<FormState>({ status: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submit || index === undefined) {
      setState({ status: 'preview' });
      return;
    }

    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(fields.map((field) => [field.name, String(data.get(field.name) ?? '')]));
    setState({ status: 'sending' });
    try {
      const result = await submit({
        path: window.location.pathname,
        blockIndex: index,
        values,
        honeypot: String(data.get(CONTACT_FORM_HONEYPOT) ?? ''),
      });
      setState(result.ok ? { status: 'sent' } : { status: 'error', message: result.error });
    } catch {
      setState({ status: 'error', message: 'Something went wrong. Please try again.' });
    }
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

        {state.status === 'sent' ? (
          <p
            role="status"
            className="rounded-[var(--site-radius-md)] border border-[var(--site-line)] bg-[var(--site-surface)] px-5 py-4 text-[0.9375rem] text-[var(--site-muted)]"
          >
            Thanks, your message has been sent.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="relative flex flex-col gap-5">
            {/* Honeypot: off-screen rather than display:none, which some bots skip. */}
            <div aria-hidden="true" className="absolute -left-[10000px] top-0 h-px w-px overflow-hidden">
              <label>
                Leave this field empty
                <input type="text" name={CONTACT_FORM_HONEYPOT} tabIndex={-1} autoComplete="off" />
              </label>
            </div>
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
            {state.status === 'error' ? (
              <p role="alert" className="text-[0.9375rem] text-[var(--site-ink)]">
                {state.message}
              </p>
            ) : null}
            {/* The editor canvas: the form stays usable, it just never sends. */}
            {state.status === 'preview' ? (
              <p role="status" className="text-[0.9375rem] text-[var(--site-muted)]">
                This is a preview. Submissions are only collected on the live site.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={state.status === 'sending'}
              className="inline-flex w-fit items-center gap-2 rounded-[var(--site-radius-pill)] bg-[var(--site-brand)] px-6 py-3 font-[family-name:var(--site-font-utility)] text-sm font-semibold tracking-[0.02em] text-[var(--site-on-brand)] transition-transform hover:-translate-y-px disabled:opacity-60"
            >
              {state.status === 'sending' ? 'Sending…' : submitLabel}
            </button>
          </form>
        )}
      </div>
    </Section>
  );
}
