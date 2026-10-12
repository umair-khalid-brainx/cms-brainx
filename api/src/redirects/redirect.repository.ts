import { Injectable } from '@nestjs/common';
import type { RedirectSource } from '../generated/prisma/client.js';
import { TREE_TRANSACTION } from '../content/content.repository.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type RedirectEntry = { fromPath: string; toPath: string; source: RedirectSource; createdById: string | null };

/** What a change did, so the service can refresh exactly those addresses on the public site. */
export type RedirectChange = { touched: string[] };

// Every method takes `siteId` as a required parameter (invariant 1).
@Injectable()
export class RedirectRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(siteId: string) {
    return this.prisma.redirect.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });
  }

  /** The one read the public site makes: where an address sends visitors, if anywhere. */
  findByFrom(siteId: string, fromPath: string) {
    return this.prisma.redirect.findUnique({ where: { siteId_fromPath: { siteId, fromPath } } });
  }

  /**
   * Changes a site's redirects as a whole (GOV-05): `plan` gets the current list and the
   * addresses pages and entries have right now, both read inside the transaction under a
   * per-site lock, and returns the list as it should be. Only the differences are written.
   * Locked so two changes can't each plan from the old list and leave a chain behind.
   * Whatever `plan` returns, a redirect from an address a page has is dropped: a page always
   * wins, checked against the pages as they are now, not as a caller remembered them.
   * `plan` may throw to refuse; nothing is written then.
   */
  change(siteId: string, plan: (current: RedirectEntry[], pagePaths: ReadonlySet<string>) => RedirectEntry[]): Promise<RedirectChange> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`redirects:${siteId}`}))`;
      const current = await tx.redirect.findMany({
        where: { siteId },
        select: { fromPath: true, toPath: true, source: true, createdById: true },
      });
      const pagePaths = new Set((await tx.content.findMany({ where: { siteId }, select: { path: true } })).map((row) => row.path));
      const next = new Map(
        plan(current, pagePaths)
          .filter((entry) => !pagePaths.has(entry.fromPath))
          .map((entry) => [entry.fromPath, entry]),
      );
      const before = new Map(current.map((entry) => [entry.fromPath, entry]));

      const removed = current.filter((entry) => !next.has(entry.fromPath)).map((entry) => entry.fromPath);
      const written = [...next.values()].filter((entry) => {
        const old = before.get(entry.fromPath);
        return !old || old.toPath !== entry.toPath || old.source !== entry.source;
      });

      if (removed.length > 0) await tx.redirect.deleteMany({ where: { siteId, fromPath: { in: removed } } });
      for (const entry of written) {
        await tx.redirect.upsert({
          where: { siteId_fromPath: { siteId, fromPath: entry.fromPath } },
          create: { siteId, ...entry },
          update: { toPath: entry.toPath, source: entry.source },
        });
      }
      return { touched: [...removed, ...written.map((entry) => entry.fromPath)] };
    }, TREE_TRANSACTION);
  }

  findById(siteId: string, id: string) {
    return this.prisma.redirect.findFirst({ where: { siteId, id } });
  }
}
