import { BlockRenderer, SiteThemeRoot } from 'cms-blocks';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import type { SiteFixture, SitePage } from './types';

/**
 * A whole tenant site: theme scope, header and footer from site settings, and
 * one page's blocks in between. Rendered twice on one page by the comparison
 * view, which is only possible because nothing here reads a global colour.
 * `page` is explicit rather than derived from `site` because a site now has
 * many pages — the caller (a route) is what knows which one to render.
 */
export function SiteChrome({ site, page }: { site: SiteFixture; page: SitePage }) {
  return (
    <SiteThemeRoot theme={site.settings.theme} className="flex min-h-full flex-col">
      <SiteHeader settings={site.settings} />
      <main className="flex-1">
        <BlockRenderer blocks={page.blocks} />
      </main>
      <SiteFooter settings={site.settings} />
    </SiteThemeRoot>
  );
}
