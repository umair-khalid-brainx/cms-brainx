import {
  BadRequestException,  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { RequirePermission } from '../auth/permission.decorator.js';
import { ContentService } from './content.service.js';
import { WorkflowService } from './workflow.service.js';
import {
  createContentSchema,
  updateContentSchema,
  type CreateContentDto,
  type UpdateContentDto,
} from './dto/content.dto.js';
import { approveSchema, rejectSchema, scheduleSchema, type ApproveDto, type RejectDto, type ScheduleDto } from './dto/workflow.dto.js';

// content:publish and content:delete aren't checked on PATCH here — it
// handles draft-saves and every status transition (publish, archive, restore)
// through one route (dto.status), so those checks live in
// ContentService.update instead, where the body is already parsed.
// `?type=a&type=b` arrives as an array; refuse it rather than let it reach the database.
function singleType(type: string | string[] | undefined): string | undefined {
  if (Array.isArray(type)) throw new BadRequestException('Give one content type');
  return type;
}

@Controller('content')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly workflow: WorkflowService,
  ) {}

  @Get()
  @RequirePermission('content:read')
  list(@Req() request: AuthenticatedRequest, @Query('type') type?: string | string[]) {
    return this.content.list(request.user.sub, singleType(type));
  }

  // Must be registered before ':slug' — otherwise that param route would
  // match the literal path '/content/archived' first.
  @Get('archived')
  @RequirePermission('content:read')
  listArchived(@Req() request: AuthenticatedRequest, @Query('type') type?: string | string[]) {
    return this.content.listArchived(request.user.sub, singleType(type));
  }

  // The review queue (GOV-07). Before ':slug' for the same reason as 'archived'.
  @Get('review-queue')
  @RequirePermission('content:review')
  reviewQueue(@Req() request: AuthenticatedRequest) {
    return this.workflow.queue(request.user.sub);
  }

  @Get(':slug')
  @RequirePermission('content:read')
  get(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.content.getForEdit(request.user.sub, slug);
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

  // Preview links (CNT-09): sharing a draft is an editing act, so all three
  // need content:write — reading the link included, since it is the share.
  @Get(':slug/preview-link')
  @RequirePermission('content:write')
  getPreviewLink(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.content.getPreviewLink(request.user.sub, slug);
  }

  @Post(':slug/preview-link')
  @RequirePermission('content:write')
  createPreviewLink(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.content.createPreviewLink(request.user.sub, slug);
  }

  @Delete(':slug/preview-link')
  @RequirePermission('content:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokePreviewLink(@Req() request: AuthenticatedRequest, @Param('slug') slug: string): Promise<void> {
    await this.content.revokePreviewLink(request.user.sub, slug);
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

  // The review workflow and scheduling (GOV-07, D-065). Each answers with the page as the editor reads it.
  // Withdraw needs only content:write here: the submitter may withdraw their own, which the service checks.
  @Post(':slug/submit')
  @RequirePermission('content:write')
  @HttpCode(HttpStatus.OK)
  submit(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.workflow.submit(request.user.sub, slug);
  }

  @Post(':slug/withdraw')
  @RequirePermission('content:write')
  @HttpCode(HttpStatus.OK)
  withdraw(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.workflow.withdraw(request.user.sub, slug);
  }

  @Post(':slug/approve')
  @RequirePermission('content:review')
  @HttpCode(HttpStatus.OK)
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(approveSchema)) body: ApproveDto,
  ) {
    return this.workflow.approve(request.user.sub, slug, body);
  }

  @Post(':slug/reject')
  @RequirePermission('content:review')
  @HttpCode(HttpStatus.OK)
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(rejectSchema)) body: RejectDto,
  ) {
    return this.workflow.reject(request.user.sub, slug, body);
  }

  @Post(':slug/schedule')
  @RequirePermission('content:publish')
  @HttpCode(HttpStatus.OK)
  schedule(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(scheduleSchema)) body: ScheduleDto,
  ) {
    return this.workflow.schedule(request.user.sub, slug, body);
  }

  // A scheduled page, live now: one step, so a failure leaves it scheduled.
  @Post(':slug/publish-now')
  @RequirePermission('content:publish')
  @HttpCode(HttpStatus.OK)
  publishNow(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.workflow.publishNow(request.user.sub, slug);
  }

  @Post(':slug/unschedule')
  @RequirePermission('content:publish')
  @HttpCode(HttpStatus.OK)
  unschedule(@Req() request: AuthenticatedRequest, @Param('slug') slug: string) {
    return this.workflow.unschedule(request.user.sub, slug);
  }

  @Delete(':slug')
  @RequirePermission('content:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() request: AuthenticatedRequest, @Param('slug') slug: string): Promise<void> {
    await this.content.remove(request.user.sub, slug);
  }
}
