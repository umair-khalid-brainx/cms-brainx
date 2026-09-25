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

// content:publish isn't checked here — PATCH handles both draft-saves and
// publish-transitions through one route (dto.status), so that one check
// lives in ContentService.update instead, where the body is already parsed.
@Controller('content')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @RequirePermission('content:read')
  list(@Req() request: AuthenticatedRequest) {
    return this.content.list(request.user.sub);
  }

  @Get(':slug')
  @RequirePermission('content:read')
  get(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.content.get(request.user.sub, slug);
  }

  @Post()
  @RequirePermission('content:write')
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createContentSchema)) body: CreateContentDto,
  ) {
    return this.content.create(request.user.sub, body);
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
