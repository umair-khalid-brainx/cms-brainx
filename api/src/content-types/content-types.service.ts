import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { UserRepository } from '../users/user.repository.js';
import { ContentTypeRepository } from './content-type.repository.js';
import type { CreateContentTypeDto, UpdateContentTypeDto } from './dto/content-type.dto.js';
import {
  normaliseFields,
  parseStoredFields,
  visibleFields,
  type FieldDefinition,
  type FieldInput,
} from './field-definitions.js';
import { prefixProblem } from './prefix.js';

@Injectable()
export class ContentTypesService {
  constructor(
    private readonly types: ContentTypeRepository,
    private readonly users: UserRepository,
  ) {}

  /** Each type with its entry count, and whether its address is locked (it has entries, or is built in). */
  async list(userId: string) {
    const siteId = await this.resolveSiteId(userId);
    const [types, counts] = await Promise.all([this.types.findMany(siteId), this.types.countEntries(siteId)]);
    return types.map((type) => {
      const count = counts.get(type.id) ?? { active: 0, total: 0 };
      return { ...type, fields: visibleFields(parseStoredFields(type.fields)), entryCount: count.active, locked: type.isBuiltIn || count.total > 0 };
    });
  }

  async create(userId: string, dto: CreateContentTypeDto) {
    const siteId = await this.resolveSiteId(userId);
    await this.assertPrefixFree(siteId, dto.prefix);
    await this.assertNameFree(siteId, dto.name);
    try {
      const { stored: fields } = this.checkedFields(dto.fields ?? [], []);
      const { fields: _ignored, ...rest } = dto;
      return await this.types.create(siteId, { ...rest, fields });
    } catch (error) {
      // Two people claiming the same address at once: both checks pass, the unique index stops the second.
      throw this.asConflict(error, `Another content type already uses /${dto.prefix}.`);
    }
  }

  async update(userId: string, id: string, dto: UpdateContentTypeDto) {
    const siteId = await this.resolveSiteId(userId);
    const type = await this.types.findById(siteId, id);
    if (!type) throw new NotFoundException('Content type not found');

    if (dto.prefix !== undefined && dto.prefix !== type.prefix) {
      if (type.isBuiltIn) throw new ConflictException(`The address of ${type.name} can't be changed.`);
      if (await this.types.hasEntries(siteId, id)) {
        throw new ConflictException(
          `${type.name} already has entries, and changing the address would break their links. Delete them first.`,
        );
      }
      await this.assertPrefixFree(siteId, dto.prefix);
    }
    if (dto.name !== undefined && dto.name !== type.name) await this.assertNameFree(siteId, dto.name, id);

    const { prefix, fields: incoming, ...others } = dto;
    const rest: { name?: string; singularName?: string; fields?: FieldDefinition[]; hasCategories?: boolean; hasTags?: boolean } = { ...others };
    if (incoming) rest.fields = this.checkedFields(incoming, parseStoredFields(type.fields)).stored;
    try {
      // The address first: it is the step that can be refused, so nothing else is saved when it is.
      if (prefix !== undefined && prefix !== type.prefix) {
        // Checked above, and again here atomically: an entry created in between would
        // otherwise stay under the old address.
        const moved = await this.types.updatePrefixIfEmpty(siteId, id, prefix);
        if (moved.count === 0) {
          throw new ConflictException(`${type.name} just got an entry, so its address can't change now.`);
        }
      }
      if (Object.keys(rest).length > 0) await this.types.update(siteId, id, rest);
    } catch (error) {
      throw this.asConflict(error, `Another content type already uses /${prefix}.`);
    }
    return this.types.findById(siteId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const siteId = await this.resolveSiteId(userId);
    const type = await this.types.findById(siteId, id);
    if (!type) throw new NotFoundException('Content type not found');
    if (type.isBuiltIn) throw new ConflictException(`${type.name} is built in and can't be deleted.`);
    if (await this.types.hasEntries(siteId, id)) {
      throw new ConflictException(
        `${type.name} still has entries (archived ones count). Delete them permanently first.`,
      );
    }
    try {
      await this.types.delete(siteId, id);
    } catch (error) {
      // An entry added after the check above: the database refuses to orphan it.
      throw this.asConflict(error, `${type.name} just got an entry, so it can't be deleted now.`, 'P2003');
    }
  }

  /** The stored field list for what the admin sent, or a 400 saying what to fix. */
  private checkedFields(incoming: FieldInput[], existing: readonly FieldDefinition[]) {
    const result = normaliseFields(incoming, existing);
    if (result.problems.length > 0) throw new BadRequestException(result.problems);
    return result;
  }

  /** A unique or foreign-key violation from a race becomes the 409 it should have been, not a 500. */
  private asConflict(error: unknown, message: string, code: 'P2002' | 'P2003' = 'P2002'): unknown {
    if (error instanceof ConflictException) return error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === code) return new ConflictException(message);
    return error;
  }

  private async assertPrefixFree(siteId: string, prefix: string): Promise<void> {
    const problem = prefixProblem(prefix);
    if (problem) throw new BadRequestException(problem);
    if (await this.types.findByPrefix(siteId, prefix)) {
      throw new ConflictException(`Another content type already uses /${prefix}.`);
    }
    if (await this.types.pageUses(siteId, prefix)) {
      throw new ConflictException(
        `A page already uses /${prefix} (archived pages count). Choose a different address, or rename or delete that page.`,
      );
    }
  }

  private async assertNameFree(siteId: string, name: string, exceptId?: string): Promise<void> {
    const clash = (await this.types.findMany(siteId)).find(
      (type) => type.id !== exceptId && type.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) throw new ConflictException(`There is already a content type called "${clash.name}".`);
  }

  // Same "caller's first membership" convention as ContentService.
  private async resolveSiteId(userId: string): Promise<string> {
    const membership = await this.users.findActiveMembership(userId);
    if (!membership) throw new ForbiddenException('No site membership');
    return membership.siteId;
  }
}
