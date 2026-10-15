import { SiteNav } from './SiteNav';
import type { PublicHeader } from '@/lib/publicApi';

export function SiteHeader({ name, header }: { name: string; header: PublicHeader }) {
  return (
    <header className="border-b border-[var(--site-line)] px-6 sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline justify-between gap-4 py-5">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="font-[family-name:var(--site-font-display)] text-lg font-semibold tracking-[-0.01em] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]"
          >
            {header.logo ? (
              // The logo stands in for the name, so its alternative text is the name.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={header.logo.url} alt={name} className="block h-9 w-auto max-w-[12rem] object-contain" />
            ) : (
              name
            )}
          </a>
          {header.tagline ? (
            <span className="font-[family-name:var(--site-font-utility)] text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--site-muted)]">
              {header.tagline}
            </span>
          ) : null}
        </div>

        <SiteNav items={header.nav} label={`${name} navigation`} />
      </div>
    </header>
  );
}
