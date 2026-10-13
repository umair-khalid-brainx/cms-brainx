import type { ConfigService } from '@nestjs/config';
import type { WorkflowService } from '../content/workflow.service.js';
import type { SiteRepository } from '../sites/site.repository.js';
import { SCHEDULER_INTERVAL_MS, ScheduledPublisher } from './scheduled-publisher.js';

const NOW = new Date('2026-10-12T12:00:00.000Z');

function setup(env: Record<string, string> = {}) {
  const sites = {
    findAllForScheduler: vi.fn(async () => [
      { id: 'site-a', subdomain: 'a' },
      { id: 'site-b', subdomain: 'b' },
      { id: 'site-c', subdomain: 'c' },
    ]),
  };
  const workflow = { publishDue: vi.fn(async (site: { id: string }) => (site.id === 'site-a' ? 2 : 1)) };
  const config = { get: vi.fn((key: string) => env[key]) };
  const publisher = new ScheduledPublisher(
    sites as unknown as SiteRepository,
    workflow as unknown as WorkflowService,
    config as unknown as ConfigService,
  );
  return { publisher, sites, workflow };
}

describe('ScheduledPublisher.tick', () => {
  it('goes over every site with the tick’s time and adds up what went live', async () => {
    const { publisher, workflow } = setup();

    expect(await publisher.tick(NOW)).toBe(4);
    expect(workflow.publishDue.mock.calls).toEqual([
      [{ id: 'site-a', subdomain: 'a' }, NOW],
      [{ id: 'site-b', subdomain: 'b' }, NOW],
      [{ id: 'site-c', subdomain: 'c' }, NOW],
    ]);
  });

  it('carries on past a site that fails', async () => {
    const { publisher, workflow } = setup();
    workflow.publishDue.mockRejectedValueOnce(new Error('site-a broke'));

    expect(await publisher.tick(NOW)).toBe(2);
    expect(workflow.publishDue).toHaveBeenCalledTimes(3);
  });

  it('answers 0 when the sites can’t be listed, and runs again next time', async () => {
    const { publisher, sites } = setup();
    sites.findAllForScheduler.mockRejectedValueOnce(new Error('database down'));

    expect(await publisher.tick(NOW)).toBe(0);
    expect(await publisher.tick(NOW)).toBe(4);
  });

  it('skips a tick while one is still running, then runs the next', async () => {
    const { publisher, sites } = setup();
    let release!: (value: { id: string; subdomain: string }[]) => void;
    sites.findAllForScheduler.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

    const first = publisher.tick(NOW);
    expect(await publisher.tick(NOW)).toBeNull();
    release([{ id: 'site-b', subdomain: 'b' }]);

    expect(await first).toBe(1);
    expect(await publisher.tick(NOW)).toBe(4);
  });
});

describe('ScheduledPublisher timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ticks at start and once a minute after, until the module is destroyed', async () => {
    const { publisher, sites } = setup();

    publisher.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(sites.findAllForScheduler).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SCHEDULER_INTERVAL_MS);
    expect(sites.findAllForScheduler).toHaveBeenCalledTimes(2);

    publisher.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(SCHEDULER_INTERVAL_MS * 3);
    expect(sites.findAllForScheduler).toHaveBeenCalledTimes(2);
  });

  it('starts no timer and runs nothing with SCHEDULER_DISABLED=true', async () => {
    const { publisher, sites } = setup({ SCHEDULER_DISABLED: 'true' });
    const setInterval = vi.spyOn(globalThis, 'setInterval');

    publisher.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(SCHEDULER_INTERVAL_MS * 3);

    expect(setInterval).not.toHaveBeenCalled();
    expect(sites.findAllForScheduler).not.toHaveBeenCalled();
    // Destroying a publisher that never started is harmless.
    expect(() => publisher.onModuleDestroy()).not.toThrow();
  });
});
