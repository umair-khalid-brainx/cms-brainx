import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Sites aren't tenant-scoped content — a site *is* the tenant — but
 * `PrismaService` access still goes through a repository per invariant 2.
 */
@Injectable()
export class SiteRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.site.findUnique({ where: { id } });
  }

  findBySubdomain(subdomain: string) {
    return this.prisma.site.findUnique({ where: { subdomain } });
  }

  /** The title and/or the settings JSON of a site, in one write (GOV-04). */
  updateSettings(id: string, data: { name?: string; settings: Prisma.InputJsonValue }) {
    return this.prisma.site.update({ where: { id }, data });
  }

  updateSubdomain(id: string, subdomain: string) {
    return this.prisma.site.update({ where: { id }, data: { subdomain } });
  }
}
