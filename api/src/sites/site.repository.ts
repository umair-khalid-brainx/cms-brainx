import { Injectable } from '@nestjs/common';
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

  updateSubdomain(id: string, subdomain: string) {
    return this.prisma.site.update({ where: { id }, data: { subdomain } });
  }
}
