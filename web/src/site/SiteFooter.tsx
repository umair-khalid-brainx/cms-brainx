import type { PublicFooter } from '@/lib/publicApi';

export function SiteFooter({ name, footer }: { name: string; footer: PublicFooter }) {
  return (
    <footer className="border-t border-[var(--site-line)] bg-[var(--site-surface)] px-6 sm:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-10 py-12 sm:grid-cols-[1.2fr_repeat(2,0.9fr)]">
        <div className="flex flex-col gap-3">
          <span className="font-[family-name:var(--site-font-display)] text-lg font-semibold">{name}</span>
          {footer.note ? (
            <p className="max-w-xs text-sm leading-relaxed text-[var(--site-muted)]">{footer.note}</p>
          ) : null}
        </div>

        {footer.groups.map((group, groupIndex) => (
          <div key={groupIndex} className="flex flex-col gap-3">
            <h2 className="font-[family-name:var(--site-font-utility)] text-[0.6875rem] uppercase tracking-[0.16em] text-[var(--site-muted)]">
              {group.href ? (
                // A group title that is a page or link of its own (with nothing under it, or with).
                <a
                  href={group.href}
                  className="outline-none transition-colors hover:text-[var(--site-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]"
                >
                  {group.label}
                </a>
              ) : (
                group.label
              )}
            </h2>
            {group.children.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {group.children.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.href}
                      className="text-[var(--site-muted)] outline-none transition-colors hover:text-[var(--site-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mx-auto w-full max-w-6xl border-t border-[var(--site-line)] py-5">
        <p className="font-[family-name:var(--site-font-utility)] text-xs tracking-[0.08em] text-[var(--site-muted)]">
          {footer.bottomLine}
        </p>
      </div>
    </footer>
  );
}
