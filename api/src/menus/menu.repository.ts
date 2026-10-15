import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MenuInput, MenuLocation, StoredItem } from './menu-tree.js';

/** A stored item with what the admin needs to show the page it points at. */
export type AdminMenuItem = {
  label: string;
  contentId: string | null;
  url: string | null;
  page: { title: string; path: string; status: string } | null;
  children: AdminMenuItem[];
};

const PAGE = { select: { title: true, path: true, status: true } } as const;

// Every method takes `siteId` as a required parameter (invariant 1).
@Injectable()
export class MenuRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** One menu, in order, with the pages its items point at. `presetId` null is the site's own menu. */
  async findTree(siteId: string, location: MenuLocation, presetId: string | null = null): Promise<AdminMenuItem[]> {
    const items = await this.prisma.menuItem.findMany({
      where: { siteId, location, presetId, parentId: null },
      orderBy: { position: 'asc' },
      include: { content: PAGE, children: { orderBy: { position: 'asc' }, include: { content: PAGE } } },
    });
    const shape = (item: (typeof items)[number]['children'][number]): AdminMenuItem => ({
      label: item.label,
      contentId: item.contentId,
      url: item.url,
      page: item.content,
      children: [],
    });
    return items.map((item) => ({ ...shape(item), children: item.children.map(shape) }));
  }

  /** Both of the site's own menus as stored, for the public site (it resolves the pages itself, against the live ones). */
  async findForPublic(siteId: string): Promise<Record<MenuLocation, StoredItem[]>> {
    const items = await this.prisma.menuItem.findMany({
      where: { siteId, presetId: null, parentId: null },
      orderBy: { position: 'asc' },
      include: { children: { orderBy: { position: 'asc' } } },
    });
    const shape = (item: { label: string; contentId: string | null; url: string | null }) => ({
      label: item.label,
      contentId: item.contentId,
      url: item.url,
    });
    const menus: Record<MenuLocation, StoredItem[]> = { header: [], footer: [] };
    for (const item of items) menus[item.location].push({ ...shape(item), children: item.children.map(shape) });
    return menus;
  }

  /** The stored links of some saved headers and footers, by preset id. */
  async findForPresets(siteId: string, presetIds: readonly string[]): Promise<Map<string, StoredItem[]>> {
    const menus = new Map<string, StoredItem[]>(presetIds.map((id) => [id, []]));
    if (presetIds.length === 0) return menus;
    const items = await this.prisma.menuItem.findMany({
      where: { siteId, presetId: { in: [...presetIds] }, parentId: null },
      orderBy: { position: 'asc' },
      include: { children: { orderBy: { position: 'asc' } } },
    });
    const shape = (item: { label: string; contentId: string | null; url: string | null }) => ({ label: item.label, contentId: item.contentId, url: item.url });
    for (const item of items) menus.get(item.presetId as string)?.push({ ...shape(item), children: item.children.map(shape) });
    return menus;
  }

  /**
   * Replaces one menu with `menu`, all or nothing (GOV-03): the old items go and the new ones, with
   * their children, are written in one transaction, under a lock so two saves of the same menu run one
   * after the other and the last one wins whole, never half of each.
   */
  replaceTree(siteId: string, location: MenuLocation, menu: MenuInput, presetId: string | null = null): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`menu:${siteId}:${location}:${presetId ?? ''}`}))`;
      await tx.menuItem.deleteMany({ where: { siteId, location, presetId } });
      const target = (item: { contentId?: string; url?: string }) => ({ contentId: item.contentId ?? null, url: item.url || null });
      for (const [position, item] of menu.items.entries()) {
        await tx.menuItem.create({
          data: {
            siteId,
            location,
            presetId,
            position,
            label: item.label,
            ...target(item),
            children: {
              create: item.children.map((child, childPosition) => ({
                siteId,
                location,
                presetId,
                position: childPosition,
                label: child.label,
                ...target(child),
              })),
            },
          },
        });
      }
    });
  }

  /** Which of the site's menus point at this page, for refusing to delete it while it is in one (GOV-03). */
  async locationsUsing(siteId: string, contentId: string): Promise<MenuLocation[]> {
    const items = await this.prisma.menuItem.findMany({ where: { siteId, contentId }, distinct: ['location'], select: { location: true } });
    return items.map((item) => item.location);
  }

  /** Whether any menu of this site points at one of these pages: moving or hiding one changes the site's header. */
  async usesPages(siteId: string, contentIds: readonly string[]): Promise<boolean> {
    if (contentIds.length === 0) return false;
    return (await this.prisma.menuItem.count({ where: { siteId, contentId: { in: [...contentIds] } } })) > 0;
  }
}
