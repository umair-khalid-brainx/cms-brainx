'use client';

import { useState } from 'react';
import { corrick } from '@/fixtures/corrick';
import { kestrel } from '@/fixtures/kestrel';
import { SiteChrome } from '@/site/SiteChrome';
import type { SiteFixture } from '@/site/types';

/**
 * Dev comparison view: the same block components rendering two tenants, with a
 * control that swaps the two themes between the two content sets.
 *
 * It is here to keep the theme contract honest. If any block hardcodes a
 * colour, face or radius, swapping the themes shows it immediately.
 */
export default function ComparisonPage() {
  const [swapped, setSwapped] = useState(false);

  const themeFor = (site: SiteFixture, other: SiteFixture) =>
    withTheme(site, swapped ? other.settings.theme : site.settings.theme);

  return (
    <div className="flex min-h-full flex-col">
      <Toolbar swapped={swapped} onSwap={() => setSwapped((value) => !value)} />
      <TenantPanel label="Tenant A" site={themeFor(corrick, kestrel)} borrowed={swapped ? 'Kestrel Rigging' : null} />
      <TenantPanel label="Tenant B" site={themeFor(kestrel, corrick)} borrowed={swapped ? 'Corrick Oyster Co.' : null} />
    </div>
  );
}

function withTheme(site: SiteFixture, theme: SiteFixture['settings']['theme']): SiteFixture {
  return { ...site, settings: { ...site.settings, theme } };
}

function Toolbar({ swapped, onSwap }: { swapped: boolean; onSwap: () => void }) {
  return (
    <div className="sticky top-0 z-20 border-b border-[var(--shell-line)] bg-[var(--shell-panel)]/95 px-6 backdrop-blur sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 py-4">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--shell-muted)]">
            Block renderer · dev view
          </p>
          <h1 className="mt-1 text-base font-semibold">
            Two tenants, one set of block components
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <p className="max-w-xs text-right text-xs leading-snug text-[var(--shell-muted)]">
            {swapped
              ? 'Themes swapped. Same DOM, same components — only the theme tokens moved.'
              : 'Each tenant is rendering under its own theme tokens.'}
          </p>
          <button
            type="button"
            onClick={onSwap}
            aria-pressed={swapped}
            className="shrink-0 rounded-md border border-[var(--shell-line)] bg-[var(--shell-bg)] px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] outline-none transition-colors hover:border-[var(--shell-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--shell-ink)]"
          >
            {swapped ? 'Restore themes' : 'Swap themes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TenantPanel({
  label,
  site,
  borrowed,
}: {
  label: string;
  site: SiteFixture;
  borrowed: string | null;
}) {
  return (
    <section className="border-b border-[var(--shell-line)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-3 sm:px-10">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--shell-muted)]">
          {label} · {site.settings.host}
        </p>
        <p className="font-mono text-[0.6875rem] tracking-[0.08em] text-[var(--shell-muted)]">
          {borrowed ? `theme borrowed from ${borrowed}` : `theme: ${site.settings.slug}`}
          {' · '}
          <a href={`/preview/${site.settings.slug}`} className="underline underline-offset-2">
            open full page
          </a>
        </p>
      </div>
      <SiteChrome site={site} />
    </section>
  );
}
