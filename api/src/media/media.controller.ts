import { BadRequestException, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { MediaService } from './media.service.js';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

// Same permission as a content write — this exists to feed image/video
// fields inside the block editor, not as a general-purpose file host.
@Controller('media')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('content:write')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async upload(@Req() request: AuthenticatedRequest, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.media.store(request.user.sub, file);
  }
}
