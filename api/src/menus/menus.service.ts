import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentRepository } from '../content/content.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { UserRepository } from '../users/user.repository.js';
import { ChromeRepository } from '../chrome/chrome.repository.js';
import { MenuRepository, type AdminMenuItem } from './menu.repository.js';
import { menuSchema, pageIdsOf, type MenuLocation } from './menu-tree.js';

const GONE_PAGE = 'A page in this menu doesn’t exist on this site any more. Remove it and save again.';

/**
 * A site's header and footer menus (GOV-03). Only the whole menu is read or written: the editor sends
 * the tree it ended up with, and what is stored is exactly that, or nothing changes.
 */
@Injectable()
export class MenusService {
  constructor(
    private readonly menus: MenuRepository,
    private readonly content: ContentRepository,
    private readonly users: UserRepository,
    private readonly chrome: ChromeRepository,
    private readonly revalidation: RevalidationService,
  ) {}

  /** `presetId` names a saved header or footer; without it, the site's own menu. */
  async get(userId: string, location: MenuLocation, presetId?: string): Promise<{ location: MenuLocation; items: AdminMenuItem[] }> {
    const { siteId } = await this.resolveMembership(userId);
    await this.checkPreset(siteId, location, presetId);
    return { location, items: await this.menus.findTree(siteId, location, presetId ?? null) };
  }

  /** A saved header or footer must be this site's and of this menu's kind. */
  private async checkPreset(siteId: string, location: MenuLocation, presetId: string | undefined) {
    if (presetId === undefined) return;
    const preset = await this.chrome.find(siteId, presetId);
    if (!preset || preset.location !== location) throw new NotFoundException('That saved header or footer doesn’t exist.');
  }

  /**
   * Saves one menu. Every page it points at must be a page or entry of this site (any status: a draft can
   * be put in a menu ahead of time, it just isn't shown until it is live). Nothing is written if any part
   * is refused. Every page of the site shows the header and footer, so every page is refreshed.
   */
  async save(userId: string, location: MenuLocation, body: unknown, presetId?: string) {
    const membership = await this.resolveMembership(userId);
    const { siteId } = membership;
    await this.checkPreset(siteId, location, presetId);
    const parsed = menuSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException([...new Set(parsed.error.issues.map((issue) => issue.message))]);

    const ids = pageIdsOf(parsed.data);
    if (ids.length > 0 && (await this.content.findFactsByIds(siteId, ids)).length !== ids.length) {
      throw new BadRequestException(GONE_PAGE);
    }

    try {
      await this.menus.replaceTree(siteId, location, parsed.data, presetId ?? null);
    } catch (error) {
      // A page deleted for good between the check above and the write: the foreign key refuses it, and
      // nothing was written. The same answer as the check gives.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw new BadRequestException(GONE_PAGE);
      throw error;
    }
    await this.revalidation.site(membership.site.subdomain);
    return this.get(userId, location, presetId);
  }

  private async resolveMembership(userId: string) {
    const membership = await this.users.findActiveMembership(userId);
    if (!membership) throw new ForbiddenException('No site membership');
    return membership;
  }
}
