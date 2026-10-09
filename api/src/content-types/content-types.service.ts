import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from '../users/user.repository.js';
import { ContentTypeRepository } from './content-type.repository.js';
import type { CreateContentTypeDto, UpdateContentTypeDto } from './dto/content-type.dto.js';
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
      return { ...type, entryCount: count.active, locked: type.isBuiltIn || count.total > 0 };
    });
  }

  async create(userId: string, dto: CreateContentTypeDto) {
    const siteId = await this.resolveSiteId(userId);
    await this.assertPrefixFree(siteId, dto.prefix);
    await this.assertNameFree(siteId, dto.name);
    return this.types.create(siteId, dto);
  }

  async update(userId: string, id: string, dto: UpdateContentTypeDto) {
    const siteId = await this.resolveSiteId(userId);
    const type = await this.types.findById(siteId, id);
    if (!type) throw new NotFoundException('Content type not found');

    if (dto.prefix !== undefined && dto.prefix !== type.prefix) {
      if (type.isBuiltIn) throw new ConflictException(`The address of ${type.name} can't be changed.`);
      if (await this.types.hasEntries(siteId, id)) {
        throw new ConflictException(
          `${type.name} already has entries, and changing the address would break their links. Delete or move them first.`,
        );
      }
      await this.assertPrefixFree(siteId, dto.prefix);
    }
    if (dto.name !== undefined && dto.name !== type.name) await this.assertNameFree(siteId, dto.name, id);

    const { count } = await this.types.update(siteId, id, dto);
    if (count === 0) throw new NotFoundException('Content type not found');
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
    await this.types.delete(siteId, id);
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
    const user = await this.users.findByIdWithMemberships(userId);
    const membership = user?.memberships[0];
    if (!membership) throw new ForbiddenException('No site membership');
    return membership.siteId;
  }
}
