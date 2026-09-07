import { describe, expect, it } from "vitest";

import {
  ApifyAuthError,
  ApifyConfigError,
  apifyActorId,
  resolveApifyTransport,
  runApifyActor,
} from "@/lib/integrations/apify/apify.client.server";
import {
  normalizeMapsItem,
  normalizeWebsiteItem,
  socialPlatform,
} from "@/lib/prospecting-apify.server";

const env = { APIFY_API_TOKEN: "test-token" } as NodeJS.ProcessEnv;

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", "x-apify-run-id": "run_1", "x-apify-dataset-id": "ds_1" },
    ...init,
  });
}

describe("apify client", () => {
  it("1. enriches a candidate successfully", async () => {
    const result = await runApifyActor({
      actorId: "compass~crawler-google-places",
      input: { searchTerms: ["Kopi Ombak"] },
      env,
      fetchImpl: async () =>
        jsonResponse([{ title: "Kopi Ombak", phone: "+628111", placeId: "p1", url: "https://maps.google/x" }]),
    });

    expect(result.status).toBe("succeeded");
    expect(result.items).toHaveLength(1);
    const maps = normalizeMapsItem(result.items[0]!);
    expect(maps.business_name).toBe("Kopi Ombak");
    expect(maps.place_id).toBe("p1");
    expect(maps.permanently_closed).toBe(false);
  });

  it("2. reports a timeout instead of inventing data", async () => {
    const result = await runApifyActor({
      actorId: "actor",
      input: {},
      env,
      timeoutMs: 20,
      maxRetries: 0,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    });

    expect(result.status).toBe("timeout");
    expect(result.items).toEqual([]);
  });

  it("3. rejects an invalid API token without retrying", async () => {
    let calls = 0;
    await expect(
      runApifyActor({
        actorId: "actor",
        input: {},
        env,
        maxRetries: 3,
        fetchImpl: async () => {
          calls += 1;
          return new Response("unauthorized", { status: 401 });
        },
      }),
    ).rejects.toBeInstanceOf(ApifyAuthError);
    expect(calls).toBe(1);
  });

  it("fails loudly when no credentials are configured", () => {
    expect(() => resolveApifyTransport({} as NodeJS.ProcessEnv)).toThrow(ApifyConfigError);
    expect(apifyActorId("googleMaps", {} as NodeJS.ProcessEnv)).toBe("compass~crawler-google-places");
    expect(apifyActorId("googleMaps", { APIFY_DEFAULT_ACTOR_GOOGLE_MAPS: "me~actor" } as NodeJS.ProcessEnv)).toBe(
      "me~actor",
    );
  });
});

describe("evidence normalizers", () => {
  it("4. detects the same business returned twice (duplicate)", () => {
    const a = normalizeMapsItem({ title: "PT Ombak Digital", placeId: "same" });
    const b = normalizeMapsItem({ title: "Ombak Digital", placeId: "same" });
    expect(a.place_id).toBe(b.place_id);
  });

  it("maps website + social evidence", () => {
    const website = normalizeWebsiteItem(
      { text: "Hubungi kami di halo@ombak.id", links: ["https://ombak.id/kontak"] },
      "https://ombak.id",
    );
    expect(website.ssl_valid).toBe(true);
    expect(website.emails_found).toContain("halo@ombak.id");
    expect(website.contact_page).toBe("https://ombak.id/kontak");
    expect(socialPlatform("https://instagram.com/ombak")).toBe("instagram");
    expect(socialPlatform("https://example.com")).toBeNull();
  });
});

describe("promotion gate", () => {
  function stubClient(rows: unknown[]) {
    const builder: Record<string, unknown> = {};
    for (const key of ["select", "eq", "order"]) {
      builder[key] = () => builder;
    }
    builder["then"] = undefined;
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: async () => ({ data: rows }),
            }),
          }),
        }),
      }),
    } as never;
  }

  it("5. blocks promotion when external evidence is missing", async () => {
    const { validateExternalEvidence } = await import("@/lib/prospecting-apify.server");
    const verdict = await validateExternalEvidence(stubClient([]), "00000000-0000-0000-0000-000000000000");
    expect(verdict.ok).toBe(false);
    expect(verdict.trustScore).toBeLessThan(65);
    expect(verdict.reasons.join(" ")).toContain("Google Maps");
  });

  it("passes when Google Maps proves the business and a phone exists", async () => {
    const { validateExternalEvidence } = await import("@/lib/prospecting-apify.server");
    const verdict = await validateExternalEvidence(
      stubClient([
        {
          source_type: "google_maps",
          confidence_score: 90,
          normalized_data: {
            place_id: "p1",
            phone: "+628111",
            address: "Jl. Laut 1",
            permanently_closed: false,
          },
        },
      ]),
      "00000000-0000-0000-0000-000000000000",
    );
    expect(verdict.trustScore).toBeGreaterThanOrEqual(65);
    expect(verdict.ok).toBe(true);
  });
});
