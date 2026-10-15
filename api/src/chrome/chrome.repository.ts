import { Injectable } from '@nestjs/common';
import type { MenuLocation } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type PresetRow = {
  id: string;
  location: MenuLocation;
  name: string;
  tagline: string;
  logo: string;
  note: string;
  bottomText: string;
};

// Every method takes `siteId` as a required parameter (invariant 1).
@Injectable()
export class ChromeRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(siteId: string): Promise<PresetRow[]> {
    return this.prisma.chromePreset.findMany({ where: { siteId }, orderBy: [{ location: 'asc' }, { name: 'asc' }] });
  }

  find(siteId: string, id: string): Promise<PresetRow | null> {
    return this.prisma.chromePreset.findFirst({ where: { siteId, id } });
  }

  count(siteId: string, location: MenuLocation): Promise<number> {
    return this.prisma.chromePreset.count({ where: { siteId, location } });
  }

  create(siteId: string, data: { location: MenuLocation; name: string; tagline?: string; note?: string }): Promise<PresetRow> {
    return this.prisma.chromePreset.create({ data: { siteId, ...data } });
  }

  async update(siteId: string, id: string, data: Partial<Omit<PresetRow, 'id' | 'location'>>): Promise<boolean> {
    return (await this.prisma.chromePreset.updateMany({ where: { siteId, id }, data })).count > 0;
  }

  /** Deleting takes its links with it (cascade). */
  async remove(siteId: string, id: string): Promise<boolean> {
    return (await this.prisma.chromePreset.deleteMany({ where: { siteId, id } })).count > 0;
  }

  /** How many pages and entries of the site use each saved header or footer, for "used on N pages". */
  async usage(siteId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ id: string; uses: bigint }[]>`
      SELECT p.id AS id, COUNT(c.id) AS uses
      FROM chrome_presets p
      JOIN content c ON c.site_id = p.site_id AND c.status <> 'archived'
        AND ((p.location = 'header' AND c.chrome->>'header' = p.id) OR (p.location = 'footer' AND c.chrome->>'footer' = p.id))
      WHERE p.site_id = ${siteId}
      GROUP BY p.id`;
    return new Map(rows.map((row) => [row.id, Number(row.uses)]));
  }
}
