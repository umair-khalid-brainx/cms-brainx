import { SiteNav } from './SiteNav';
import type { SiteSettings } from './types';

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  return (
    <header className="border-b border-[var(--site-line)] px-6 sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline justify-between gap-4 py-5">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="font-[family-name:var(--site-font-display)] text-lg font-semibold tracking-[-0.01em] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]"
          >
            {settings.logoUrl ? (
              // The logo stands in for the name, so its alternative text is the name.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt={settings.name} className="block h-9 w-auto max-w-[12rem] object-contain" />
            ) : (
              settings.name
            )}
          </a>
          {settings.tagline ? (
            <span className="font-[family-name:var(--site-font-utility)] text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--site-muted)]">
              {settings.tagline}
            </span>
          ) : null}
        </div>

        <SiteNav items={settings.nav} label={`${settings.name} navigation`} />
      </div>
    </header>
  );
}
