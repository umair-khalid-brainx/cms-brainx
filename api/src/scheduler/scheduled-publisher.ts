import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkflowService } from '../content/workflow.service.js';
import { SiteRepository } from '../sites/site.repository.js';

/** How often the scheduler looks for pages whose time has come: a scheduled page is at most this late. */
export const SCHEDULER_INTERVAL_MS = 60_000;

/**
 * Publishes scheduled pages when their time comes (GOV-07, D-065). A timer in this process, once a minute:
 * no queue, no cron, nothing else to run on the box. Each page is claimed with a conditional write, so two
 * `api` processes can't publish one twice, and a run still going when the next is due is skipped rather than
 * overlapped. Goes through the sites one at a time, each with its own site-scoped reads (invariant 1); one
 * site's failure is logged and doesn't stop the others. `SCHEDULER_DISABLED=true` turns it off (specs, a
 * second process that shouldn't).
 */
@Injectable()
export class ScheduledPublisher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledPublisher.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    private readonly sites: SiteRepository,
    private readonly workflow: WorkflowService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('SCHEDULER_DISABLED') === 'true') return;
    this.timer = setInterval(() => void this.tick(), SCHEDULER_INTERVAL_MS);
    // Never what keeps the process alive.
    this.timer.unref();
    // A page that came due while the API was down goes live at start, not a minute later.
    void this.tick();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** One pass over every site. Returns how many pages went live, or null when a pass was already running. */
  async tick(now: Date = new Date()): Promise<number | null> {
    if (this.running) return null;
    this.running = true;
    let published = 0;
    try {
      for (const site of await this.sites.findAllForScheduler()) {
        try {
          published += await this.workflow.publishDue(site, now);
        } catch (error) {
          this.logger.error(`Scheduled publishing failed for ${site.subdomain}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (published > 0) this.logger.log(`Published ${published} scheduled page(s)`);
    } catch (error) {
      this.logger.error(`Scheduled publishing couldn't list sites: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
    return published;
  }
}
