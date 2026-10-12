import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TIMEOUT_MS = 2000;

/**
 * Tells `web` a live page changed, so its next visit on that site renders
 * fresh instead of waiting out the ISR timer (CNT-08, D-039).
 *
 * Never throws and never blocks for long: if `web` is down or slow, the
 * change in the database still stands and the page catches up within
 * `web`'s 60 s backstop. A failure is logged, not surfaced to the editor.
 */
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly config: ConfigService) {}

  /** One page of one site. */
  page(subdomain: string, path: string): Promise<void> {
    return this.send(subdomain, { subdomain, path }, path);
  }

  /** Every page of one site: its header or footer changed (GOV-04). */
  site(subdomain: string): Promise<void> {
    return this.send(subdomain, { subdomain }, '(the whole site)');
  }

  private async send(subdomain: string, body: { subdomain: string; path?: string }, what: string): Promise<void> {
    const url = this.config.get<string>('WEB_REVALIDATE_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!url || !secret) {
      this.logger.warn(
        `Revalidation not configured; ${subdomain}${what} refreshes on the timer`,
      );
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok)
        this.logger.warn(
          `web refused to revalidate ${subdomain}${what}: ${response.status}`,
        );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Couldn't reach web to revalidate ${subdomain}${what}: ${reason}`,
      );
    }
  }
}
