/**
 * Server-only authentication for scheduled/operational endpoints.
 *
 * Scheduled callers (pg_cron, external schedulers, manual ops triggers) must
 * present a dedicated high-entropy secret — never the Supabase publishable key,
 * which is designed to be public. The secret is read inside the handler, never
 * logged, never returned, and never exposed to client bundles.
 */

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  // Compare a fixed-length digest-ish view so length alone is not a fast exit.
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export type OpsAuthResult = { ok: true } | { ok: false; response: Response };

const UNAUTHORIZED = () =>
  Response.json({ error: "unauthorized" }, { status: 401 });

/**
 * Verifies a scheduled/operational request. Returns a ready-to-send 401 when
 * the caller is not authorized — the caller must return it without running any
 * side effect.
 */
export function verifyOpsRequest(request: Request): OpsAuthResult {
  const expected = process.env["CRON_SECRET"];
  if (!expected || expected.length < 16) {
    // Misconfiguration must fail closed, without revealing the reason.
    return { ok: false, response: UNAUTHORIZED() };
  }

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!provided || !timingSafeEqual(provided, expected)) {
    return { ok: false, response: UNAUTHORIZED() };
  }
  return { ok: true };
}
