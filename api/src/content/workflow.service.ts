import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { hasPermission } from '../auth/permission.js';
import type { ContentStatus, Prisma } from '../generated/prisma/client.js';
import { RevisionsService } from '../revisions/revisions.service.js';
import type { RevisionReason } from '../revisions/revision-rules.js';
import { UserRepository } from '../users/user.repository.js';
import { ContentRepository, PAGE_CHANGED } from './content.repository.js';
import { ContentService } from './content.service.js';
import type { ApproveDto, RejectDto, ScheduleDto } from './dto/workflow.dto.js';
import { mayWithdraw, missedScheduleNote, publishAtProblem, scheduleProblem, submitProblem } from './workflow-rules.js';

type Membership = { siteId: string; role: Parameters<typeof hasPermission>[0]; site: { id: string; subdomain: string } };
type PageRow = NonNullable<Awaited<ReturnType<ContentRepository['findBySlug']>>>;

/**
 * Review and scheduling (GOV-07, D-065): submit, withdraw, approve, reject, schedule, unschedule, and the
 * scheduler's publish. Each step is one conditional write (ContentRepository.transition), so two people acting
 * on the same page at once can't both win. The rules of what is allowed from where live in workflow-rules.ts.
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  /** The time of a step; a spec replaces it to move the clock. */
  now: () => Date = () => new Date();

  constructor(
    private readonly content: ContentRepository,
    private readonly users: UserRepository,
    private readonly pages: ContentService,
    private readonly revisions: RevisionsService,
  ) {}

  /** The site's pages and entries waiting for review, oldest first. */
  async queue(userId: string) {
    const { siteId } = await this.membershipOf(userId);
    return this.content.findInReview(siteId);
  }

  /** A draft goes to review. Anyone who can edit may submit; the page is locked until it is reviewed or withdrawn. */
  async submit(userId: string, slug: string) {
    const { membership, page } = await this.pageOf(userId, slug);
    const problem = submitProblem(page.status);
    if (problem) throw new ConflictException(problem);
    await this.move(membership, page, ['draft'], {
      status: 'in_review',
      submittedById: userId,
      submittedAt: this.now(),
      reviewNote: null,
      reviewedById: null,
      reviewedAt: null,
    });
    return this.done(userId, membership, page, 'status');
  }

  /** Takes a page out of review, back to draft, to change it. Its submitter or a reviewer may. */
  async withdraw(userId: string, slug: string) {
    const { membership, page } = await this.pageOf(userId, slug);
    if (page.status !== 'in_review') throw new ConflictException('This page isn’t waiting for review.');
    if (!mayWithdraw({ userId, submittedById: page.submittedById, canReview: hasPermission(membership.role, 'content:review') })) {
      throw new ForbiddenException('Only the person who submitted this page, or a reviewer, can withdraw it.');
    }
    await this.move(membership, page, ['in_review'], { status: 'draft', submittedById: null, submittedAt: null });
    return this.done(userId, membership, page, 'status');
  }

  /**
   * A reviewer approves: the page goes live now, or is scheduled for `publishAt`. Either way it must pass the
   * publish checks first (CNT-12), exactly as a Publish would; warnings were the reviewer's to read in the editor.
   */
  async approve(userId: string, slug: string, dto: ApproveDto) {
    const { membership, page } = await this.pageOf(userId, slug);
    if (page.status !== 'in_review') throw new ConflictException('This page isn’t waiting for review.');
    // The reviewer approves the version they read, not whatever is there now.
    if (dto.version && dto.version.getTime() !== page.updatedAt.getTime()) {
      throw new ConflictException('This page changed since you opened it. Reload it to read the latest version.');
    }
    const now = this.now();
    if (dto.publishAt) this.checkPublishAt(dto.publishAt, now);
    await this.checkPublishable(membership.siteId, page);
    const reviewed = { reviewedById: userId, reviewedAt: now, reviewNote: null };
    // Exactly the version the checks read (`unchanged`): not one withdrawn, edited and resubmitted meanwhile.
    if (dto.publishAt) {
      await this.move(membership, page, ['in_review'], { status: 'scheduled', publishAt: dto.publishAt, scheduledById: userId, ...reviewed }, true);
      return this.done(userId, membership, page, 'status');
    }
    await this.move(
      membership,
      page,
      ['in_review'],
      { status: 'published', publishedAt: page.publishedAt ?? now, submittedById: null, submittedAt: null, ...reviewed },
      true,
    );
    await this.pages.refreshPublic({ id: membership.siteId, subdomain: membership.site.subdomain }, page, 'published');
    return this.done(userId, membership, page, 'publish');
  }

  /** A reviewer sends the page back to draft, saying what to change. The note shows in the editor until it is resubmitted. */
  async reject(userId: string, slug: string, dto: RejectDto) {
    const { membership, page } = await this.pageOf(userId, slug);
    if (page.status !== 'in_review') throw new ConflictException('This page isn’t waiting for review.');
    await this.move(membership, page, ['in_review'], { status: 'draft', reviewNote: dto.note, reviewedById: userId, reviewedAt: this.now() });
    return this.done(userId, membership, page, 'status');
  }

  /** A publisher schedules a draft directly. Checked like a publish, now; checked again when its time comes. */
  async schedule(userId: string, slug: string, dto: ScheduleDto) {
    const { membership, page } = await this.pageOf(userId, slug);
    const problem = scheduleProblem(page.status);
    if (problem) throw new ConflictException(problem);
    this.checkPublishAt(dto.publishAt, this.now());
    await this.checkPublishable(membership.siteId, page);
    await this.move(membership, page, ['draft'], { status: 'scheduled', publishAt: dto.publishAt, scheduledById: userId, reviewNote: null }, true);
    return this.done(userId, membership, page, 'status');
  }

  /**
   * "Publish now" on a scheduled page: one step, so a failure leaves it scheduled rather than half undone. Checked
   * again first, like the scheduler does when its time comes.
   */
  async publishNow(userId: string, slug: string) {
    const { membership, page } = await this.pageOf(userId, slug);
    if (page.status !== 'scheduled') throw new ConflictException('This page isn’t scheduled.');
    await this.checkPublishable(membership.siteId, page);
    await this.move(membership, page, ['scheduled'], {
      status: 'published',
      publishAt: null,
      scheduledById: null,
      submittedById: null,
      submittedAt: null,
      publishedAt: page.publishedAt ?? this.now(),
    }, true);
    await this.pages.refreshPublic({ id: membership.siteId, subdomain: membership.site.subdomain }, page, 'published');
    return this.done(userId, membership, page, 'publish');
  }

  /** Back to draft, off the schedule. */
  async unschedule(userId: string, slug: string) {
    const { membership, page } = await this.pageOf(userId, slug);
    if (page.status !== 'scheduled') throw new ConflictException('This page isn’t scheduled.');
    await this.move(membership, page, ['scheduled'], { status: 'draft', publishAt: null, scheduledById: null });
    return this.done(userId, membership, page, 'status');
  }

  /**
   * The scheduler's work for one site: every scheduled page whose time has come goes live, as a Publish would,
   * with the same refreshes. A page that no longer passes the checks (a required field added since, say) goes
   * back to draft with a note saying why, rather than going live broken or retrying every minute. Each page
   * is claimed by a conditional write, so a page unscheduled meanwhile, or published by a second `api`
   * process, is left alone. Returns how many went live.
   */
  async publishDue(site: { id: string; subdomain: string }, now: Date): Promise<number> {
    let published = 0;
    for (const page of await this.content.findDue(site.id, now)) {
      const checks = await this.pages.publishChecksFor(site.id, page.typeId, page.blocks, page.data);
      if (checks.errors.length > 0) {
        const note = missedScheduleNote(checks.errors.map((error) => error.message));
        const sent = await this.content.transition(
          site.id,
          page.id,
          ['scheduled'],
          { status: 'draft', publishAt: null, scheduledById: null, reviewNote: note, reviewedById: null, reviewedAt: now },
          now,
        );
        if (sent.count > 0) await this.recordAfter(site.id, page.scheduledById, page.slug, 'status');
        continue;
      }
      const claimed = await this.content.transition(
        site.id,
        page.id,
        ['scheduled'],
        { status: 'published', publishAt: null, scheduledById: null, submittedById: null, submittedAt: null, publishedAt: page.publishedAt ?? now },
        now,
      );
      if (claimed.count === 0) continue;
      published += 1;
      // Who scheduled it is who published it, in the page's history.
      await this.recordAfter(site.id, page.scheduledById, page.slug, 'publish');
      await this.pages.refreshPublic(site, page, 'published');
    }
    return published;
  }

  private checkPublishAt(publishAt: Date, now: Date): void {
    const problem = publishAtProblem(publishAt, now);
    if (problem) throw new UnprocessableEntityException({ statusCode: 422, message: problem });
  }

  /** The publish checks' errors refuse with the same 422 a Publish gives, so the editor shows them the same way. */
  private async checkPublishable(siteId: string, page: PageRow): Promise<void> {
    const checks = await this.pages.publishChecksFor(siteId, page.typeId, page.blocks, page.data);
    if (checks.errors.length > 0) {
      throw new UnprocessableEntityException({ statusCode: 422, message: 'Fix these before publishing', ...checks });
    }
  }

  /**
   * One workflow step, as a conditional write: refused when someone else moved the page first. With `unchanged`,
   * also when the page was saved since it was read: approve and schedule publish only what the checks saw.
   */
  private async move(
    membership: Membership,
    page: PageRow,
    from: ContentStatus[],
    data: Prisma.ContentUncheckedUpdateManyInput,
    unchanged = false,
  ): Promise<void> {
    const written = await this.content.transition(membership.siteId, page.id, from, data, undefined, unchanged ? page.updatedAt : undefined);
    if (written.count === 0) throw new ConflictException(PAGE_CHANGED);
  }

  /** After a step has committed: its revision (a failure is logged, the step stands), then the page as the editor reads it. */
  private async done(userId: string, membership: Membership, page: PageRow, reason: RevisionReason) {
    await this.recordAfter(membership.siteId, userId, page.slug, reason);
    return this.pages.getForEdit(userId, page.slug);
  }

  private async recordAfter(siteId: string, authorId: string | null, slug: string, reason: RevisionReason): Promise<void> {
    try {
      const after = await this.content.findBySlug(siteId, slug);
      if (after) await this.revisions.record(siteId, authorId, reason, after);
    } catch (error) {
      this.logger.error(`A workflow step stands, but its revision was not recorded: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async pageOf(userId: string, slug: string) {
    const membership = await this.membershipOf(userId);
    const page = await this.content.findBySlug(membership.siteId, slug);
    if (!page) throw new NotFoundException('Page not found');
    return { membership, page };
  }

  // The caller's first site membership, like every content route (D-023).
  private async membershipOf(userId: string): Promise<Membership> {
    const membership = await this.users.findActiveMembership(userId);
    if (!membership) throw new ForbiddenException('No site membership');
    return membership;
  }
}
