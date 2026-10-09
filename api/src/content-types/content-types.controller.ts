import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ContentTypesService } from './content-types.service.js';
import {
  createContentTypeSchema,
  updateContentTypeSchema,
  type CreateContentTypeDto,
  type UpdateContentTypeDto,
} from './dto/content-type.dto.js';

// Anyone who can read content sees the types (they feed the sidebar); only the
// people who manage the site create, rename or delete them (`site:manage`).
@Controller('content-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContentTypesController {
  constructor(private readonly types: ContentTypesService) {}

  @Get()
  @RequirePermission('content:read')
  list(@Req() request: AuthenticatedRequest) {
    return this.types.list(request.user.sub);
  }

  @Post()
  @RequirePermission('site:manage')
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createContentTypeSchema)) body: CreateContentTypeDto,
  ) {
    return this.types.create(request.user.sub, body);
  }

  @Patch(':id')
  @RequirePermission('site:manage')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateContentTypeSchema)) body: UpdateContentTypeDto,
  ) {
    return this.types.update(request.user.sub, id, body);
  }

  @Delete(':id')
  @RequirePermission('site:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.types.remove(request.user.sub, id);
  }
}
