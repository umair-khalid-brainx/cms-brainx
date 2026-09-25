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
import { ContentService } from './content.service.js';
import {
  createContentSchema,
  updateContentSchema,
  type CreateContentDto,
  type UpdateContentDto,
} from './dto/content.dto.js';

@Controller('content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.content.list(request.user.sub);
  }

  @Get(':slug')
  get(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.content.get(request.user.sub, slug);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createContentSchema)) body: CreateContentDto,
  ) {
    return this.content.create(request.user.sub, body);
  }

  @Patch(':slug')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(updateContentSchema)) body: UpdateContentDto,
  ) {
    return this.content.update(request.user.sub, slug, body);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: AuthenticatedRequest, @Param('slug') slug: string): Promise<void> {
    await this.content.remove(request.user.sub, slug);
  }
}
