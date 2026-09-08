/**
 * Mock discovery provider — deterministic, offline, for tests and dry runs.
 *
 * It never invents contact facts beyond what a maps-style source would expose,
 * and always produces the same rows for the same keyword + area, so repeated
 * runs stay idempotent.
 */
import type { DiscoveredPlace } from "@/lib/admin/discovery";
import type {
  DiscoveryProvider,
  ProviderSearchInput,
  ProviderSearchResult,
} from "./provider";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) % 100_000;
  return h;
}

function buildPlace(keyword: string, area: string, index: number): DiscoveredPlace {
  const seed = hash(`${keyword}|${area}|${index}`);
  const name = `${keyword.replace(/\b\w/g, (c) => c.toUpperCase())} ${area} ${index + 1}`;
  const hasWebsite = seed % 3 === 0;
  const placeId = `mock_${slug(keyword)}_${slug(area)}_${index + 1}`;
  return {
    placeId,
    name,
    category: keyword,
    address: `Jl. Contoh No. ${(seed % 90) + 1}, ${area}`,
    city: area,
    province: null,
    postalCode: null,
    country: "Indonesia",
    latitude: null,
    longitude: null,
    phone: `+62 81${String(200000000 + seed).slice(0, 9)}`,
    website: hasWebsite ? `https://${slug(name)}.example.id` : null,
    websiteStatus: hasWebsite ? "present" : "missing",
    rating: Number((3.6 + (seed % 14) / 10).toFixed(1)),
    reviewCount: seed % 400,
    mapsUrl: `https://maps.google.com/?cid=${placeId}`,
    openingHours: [],
    permanentlyClosed: seed % 37 === 0,
    keyword,
  };
}

export const mockProvider: DiscoveryProvider = {
  name: "mock",
  isConfigured: () => true,
  async searchBusinesses(input: ProviderSearchInput): Promise<ProviderSearchResult> {
    const area = (input.area ?? "Indonesia").trim() || "Indonesia";
    const size = Math.min(20, Math.max(1, input.pageSize ?? 10));
    const offset = input.pageToken ? Number(input.pageToken) || 0 : 0;
    const places = Array.from({ length: size }, (_, i) =>
      buildPlace(input.keyword.trim(), area, offset + i),
    );
    return {
      places,
      nextPageToken: offset + size >= 40 ? null : String(offset + size),
      raw: places.map((place) => ({ ...place })),
    };
  },
  async getBusinessDetail(externalId: string): Promise<DiscoveredPlace | null> {
    const parts = externalId.split("_");
    if (parts[0] !== "mock" || parts.length < 4) return null;
    const index = Number(parts[parts.length - 1]) - 1;
    return buildPlace(parts[1] ?? "usaha", parts[2] ?? "Indonesia", Number.isFinite(index) ? index : 0);
  },
  normalizeResult(raw: Record<string, unknown>, keyword: string | null): DiscoveredPlace | null {
    if (typeof raw["placeId"] !== "string" || typeof raw["name"] !== "string") return null;
    return { ...(raw as unknown as DiscoveredPlace), keyword };
  },
};
