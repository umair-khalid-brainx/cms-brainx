import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { RevalidationService } from '../revalidation/revalidation.service.js';
import { UserRepository } from '../users/user.repository.js';
import type { CreateTermDto, RenameTermDto } from './dto/term.dto.js';
import { TermRepository, type TermRow } from './term.repository.js';
import { checkCategoryIds, KIND_LABEL, optInProblem, parseTagNames, parseTermName, type TermKind } from './term-rules.js';

/** What the entry's type allows and what the editor asked for; `undefined` means "leave as it is". */
export type TermAssignment = { categoryIds?: string[]; tags?: string[] };

/** What a save asked for, checked but not yet written: categories as ids, tags as names still to create. */
export type CheckedAssignment = ({ kind: 'category'; termIds: string[] } | { kind: 'tag'; names: Parameters<TermRepository['findOrCreateTags']>[1] })[];

/** The links to write for each kind that was asked about: the whole new set, not a change. */
export type TermLinks = { kind: TermKind; termIds: string[] }[];

type TypeOptIn = { name: string; hasCategories: boolean; hasTags: boolean };

/**
 * A site's categories and tags (TAX-01). Managing the lists is for those who may publish (the routes
 * check that); assigning terms to an entry is part of saving it, so it is checked and, for tags, created
 * here but permitted by `content:write`.
 */
@Injectable()
export class TermsService {
  constructor(
    private readonly terms: TermRepository,
    private readonly users: UserRepository,
    private readonly revalidation: RevalidationService,
  ) {}

  async list(userId: string) {
    return this.terms.findAllWithCounts(await this.resolveSiteId(userId));
  }

  async create(userId: string, dto: CreateTermDto) {
    const siteId = await this.resolveSiteId(userId);
    const parsed = parseTermName(dto.name, dto.kind);
    if (!parsed.ok) throw new BadRequestException(parsed.problem);
    if (await this.terms.findBySlug(siteId, dto.kind, parsed.term.slug)) throw taken(dto.kind, parsed.term.name);
    try {
      return { ...(await this.terms.create(siteId, dto.kind, parsed.term)), entryCount: 0 };
    } catch (error) {
      // Two people adding the same name at once: both checks pass, the unique index stops the second.
      throw isUniqueViolation(error) ? taken(dto.kind, parsed.term.name) : error;
    }
  }

  /** A rename changes the name and, with it, the slug. 409 when another term already has that slug. */
  async rename(userId: string, id: string, dto: RenameTermDto) {
    const { siteId, subdomain } = await this.resolveSite(userId);
    const term = await this.terms.findById(siteId, id);
    if (!term) throw new NotFoundException('Term not found');
    const parsed = parseTermName(dto.name, term.kind);
    if (!parsed.ok) throw new BadRequestException(parsed.problem);
    const clash = await this.terms.findBySlug(siteId, term.kind, parsed.term.slug);
    if (clash && clash.id !== id) throw taken(term.kind, parsed.term.name);
    try {
      const changed = await this.terms.update(siteId, id, parsed.term);
      if (changed.count === 0) throw new NotFoundException('Term not found');
    } catch (error) {
      throw isUniqueViolation(error) ? taken(term.kind, parsed.term.name) : error;
    }
    // The new name shows on the archive's heading and on every entry's chips, and the old address is gone (TAX-02).
    await this.revalidation.site(subdomain);
    return { ...term, ...parsed.term };
  }

  async remove(userId: string, id: string): Promise<void> {
    const { siteId, subdomain } = await this.resolveSite(userId);
    const removed = await this.terms.delete(siteId, id);
    if (removed.count === 0) throw new NotFoundException('Term not found');
    // Its archive is gone and entries lose a chip and perhaps their related list (TAX-02).
    await this.revalidation.site(subdomain);
  }

  /**
   * Checks what an entry's save asks for and returns the links to write, or null when it asks for
   * nothing to change. Refuses with a 400 before anything is written when the type hasn't opted in (a
   * page has no type), or a category isn't this site's. New tags are created here; if the save then
   * fails, an unused tag is left on the list, which is harmless and removable.
   *
   * A kind the type has opted out of is left alone when the request for it is empty: its stored links
   * are kept (D-060), and an editor that doesn't show the kind sends nothing for it.
   */
  async resolveAssignment(siteId: string, type: TypeOptIn | null, input: TermAssignment): Promise<TermLinks | null> {
    return this.materialise(siteId, await this.checkAssignment(siteId, type, input));
  }

  /**
   * The checking half of `resolveAssignment`: refuses what can't be saved and writes nothing, so a save
   * that fails a later check (a taken slug, a failed publish check) leaves no new tag behind.
   */
  async checkAssignment(siteId: string, type: TypeOptIn | null, input: TermAssignment): Promise<CheckedAssignment | null> {
    const asks = { category: (input.categoryIds?.length ?? 0) > 0, tag: (input.tags?.length ?? 0) > 0 };
    const problem = optInProblem(type, asks);
    if (problem) throw new BadRequestException(problem);
    if (!type) return null;

    const links: CheckedAssignment = [];
    if (input.categoryIds !== undefined && type.hasCategories) {
      const found = input.categoryIds.length > 0 ? await this.terms.findByIds(siteId, input.categoryIds) : [];
      const checked = checkCategoryIds(input.categoryIds, found);
      if (!checked.ok) throw new BadRequestException(checked.problem);
      links.push({ kind: 'category', termIds: checked.ids });
    }
    if (input.tags !== undefined && type.hasTags) {
      const parsed = parseTagNames(input.tags);
      if (!parsed.ok) throw new BadRequestException(parsed.problems);
      links.push({ kind: 'tag', names: parsed.tags });
    }
    return links.length > 0 ? links : null;
  }

  /** The writing half: creates the new tags, as late as possible, and returns the links to write. */
  async materialise(siteId: string, checked: CheckedAssignment | null): Promise<TermLinks | null> {
    if (!checked) return null;
    const links: TermLinks = [];
    for (const item of checked) {
      if ('names' in item) {
        const tags = await this.terms.findOrCreateTags(siteId, item.names);
        links.push({ kind: 'tag', termIds: tags.map((tag) => tag.id) });
      } else {
        links.push(item);
      }
    }
    return links;
  }

  /** An entry's categories and tags, only of the kinds its type still has on. */
  async forEntry(siteId: string, contentId: string, type: TypeOptIn | null): Promise<{ categories: Omit<TermRow, 'kind'>[]; tags: Omit<TermRow, 'kind'>[] }> {
    if (!type || (!type.hasCategories && !type.hasTags)) return { categories: [], tags: [] };
    const rows = await this.terms.findForContent(siteId, contentId);
    const pick = (kind: TermKind, on: boolean) =>
      on ? rows.filter((row) => row.kind === kind).map(({ id, name, slug }) => ({ id, name, slug })) : [];
    return { categories: pick('category', type.hasCategories), tags: pick('tag', type.hasTags) };
  }

  // Same "caller's first membership" convention as the other services.
  private async resolveSite(userId: string): Promise<{ siteId: string; subdomain: string }> {
    const membership = (await this.users.findByIdWithMemberships(userId))?.memberships[0];
    if (!membership) throw new ForbiddenException('No site membership');
    return { siteId: membership.siteId, subdomain: membership.site.subdomain };
  }

  private async resolveSiteId(userId: string): Promise<string> {
    return (await this.resolveSite(userId)).siteId;
  }
}

function taken(kind: TermKind, name: string): ConflictException {
  return new ConflictException(`There is already a ${KIND_LABEL[kind].one} called “${name}”.`);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
