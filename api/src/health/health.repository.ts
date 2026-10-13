import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * The health check's database ping. A repository of its own so that nothing outside a repository touches
 * PrismaService (invariant 1, found by the GOV-08b scoping check): it reads no tenant data at all.
 */
@Injectable()
export class HealthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** True when the database answers. */
  async ping(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
