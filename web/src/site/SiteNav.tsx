'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { MenuItem } from '@/lib/publicApi';

// The header navigation (GOV-03). Wide screens: the top items in a row, and an item with items under it
// drops them down on hover, or on its toggle button for keyboard and touch (the disclosure pattern: the
// link stays a link, a separate button opens the list; Esc closes it and gives focus back to the
// button). Narrow screens: a "Menu" button opens a list with everything shown, nothing hidden behind
// hover. Colour comes from the site's own tokens only.

const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]';
const itemLink = `text-[var(--site-muted)] transition-colors hover:text-[var(--site-ink)] ${focusRing}`;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      className={`transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteNav({ items, label }: { items: MenuItem[]; label: string }) {
  const listId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Which dropdown is open from a click or the keyboard (hover opens one by itself, in CSS).
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // A click or tap anywhere else closes an open dropdown.
  useEffect(() => {
    if (openIndex === null) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenIndex(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [openIndex]);

  if (items.length === 0) return null;

  return (
    <nav ref={rootRef} aria-label={label} className="font-[family-name:var(--site-font-utility)] text-sm">
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls={listId}
        onClick={() => setMenuOpen((open) => !open)}
        className={`inline-flex items-center gap-2 rounded-[var(--site-radius-md)] border border-[var(--site-line)] px-3 py-2 md:hidden ${focusRing}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Menu
      </button>

      <ul
        id={listId}
        className={`${menuOpen ? 'flex' : 'hidden'} mt-3 flex-col gap-3 md:mt-0 md:flex md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-2`}
      >
        {items.map((item, index) => {
          const open = openIndex === index;
          const panelId = `${listId}-${index}`;
          if (item.children.length === 0) {
            return (
              <li key={`${item.label}-${index}`}>
                {item.href ? (
                  <a href={item.href} onClick={() => setMenuOpen(false)} className={itemLink}>
                    {item.label}
                  </a>
                ) : null}
              </li>
            );
          }
          return (
            <li
              key={`${item.label}-${index}`}
              className="group relative"
              onKeyDown={(event) => {
                if (event.key !== 'Escape' || !open) return;
                setOpenIndex(null);
                (event.currentTarget.querySelector('button[aria-controls]') as HTMLElement | null)?.focus();
              }}
              onBlur={(event) => {
                if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenIndex(null);
              }}
            >
              <div className="flex items-center gap-1">
                {item.href ? (
                  <a href={item.href} onClick={() => setMenuOpen(false)} className={itemLink}>
                    {item.label}
                  </a>
                ) : (
                  <>
                    {/* A heading with no page of its own. Narrow: just its label, the items are listed under it.
                        Wide: the label is the button that opens them. */}
                    <span className="md:hidden">{item.label}</span>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex(open ? null : index)}
                      className={`hidden items-center gap-1 md:inline-flex ${itemLink}`}
                    >
                      {item.label}
                      <Chevron open={open} />
                    </button>
                  </>
                )}
                {item.href ? (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    aria-label={`${item.label}: more`}
                    onClick={() => setOpenIndex(open ? null : index)}
                    className={`hidden h-7 w-7 place-items-center rounded-[var(--site-radius-md)] text-[var(--site-muted)] hover:text-[var(--site-ink)] md:grid ${focusRing}`}
                  >
                    <Chevron open={open} />
                  </button>
                ) : null}
              </div>

              {/* Narrow: always listed under its item. Wide: a panel, open on hover or when toggled. The panel
                  starts right at the item's bottom edge (its gap is padding inside it), so moving the pointer
                  down from the item never leaves the hover area. */}
              <ul
                id={panelId}
                className={`mt-2 flex flex-col gap-2 border-l border-[var(--site-line)] pl-4 md:absolute md:left-0 md:top-full md:z-20 md:mt-0 md:min-w-[12rem] md:rounded-[var(--site-radius-md)] md:border md:bg-[var(--site-surface)] md:p-3 md:pl-3 ${
                  open ? 'md:flex' : 'md:hidden'
                } md:group-hover:flex`}
              >
                {item.children.map((child, childIndex) => (
                  <li key={childIndex}>
                    <a href={child.href} onClick={() => setMenuOpen(false)} className={itemLink}>
                      {child.label}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
