/**
 * A page that isn't live on a site that is: rendered inside that site's
 * layout, so it keeps the site's header, footer and theme. Same message for a
 * page that never existed and one that is draft or archived (D-030).
 */
export default function PageNotFound() {
  return (
    <section className="px-6 py-24 sm:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-5">
        <p className="font-[family-name:var(--site-font-utility)] text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--site-muted)]">
          Error 404
        </p>
        <h1 className="font-[family-name:var(--site-font-display)] text-4xl font-semibold tracking-[-0.01em] text-balance">
          This page doesn&rsquo;t exist
        </h1>
        <p className="max-w-prose leading-relaxed text-[var(--site-muted)]">
          The link may be out of date, or the page may have been moved or taken down.
        </p>
        <a
          href="/"
          className="rounded-[var(--site-radius-md)] bg-[var(--site-brand)] px-5 py-2.5 text-sm font-medium text-[var(--site-on-brand)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]"
        >
          Go to the home page
        </a>
      </div>
    </section>
  );
}
