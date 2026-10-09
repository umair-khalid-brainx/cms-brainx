import { richTextClass } from './RichText';
import { ActionLink, Heading, Section } from './ui';
import { formatDate, type EntryField, type EntryView } from './entry';

// The top of a content type's entry page (TYP-03): the title, who and when, its
// picture, and the type's fields laid out by what they are. It follows the site's
// theme through `--site-*` variables only, so an events page and a blog post look
// like the same site and two tenants look different. The entry's own blocks render
// below it.
//
// Layout, by kind rather than by a template per type:
//  - the first picture is the lead image;
//  - an excerpt or summary, or any long text, leads under the title;
//  - short facts (text, choice, date) are a quiet list beside the body;
//  - links and downloadable files are actions;
//  - formatted text is the body, each field under its own name.
const LEDE_MIN_LENGTH = 80;
// Fields whose whole purpose is to introduce the entry lead it however short they are (Posts has an `excerpt`).
const LEDE_KEYS = new Set(['excerpt', 'summary', 'intro', 'standfirst']);

export function EntryHeader({ title, entry }: { title: string; entry: EntryView }) {
  const { fields } = entry;
  const lead = fields.find((field) => field.kind === 'media' && field.file.isImage);
  const ledes = fields.filter((field) => field.kind === 'text' && (field.text.length > LEDE_MIN_LENGTH || LEDE_KEYS.has(field.key)));
  const facts = fields.filter(
    (field) => (field.kind === 'text' && !ledes.includes(field)) || field.kind === 'select' || field.kind === 'date',
  );
  const actions = fields.filter(
    (field) => field.kind === 'link' || (field.kind === 'media' && field !== lead),
  );
  const body = fields.filter((field) => field.kind === 'richText');
  const published = formatDate(entry.publishedAt);

  const sidebar = (
    <div className="flex flex-col gap-8">
      {facts.length > 0 ? <Facts fields={facts} /> : null}
      {actions.length > 0 ? <Actions fields={actions} /> : null}
    </div>
  );

  return (
    // No bottom padding of its own: the entry's blocks that follow bring their own spacing.
    <Section bleed className="pt-[var(--site-section-y)] pb-2">
      <header className="max-w-[var(--site-measure)]">
        <a
          href={`/${entry.type.prefix}`}
          className="font-[family-name:var(--site-font-utility)] text-sm text-[var(--site-muted)] underline decoration-[var(--site-line)] underline-offset-4 hover:text-[var(--site-ink)] hover:decoration-[var(--site-accent)]"
        >
          <span aria-hidden="true">&larr; </span>
          {entry.type.name}
        </a>
        <div className="mt-6">
          <Heading level={1}>{title}</Heading>
        </div>
        {entry.author || published ? (
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 font-[family-name:var(--site-font-utility)] text-sm text-[var(--site-muted)]">
            {entry.author ? <span>{entry.author}</span> : null}
            {published ? <time dateTime={entry.publishedAt ?? undefined}>{published}</time> : null}
          </p>
        ) : null}
        {ledes.map((field) =>
          field.kind === 'text' ? (
            <p key={field.key} className="mt-6 text-[1.1875rem] leading-[1.6] text-[var(--site-muted)]">
              {field.text}
            </p>
          ) : null,
        )}
      </header>

      {lead && lead.kind === 'media' ? (
        <figure className="mt-10 overflow-hidden rounded-[var(--site-radius-lg)] bg-[var(--site-surface)]">
          <img src={lead.file.url} alt={lead.file.alt} className="aspect-[16/9] w-full object-cover" />
        </figure>
      ) : null}

      {body.length > 0 ? (
        <div className="mt-12 grid gap-[var(--site-gap)] lg:grid-cols-[0.35fr_0.65fr]">
          {sidebar}
          <div className="flex flex-col gap-10">
            {body.map((field) =>
              field.kind === 'richText' ? (
                <section key={field.key}>
                  <h2 className="mb-3 font-[family-name:var(--site-font-display)] text-[1.25rem] font-semibold text-[var(--site-ink)]">
                    {field.label}
                  </h2>
                  <div className={richTextClass} dangerouslySetInnerHTML={{ __html: field.html }} />
                </section>
              ) : null,
            )}
          </div>
        </div>
      ) : facts.length + actions.length > 0 ? (
        <div className="mt-12 max-w-[var(--site-measure)]">{sidebar}</div>
      ) : null}
    </Section>
  );
}

function Facts({ fields }: { fields: EntryField[] }) {
  return (
    <dl className="border-t border-[var(--site-line)]">
      {fields.map((field) => (
        <div key={field.key} className="grid grid-cols-[7rem_1fr] gap-4 border-b border-[var(--site-line)] py-3">
          <dt className="font-[family-name:var(--site-font-utility)] text-sm text-[var(--site-muted)]">{field.label}</dt>
          <dd className="text-[var(--site-ink)]">
            {field.kind === 'date' ? formatDate(field.date) : field.kind === 'text' || field.kind === 'select' ? field.text : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Actions({ fields }: { fields: EntryField[] }) {
  return (
    <div className="flex flex-col items-start gap-4">
      {fields.map((field) => {
        if (field.kind === 'link') {
          return <ActionLink key={field.key} variant="primary" action={{ label: field.link.label || field.label, href: field.link.href }} />;
        }
        if (field.kind === 'media') {
          // A picture beyond the lead one is a download too. Labelled by the field and the kind of
          // file ("Slides (PDF)"), not by a stored file name, which is a generated code.
          const kind = field.file.url.split('?')[0].split('.').pop()?.toUpperCase();
          return <ActionLink key={field.key} variant="secondary" action={{ label: kind ? `${field.label} (${kind})` : field.label, href: field.file.url }} />;
        }
        return null;
      })}
    </div>
  );
}
