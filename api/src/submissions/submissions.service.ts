import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../users/user.repository.js';
import type { SubmissionAnswer } from './dto/submission.dto.js';
import { SubmissionRepository } from './submission.repository.js';

export type SubmissionSummary = {
  id: string;
  createdAt: Date;
  pageTitle: string;
  pagePath: string;
  preview: string;
};

export type SubmissionPage = {
  items: SubmissionSummary[];
  /** Pass as `after` to get the next page; null on the last page. */
  nextCursor: string | null;
  total: number;
};

const PREVIEW_LENGTH = 80;
export const PAGE_SIZE = 50;

/** Admin-side reads. The public write path is PublicService.submit. */
@Injectable()
export class SubmissionsService {
  constructor(
    private readonly submissions: SubmissionRepository,
    private readonly users: UserRepository,
  ) {}

  async list(userId: string, after?: string): Promise<SubmissionPage> {
    const siteId = await this.resolveSiteId(userId);
    // One extra row tells us whether another page exists without a second query.
    const [rows, total] = await Promise.all([
      this.submissions.findPageBySite(siteId, PAGE_SIZE + 1, after),
      this.submissions.countBySite(siteId),
    ]);
    if (!rows) throw new BadRequestException('Unknown cursor');

    const items = rows.slice(0, PAGE_SIZE).map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      pageTitle: row.pageTitle,
      pagePath: row.pagePath,
      preview: preview(row.answers as SubmissionAnswer[]),
    }));
    const nextCursor = rows.length > PAGE_SIZE ? items[items.length - 1].id : null;
    return { items, nextCursor, total };
  }

  async get(userId: string, id: string) {
    const siteId = await this.resolveSiteId(userId);
    const row = await this.submissions.findById(siteId, id);
    if (!row) throw new NotFoundException('Submission not found');
    return {
      id: row.id,
      createdAt: row.createdAt,
      pageTitle: row.pageTitle,
      pagePath: row.pagePath,
      answers: row.answers as SubmissionAnswer[],
    };
  }

  // Same "caller's first membership" convention as ContentService (D-020).
  private async resolveSiteId(userId: string): Promise<string> {
    const user = await this.users.findByIdWithMemberships(userId);
    const membership = user?.memberships[0];
    if (!membership) throw new ForbiddenException('No site membership');
    return membership.siteId;
  }
}

/** The first non-empty answer, on one line, cut to a list-row length. */
function preview(answers: SubmissionAnswer[]): string {
  const first = answers.find((answer) => answer.value.trim())?.value ?? '';
  const oneLine = first.replace(/\s+/g, ' ').trim();
  return oneLine.length > PREVIEW_LENGTH ? `${oneLine.slice(0, PREVIEW_LENGTH - 1)}…` : oneLine;
}
