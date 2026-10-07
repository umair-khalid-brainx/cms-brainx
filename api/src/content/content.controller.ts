import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { ContentService } from './content.service.js';
import {
  createContentSchema,
  updateContentSchema,
  type CreateContentDto,
  type UpdateContentDto,
} from './dto/content.dto.js';

// content:publish and content:delete aren't checked on PATCH here — it
// handles draft-saves and every status transition (publish, archive, restore)
// through one route (dto.status), so those checks live in
// ContentService.update instead, where the body is already parsed.
@Controller('content')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @RequirePermission('content:read')
  list(@Req() request: AuthenticatedRequest) {
    return this.content.list(request.user.sub);
  }

  // Must be registered before ':slug' — otherwise that param route would
  // match the literal path '/content/archived' first.
  @Get('archived')
  @RequirePermission('content:read')
  listArchived(@Req() request: AuthenticatedRequest) {
    return this.content.listArchived(request.user.sub);
  }

  @Get(':slug')
  @RequirePermission('content:read')
  get(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.content.get(request.user.sub, slug);
  }

  @Get(':slug/checks')
  @RequirePermission('content:read')
  checks(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.content.checks(request.user.sub, slug);
  }

  @Post()
  @RequirePermission('content:write')
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createContentSchema)) body: CreateContentDto,
  ) {
    return this.content.create(request.user.sub, body);
  }

  @Post(':slug/duplicate')
  @RequirePermission('content:write')
  duplicate(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.content.duplicate(request.user.sub, slug);
  }

  @Patch(':slug')
  @RequirePermission('content:write')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(updateContentSchema)) body: UpdateContentDto,
  ) {
    return this.content.update(request.user.sub, slug, body);
  }

  @Delete(':slug')
  @RequirePermission('content:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: AuthenticatedRequest, @Param('slug') slug: string): Promise<void> {
    await this.content.remove(request.user.sub, slug);
  }
}
