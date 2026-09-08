import { describe, expect, it } from "vitest";

import { addressKey, categoryMatches, screenPlace, HOT_LEAD_MIN } from "@/lib/admin/discovery";

import { mockProvider } from "./mock.provider";
import { resolveDiscoveryProvider } from "./provider";

describe("discovery provider layer", () => {
  it("mock provider is usable without any credential", () => {
    expect(mockProvider.isConfigured()).toBe(true);
  });

  it("returns deterministic results for the same keyword and area", async () => {
    const a = await mockProvider.searchBusinesses({ keyword: "kopi", area: "Jakarta", pageSize: 5 });
    const b = await mockProvider.searchBusinesses({ keyword: "kopi", area: "Jakarta", pageSize: 5 });
    expect(a.places).toHaveLength(5);
    expect(a.places.map((p) => p.placeId)).toEqual(b.places.map((p) => p.placeId));
  });

  it("paginates with a page token and stops eventually", async () => {
    const first = await mockProvider.searchBusinesses({ keyword: "kopi", area: "Bandung", pageSize: 20 });
    expect(first.nextPageToken).toBe("20");
    const second = await mockProvider.searchBusinesses({
      keyword: "kopi",
      area: "Bandung",
      pageSize: 20,
      pageToken: first.nextPageToken,
    });
    expect(second.nextPageToken).toBeNull();
    const ids = new Set([...first.places, ...second.places].map((p) => p.placeId));
    expect(ids.size).toBe(40);
  });

  it("resolves place detail by external id and rejects foreign ids", async () => {
    const place = await mockProvider.getBusinessDetail("mock_kopi_jakarta_1");
    expect(place?.name).toContain("Kopi");
    expect(await mockProvider.getBusinessDetail("google_123")).toBeNull();
  });

  it("normalizeResult rejects payloads without an identity", () => {
    expect(mockProvider.normalizeResult({ name: "Tanpa id" }, "kopi")).toBeNull();
    expect(mockProvider.normalizeResult({ placeId: "x", name: "Ada" }, "kopi")?.keyword).toBe("kopi");
  });

  it("defaults to the mock provider for unknown names", async () => {
    expect((await resolveDiscoveryProvider(null)).name).toBe("mock");
    expect((await resolveDiscoveryProvider("nonsense")).name).toBe("mock");
    expect((await resolveDiscoveryProvider("google_maps")).name).toBe("google_maps");
  });
});

describe("discovery screening reuse", () => {
  it("scores a business without a website higher than one with a strong site", async () => {
    const { places } = await mockProvider.searchBusinesses({
      keyword: "bengkel",
      area: "Surabaya",
      pageSize: 20,
    });
    const missing = places.find((p) => p.websiteStatus === "missing");
    const present = places.find((p) => p.websiteStatus === "present");
    expect(missing && present).toBeTruthy();
    const a = screenPlace(missing!);
    const b = screenPlace(present!);
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(HOT_LEAD_MIN).toBeGreaterThan(0);
  });

  it("address key normalizes punctuation and casing for duplicate checks", () => {
    expect(addressKey("Jl. Contoh No. 12, Jakarta")).toBe(addressKey("jl contoh no 12 jakarta"));
    expect(addressKey(null)).toBe("");
  });

  it("category matching is permissive when no target category is set", () => {
    expect(categoryMatches("kafe", [])).toBe(true);
    expect(categoryMatches("kafe", ["restoran"])).toBe(false);
    expect(categoryMatches("Kafe Kopi", ["kafe"])).toBe(true);
  });
});
