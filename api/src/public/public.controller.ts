import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { PublicService } from './public.service.js';

// Deliberately unguarded: this is what `web` calls to render a tenant's public
// site for visitors who never log in. Everything it can return is already
// public; what it must never return (drafts, archived pages) is filtered in
// ContentRepository.findLiveByPath. See DECISIONS.md D-030.
@Controller('public/sites/:subdomain')
export class PublicController {
  constructor(private readonly publicSite: PublicService) {}

  @Get()
  getSite(@Param('subdomain') subdomain: string) {
    return this.publicSite.getSite(subdomain);
  }

  // Path as a query param, not a wildcard route segment: page paths contain
  // slashes, and `?path=/about/team` keeps routing and encoding unambiguous.
  @Get('page')
  getPage(@Param('subdomain') subdomain: string, @Query('path') path?: string) {
    return this.publicSite.getPage(subdomain, path);
  }

  // A draft behind a secret link: never cached by anything in between, never
  // indexed even if the link leaks (CNT-09).
  @Get('preview/:token')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  getPreview(@Param('subdomain') subdomain: string, @Param('token') token: string) {
    return this.publicSite.getPreview(subdomain, token);
  }
}
