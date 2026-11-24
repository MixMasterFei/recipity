/**
 * A small in-memory rate limiter.
 *
 * Counts events per key inside a sliding window. Pure apart from the clock,
 * which is injectable, so it is testable without waiting.
 *
 * What it is and isn't: the counters live in this process. On a serverless
 * host each warm instance keeps its own, and a cold start resets them, so this
 * caps what one instance will spend rather than what the whole deployment
 * will. That is a real brake on casual abuse and a poor one against a
 * determined caller — for a hard guarantee, put the platform's own rate-limit
 * rule in front of the route as well.
 */

export interface RateLimitOptions {
  /** Events allowed per key inside the window. */
  limit: number;
  windowMs: number;
  /** Distinct keys remembered at once; the least recent are forgotten first. */
  maxKeys?: number;
}

export type RateDecision =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export interface RateLimiter {
  /** Record one event for `key` if it is within the limit. */
  take(key: string, now?: number): RateDecision;
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs } = options;
  const maxKeys = options.maxKeys ?? 5000;
  /** Event times per key, oldest first. Map order doubles as recency. */
  const hits = new Map<string, number[]>();

  return {
    take(key, now = Date.now()) {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

      if (recent.length >= limit) {
        // Refused events are not recorded: hammering a closed door must not
        // keep it closed for longer.
        hits.delete(key);
        hits.set(key, recent);
        const oldest = recent[0] ?? now;
        return {
          ok: false,
          retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
        };
      }

      recent.push(now);
      // Re-insert so this key becomes the most recent one.
      hits.delete(key);
      hits.set(key, recent);

      // Bound memory: a caller rotating keys can't grow this without limit.
      while (hits.size > maxKeys) {
        const stalest = hits.keys().next().value;
        if (stalest === undefined) break;
        hits.delete(stalest);
      }

      return { ok: true };
    },
  };
}
