import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { createSubmissionSchema, type CreateSubmissionDto } from '../submissions/dto/submission.dto.js';
import { FormSecretGuard } from '../submissions/form-secret.guard.js';
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

  // The header and footer menus, with unpublished pages left out (GOV-03).
  @Get('menus')
  getMenus(@Param('subdomain') subdomain: string) {
    return this.publicSite.getMenus(subdomain);
  }

  // The header and footer a page shows: the site's own, a saved one, or none (hidden).
  @Get('chrome')
  getChrome(@Param('subdomain') subdomain: string, @Query('path') path?: string) {
    return this.publicSite.getChrome(subdomain, path);
  }

  // The addresses for this site's sitemap.xml (SEO-02).
  @Get('sitemap')
  getSitemap(@Param('subdomain') subdomain: string) {
    return this.publicSite.getSitemap(subdomain);
  }

  // Where an old address sends visitors (GOV-05); `web` asks only after no page answered.
  @Get('redirect')
  getRedirect(@Param('subdomain') subdomain: string, @Query('path') path?: string) {
    return this.publicSite.getRedirect(subdomain, path);
  }

  // The page at a content type's address, `/events`: its published entries, newest first (TYP-03).
  @Get('types/:prefix')
  getListing(@Param('subdomain') subdomain: string, @Param('prefix') prefix: string) {
    return this.publicSite.getListing(subdomain, prefix);
  }

  // A category or tag and a page of its published entries, newest first (TAX-02).
  @Get('terms/:kind/:slug')
  getTermArchive(
    @Param('subdomain') subdomain: string,
    @Param('kind') kind: string,
    @Param('slug') slug: string,
    @Query('page') page?: string,
  ) {
    return this.publicSite.getTermArchive(subdomain, kind, slug, page);
  }

  // A draft behind a secret link: never cached by anything in between, never
  // indexed even if the link leaks (CNT-09).
  @Get('preview/:token')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  getPreview(@Param('subdomain') subdomain: string, @Param('token') token: string) {
    return this.publicSite.getPreview(subdomain, token);
  }

  // The one write under /public. Not open like the reads: only `web`'s server
  // action holds the secret, so the honeypot and rate limit there can't be
  // skipped by calling this directly (D-034).
  @Post('submissions')
  @UseGuards(FormSecretGuard)
  submit(
    @Param('subdomain') subdomain: string,
    @Body(new ZodValidationPipe(createSubmissionSchema)) body: CreateSubmissionDto,
  ) {
    return this.publicSite.submit(subdomain, body);
  }
}
