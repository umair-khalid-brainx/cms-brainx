/**
 * A sliding-window counter kept in this process's memory (D-034). Right for
 * one `web` process on one box; it resets on restart, and two processes would
 * each keep their own count.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(now);
    hits.set(key, recent);

    // Keep the map from growing without bound: drop keys with no recent hits.
    if (hits.size > 10_000) {
      for (const [k, times] of hits) if (times.every((at) => now - at >= windowMs)) hits.delete(k);
    }
    return allowed;
  };
}
