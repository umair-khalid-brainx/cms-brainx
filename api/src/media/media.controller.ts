import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { MediaService } from './media.service.js';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Same permission levels as ContentController — this exists to feed
// image/video fields inside the block editor, not as a general-purpose file host.
@Controller('media')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @RequirePermission('content:read')
  list(@Req() request: AuthenticatedRequest) {
    return this.media.list(request.user.sub);
  }

  @Post()
  @RequirePermission('content:write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@Req() request: AuthenticatedRequest, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.media.store(request.user.sub, file);
  }

  @Delete(':id')
  @RequirePermission('content:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.media.remove(request.user.sub, id);
  }
}
