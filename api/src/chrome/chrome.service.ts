import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { MediaRepository } from '../media/media.repository.js';
import { MenuRepository } from '../menus/menu.repository.js';
import type { MenuInput } from '../menus/menu-tree.js';
import { SiteRepository } from '../sites/site.repository.js';
import { readSettings } from '../sites/site-settings.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { UserRepository } from '../users/user.repository.js';
import { ChromeRepository, type PresetRow } from './chrome.repository.js';
import { PER_LOCATION_MAX, createPresetSchema, updatePresetSchema } from './chrome-rules.js';

const NAME_TAKEN = 'You already have one with that name. Choose another.';

export type AdminPreset = PresetRow & { usedBy: number };

/**
 * A site's saved headers and footers: what a page or post can pick instead of the site's own. Editing one
 * changes every page that uses it, so every page of the site is refreshed.
 */
@Injectable()
export class ChromeService {
  constructor(
    private readonly presets: ChromeRepository,
    private readonly menus: MenuRepository,
    private readonly media: MediaRepository,
    private readonly users: UserRepository,
    private readonly sites: SiteRepository,
    private readonly revalidation: RevalidationService,
  ) {}

  async list(userId: string): Promise<AdminPreset[]> {
    const { siteId } = await this.membership(userId);
    const [rows, usage] = await Promise.all([this.presets.list(siteId), this.presets.usage(siteId)]);
    return rows.map((row) => ({ ...row, usedBy: usage.get(row.id) ?? 0 }));
  }

  async create(userId: string, body: unknown): Promise<AdminPreset> {
    const { siteId } = await this.membership(userId);
    const parsed = createPresetSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException([...new Set(parsed.error.issues.map((issue) => issue.message))]);
    const { location, name, copyLinks } = parsed.data;
    if ((await this.presets.count(siteId, location)) >= PER_LOCATION_MAX) {
      throw new BadRequestException(`A site can keep at most ${PER_LOCATION_MAX} saved ${location}s.`);
    }
    let row: PresetRow;
    try {
// Starts as a copy of the site's own words too, so a new one is never emptier than what it replaces.
      const own = readSettings((await this.sites.findById(siteId))?.settings);
      row = await this.presets.create(siteId, { location, name, ...(location === 'header' ? { tagline: own.tagline } : { note: own.footerNote }) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(NAME_TAKEN);
      throw error;
    }
    if (copyLinks) {
      const tree = await this.menus.findTree(siteId, location);
      const link = (item: { label: string; contentId: string | null; url: string | null }) => ({
        label: item.label,
        ...(item.contentId ? { contentId: item.contentId } : { url: item.url ?? '' }),
      });
      const menu: MenuInput = { items: tree.map((item) => ({ ...link(item), children: item.children.map(link) })) };
      try {
        await this.menus.replaceTree(siteId, location, menu, row.id);
      } catch (error) {
        // A page of the menu deleted between the read and the write: don't leave an empty one behind.
        await this.presets.remove(siteId, row.id);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
          throw new ConflictException('A page in the menu was just deleted. Try again.');
        }
        throw error;
      }
    }
    // Nothing uses it yet, so no page needs refreshing.
    return { ...(await this.presets.find(siteId, row.id) ?? row), usedBy: 0 };
  }

  async update(userId: string, id: string, body: unknown): Promise<AdminPreset> {
    const membership = await this.membership(userId);
    const { siteId } = membership;
    const parsed = updatePresetSchema(siteId).safeParse(body);
    if (!parsed.success) throw new BadRequestException([...new Set(parsed.error.issues.map((issue) => issue.message))]);
    if (parsed.data.logo && !(await this.media.findImage(siteId, parsed.data.logo))) {
      throw new BadRequestException('Choose a picture from this site’s media library');
    }
    const changes = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined));
    try {
      if (!(await this.presets.update(siteId, id, changes))) throw new NotFoundException('That saved header or footer doesn’t exist.');
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(NAME_TAKEN);
      throw error;
    }
    await this.revalidation.site(membership.site.subdomain);
    const row = await this.presets.find(siteId, id);
    if (!row) throw new NotFoundException('That saved header or footer doesn’t exist.');
    return { ...row, usedBy: (await this.presets.usage(siteId)).get(id) ?? 0 };
  }

  /** Pages that used it show the site's own again. */
  async remove(userId: string, id: string): Promise<void> {
    const membership = await this.membership(userId);
    if (!(await this.presets.remove(membership.siteId, id))) throw new NotFoundException('That saved header or footer doesn’t exist.');
    await this.revalidation.site(membership.site.subdomain);
  }

  private async membership(userId: string) {
    const membership = await this.users.findActiveMembership(userId);
    if (!membership) throw new ForbiddenException('No site membership');
    return membership;
  }
}
