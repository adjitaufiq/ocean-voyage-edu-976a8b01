/**
 * Server-only sliding-window rate limiter shared by public endpoints.
 *
 * Best-effort, per server instance (the runtime has no shared store). It is
 * deliberately generous: it stops scripted floods without getting in the way of
 * a real buyer having a long consultation.
 */

type Bucket = { stamps: number[] };

const buckets = new Map<string, Bucket>();

function prune(now: number, windowMs: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    const fresh = bucket.stamps.filter((t) => now - t < windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else bucket.stamps = fresh;
  }
}

export type RateVerdict = { ok: true } | { ok: false; retryAfterSeconds: number };

export function rateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): RateVerdict {
  const now = Date.now();
  prune(now, options.windowMs);
  const bucket = buckets.get(options.key) ?? { stamps: [] };
  bucket.stamps = bucket.stamps.filter((t) => now - t < options.windowMs);
  if (bucket.stamps.length >= options.limit) {
    buckets.set(options.key, bucket);
    const oldest = bucket.stamps[0] ?? now;
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((options.windowMs - (now - oldest)) / 1000)),
    };
  }
  bucket.stamps.push(now);
  buckets.set(options.key, bucket);
  return { ok: true };
}

/** Best-effort client IP from proxy headers. Used only for rate limiting; never stored or exposed. */
export function clientIp(request: Request): string {
  const header =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "";
  return header.split(",")[0]?.trim() || "unknown";
}
