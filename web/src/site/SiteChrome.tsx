import type { ReactNode } from 'react';
import { SiteThemeRoot, type SiteTheme } from 'cms-blocks';
import type { PublicChrome } from '@/lib/publicApi';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/**
 * A tenant site's frame: theme scope, a header and footer, and whatever the route renders in between
 * — a page's blocks, or the site's own "page not found" message. Nothing here reads a global colour.
 * `header` and `footer` are nodes so a layout can fill them from parallel routes (each page may pick its
 * own, or hide them); `banner` sits above the header, inside the theme scope (the preview strip, CNT-09).
 */
export function SiteFrame({
  theme,
  banner,
  header,
  footer,
  children,
}: {
  theme: SiteTheme;
  banner?: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <SiteThemeRoot theme={theme} className="flex min-h-screen flex-col">
      {banner}
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </SiteThemeRoot>
  );
}

/** The frame with a page's resolved header and footer in place (the preview, which has the whole answer at hand). */
export function SiteChrome({
  name,
  theme,
  chrome,
  banner,
  children,
}: {
  name: string;
  theme: SiteTheme;
  chrome: PublicChrome;
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SiteFrame
      theme={theme}
      banner={banner}
      header={chrome.header ? <SiteHeader name={name} header={chrome.header} /> : null}
      footer={chrome.footer ? <SiteFooter name={name} footer={chrome.footer} /> : null}
    >
      {children}
    </SiteFrame>
  );
}
