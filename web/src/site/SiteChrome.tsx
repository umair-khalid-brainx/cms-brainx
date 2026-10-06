import type { ReactNode } from 'react';
import { SiteThemeRoot } from 'cms-blocks';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import type { SiteSettings } from './types';

/**
 * A tenant site's frame: theme scope, header and footer from site settings,
 * and whatever the route renders in between — a page's blocks, or the site's
 * own "page not found" message. Nothing here reads a global colour.
 */
export function SiteChrome({ settings, children }: { settings: SiteSettings; children: ReactNode }) {
  return (
    <SiteThemeRoot theme={settings.theme} className="flex min-h-screen flex-col">
      <SiteHeader settings={settings} />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} />
    </SiteThemeRoot>
  );
}
