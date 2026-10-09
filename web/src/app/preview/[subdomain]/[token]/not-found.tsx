/**
 * A preview link that doesn't work: unknown, revoked, for another site, or
 * for a page that's since been archived — deliberately one message for all
 * of them, so a guessed token learns nothing. Neutral styling, like
 * app/not-found.tsx: whether the site exists isn't known to this boundary.
 */
export default function PreviewNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 font-[family-name:var(--font-plex-sans)] text-stone-900">
      <div className="flex max-w-md flex-col gap-4">
        <p className="font-[family-name:var(--font-plex-mono)] text-xs uppercase tracking-[0.14em] text-stone-500">
          Error 404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">This preview link doesn&rsquo;t work</h1>
        <p className="leading-relaxed text-stone-600">
          It may have been turned off, or the page may have been archived. Ask whoever sent it for a new link.
        </p>
      </div>
    </main>
  );
}
