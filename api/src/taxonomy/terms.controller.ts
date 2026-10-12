import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { createTermSchema, renameTermSchema, type CreateTermDto, type RenameTermDto } from './dto/term.dto.js';
import { TermsService } from './terms.service.js';

// The Categories & Tags screen (TAX-01). Anyone who can read content sees the lists. Changing them
// is at the publishing tier; a new tag typed while tagging an entry only needs content:write and goes
// through the entry's own save instead (ContentService).
@Controller('terms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TermsController {
  constructor(private readonly terms: TermsService) {}

  @Get()
  @RequirePermission('content:read')
  list(@Req() request: AuthenticatedRequest) {
    return this.terms.list(request.user.sub);
  }

  @Post()
  @RequirePermission('content:publish')
  create(@Req() request: AuthenticatedRequest, @Body(new ZodValidationPipe(createTermSchema)) body: CreateTermDto) {
    return this.terms.create(request.user.sub, body);
  }

  @Patch(':id')
  @RequirePermission('content:publish')
  rename(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body(new ZodValidationPipe(renameTermSchema)) body: RenameTermDto) {
    return this.terms.rename(request.user.sub, id, body);
  }

  @Delete(':id')
  @RequirePermission('content:publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.terms.remove(request.user.sub, id);
  }
}
