import { beforeEach, describe, expect, it } from "vitest";

import { hashPayload } from "@/lib/assistant-actions.server";
import { clampAiProvenance, isTrustedFact } from "@/lib/assistant/memory";
import { clientIp, rateLimit } from "@/lib/rate-limit.server";
import { verifyOpsRequest } from "@/lib/security/ops-auth.server";

const SECRET = "a".repeat(48);

function opsRequest(headers: Record<string, string>) {
  return new Request("https://example.test/api/public/hooks/x", { method: "POST", headers });
}

describe("scheduled endpoint authentication", () => {
  beforeEach(() => {
    process.env["CRON_SECRET"] = SECRET;
  });

  it("accepts the shared secret header", () => {
    expect(verifyOpsRequest(opsRequest({ "x-cron-secret": SECRET })).ok).toBe(true);
  });

  it("accepts a bearer form of the same secret", () => {
    expect(verifyOpsRequest(opsRequest({ authorization: `Bearer ${SECRET}` })).ok).toBe(true);
  });

  it("rejects a missing or wrong secret", async () => {
    expect(verifyOpsRequest(opsRequest({})).ok).toBe(false);
    const bad = verifyOpsRequest(opsRequest({ "x-cron-secret": "b".repeat(48) }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.response.status).toBe(401);
  });

  it("fails closed when the secret is not configured", () => {
    delete process.env["CRON_SECRET"];
    expect(verifyOpsRequest(opsRequest({ "x-cron-secret": SECRET })).ok).toBe(false);
  });
});

describe("public rate limiting", () => {
  it("allows up to the limit then throttles with a retry hint", () => {
    const key = `test:${Math.random()}`;
    expect(rateLimit({ key, limit: 2, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit({ key, limit: 2, windowMs: 60_000 }).ok).toBe(true);
    const blocked = rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys buckets independently", () => {
    const a = `test:${Math.random()}`;
    const b = `test:${Math.random()}`;
    expect(rateLimit({ key: a, limit: 1, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit({ key: a, limit: 1, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit({ key: b, limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });

  it("derives an ip only from proxy headers", () => {
    expect(clientIp(opsRequest({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientIp(opsRequest({}))).toBe("unknown");
  });
});

describe("pending action payload hashing", () => {
  it("is stable regardless of key order", async () => {
    expect(await hashPayload({ a: 1, b: "x" })).toBe(await hashPayload({ b: "x", a: 1 }));
  });

  it("changes when the payload changes (replay/tamper guard)", async () => {
    expect(await hashPayload({ leadId: "1", status: "won" })).not.toBe(
      await hashPayload({ leadId: "1", status: "lost" }),
    );
  });
});

describe("memory provenance", () => {
  it("never lets AI output claim database-level truth", () => {
    expect(clampAiProvenance("database_fact")).toBe("hypothesis");
    expect(isTrustedFact(clampAiProvenance("database_fact"))).toBe(false);
  });

  it("keeps valid AI-assignable values and falls back safely", () => {
    expect(clampAiProvenance("hypothesis")).toBe("hypothesis");
    expect(clampAiProvenance("assistant_recommendation")).toBe("assistant_recommendation");
    expect(clampAiProvenance("nonsense")).toBe("hypothesis");
  });
});
