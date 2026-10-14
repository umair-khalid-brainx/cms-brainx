import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentTypeRepository } from '../content-types/content-type.repository.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { UserRepository } from '../users/user.repository.js';
import type { CreateRedirectDto } from './dto/redirect.dto.js';
import { RedirectRepository, type RedirectEntry } from './redirect.repository.js';
import { normaliseRedirectPath, normaliseRedirectTarget, planRedirect } from './redirect-rules.js';

/** One address that changed in a move (CNT-06): only one that was ever public needs a redirect. */
export type MovedAddress = { from: string; to: string; everPublished: boolean };

/**
 * A site's redirects (GOV-05): ones staff add on the Redirects screen, and ones made
 * automatically when a page that was ever published moves. The rules are in
 * redirect-rules.ts; every change goes through RedirectRepository.change, under a lock.
 */
@Injectable()
export class RedirectsService {
  constructor(
    private readonly redirects: RedirectRepository,
    private readonly types: ContentTypeRepository,
    private readonly users: UserRepository,
    private readonly revalidation: RevalidationService,
  ) {}

  async list(userId: string) {
    const { siteId } = await this.resolveMembership(userId);
    return (await this.redirects.findAll(siteId)).map(({ id, fromPath, toPath, source, createdAt, createdBy }) => ({
      id,
      fromPath,
      toPath,
      source,
      createdAt,
      createdBy: createdBy?.name ?? null,
    }));
  }

  /** A redirect added by hand. Refused, with words for the person, when it can't work. */
  async create(userId: string, dto: CreateRedirectDto) {
    const membership = await this.resolveMembership(userId);
    const { siteId } = membership;
    const from = normaliseRedirectPath(dto.fromPath);
    if (!from) throw new BadRequestException('The old address must be a path on this site, like /old-page.');
    if (from === '/') throw new BadRequestException('The home page can’t redirect anywhere.');
    const to = normaliseRedirectTarget(dto.toPath);
    if (!to) throw new BadRequestException('The new address must be a path on this site, like /new-page, or a full https:// address.');
    if ((await this.types.prefixes(siteId)).includes(from.slice(1))) {
      throw new ConflictException(`${from} is a content type’s listing. It can’t redirect anywhere.`);
    }

    const { touched } = await this.redirects.change(siteId, (current, pagePaths) => {
      // A page always wins: a redirect from its address would never be followed.
      if (pagePaths.has(from)) {
        throw new ConflictException(`A page lives at ${from}. Move or delete it before redirecting its address.`);
      }
      if (current.some((entry) => entry.fromPath === from)) {
        throw new ConflictException(`${from} already redirects somewhere. Delete that redirect first.`);
      }
      const plan = planRedirect(current, from, to);
      if (!plan.ok) throw new BadRequestException(plan.problem);
      return withAdded(current, { fromPath: from, toPath: plan.to, source: 'manual', createdById: userId }, plan.rewrites);
    });
    await this.refresh(membership.site.subdomain, touched);
    const created = await this.redirects.findByFrom(siteId, from);
    // A page created at that address a moment later took it over (a page wins).
    if (!created) throw new ConflictException(`A page now lives at ${from}, so it can’t redirect anywhere.`);
    return created;
  }

  async remove(userId: string, id: string): Promise<void> {
    const membership = await this.resolveMembership(userId);
    const found = await this.redirects.findById(membership.siteId, id);
    if (!found) throw new NotFoundException('Redirect not found');
    // Under the same lock as every other change, so a concurrent one can't bring it back.
    const { touched } = await this.redirects.change(membership.siteId, (current) =>
      current.filter((entry) => entry.fromPath !== found.fromPath),
    );
    await this.refresh(membership.site.subdomain, touched);
  }

  /**
   * After a move (CNT-06): the pages' new addresses can't redirect anywhere any more
   * (a page wins), and each old address that was ever public sends visitors to the new
   * one. Called by ContentService after the move is written.
   */
  async pagesMoved(siteId: string, subdomain: string, moves: readonly MovedAddress[], userId: string): Promise<void> {
    if (moves.length === 0) return;
    // Planned from the pages as they are under the lock, not as this move left them: if a
    // quick second move already ran, an old address that a page has again stays a page.
    const { touched } = await this.redirects.change(siteId, (current, pagePaths) => {
      let next = current.filter((entry) => !pagePaths.has(entry.fromPath));
      for (const move of moves) {
        if (!move.everPublished || pagePaths.has(move.from)) continue;
        const plan = planRedirect(next, move.from, move.to);
        // Can't loop once the new addresses are clear, but a move must never fail over a redirect.
        if (!plan.ok) continue;
        next = withAdded(next, { fromPath: move.from, toPath: plan.to, source: 'auto', createdById: userId }, plan.rewrites);
      }
      return next;
    });
    await this.refresh(subdomain, touched);
  }

  /** A new page took an address: any redirect from it goes, so the page is what visitors see. */
  async pathTaken(siteId: string, subdomain: string, path: string): Promise<void> {
    // Most addresses have no redirect: skip the lock and the site-wide read for them.
    if (!(await this.redirects.findByFrom(siteId, path))) return;
    // The repository drops a redirect from any page's address; `path` is one of them now.
    const { touched } = await this.redirects.change(siteId, (current) => current.filter((entry) => entry.fromPath !== path));
    await this.refresh(subdomain, touched);
  }

  // The public site caches 404s and redirects alike (CNT-08): refresh every address whose answer changed.
  private async refresh(subdomain: string, paths: readonly string[]) {
    for (const path of paths) await this.revalidation.page(subdomain, path);
  }

  private async resolveMembership(userId: string) {
    const membership = await this.users.findActiveMembership(userId);
    if (!membership) throw new ForbiddenException('No site membership');
    return membership;
  }
}

/** The list with one redirect added (replacing any from the same address) and others re-pointed. */
function withAdded(current: RedirectEntry[], added: RedirectEntry, rewrites: { fromPath: string; toPath: string }[]): RedirectEntry[] {
  const repoint = new Map(rewrites.map((row) => [row.fromPath, row.toPath]));
  return [
    ...current
      .filter((entry) => entry.fromPath !== added.fromPath)
      .map((entry) => (repoint.has(entry.fromPath) ? { ...entry, toPath: repoint.get(entry.fromPath)! } : entry)),
    added,
  ];
}
