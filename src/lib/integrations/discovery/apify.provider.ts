/**
 * Apify discovery provider — SERVER ONLY, fallback source.
 *
 * Reuses the existing Apify client and Google Maps actor. Only used when a
 * campaign explicitly selects it; the token stays server-side.
 */
import type { DiscoveredPlace, WebsiteStatus } from "@/lib/admin/discovery";
import { apifyActorId, runApifyActor } from "@/lib/integrations/apify/apify.server";
import { buildDiscoveryQuery } from "@/lib/integrations/google-maps/maps.server";
import {
  ProviderNotConfiguredError,
  type DiscoveryProvider,
  type ProviderSearchInput,
  type ProviderSearchResult,
} from "./provider";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isConfigured(): boolean {
  return Boolean(
    process.env["APIFY_API_TOKEN"] ||
      (process.env["APIFY_API_KEY"] && process.env["LOVABLE_API_KEY"]),
  );
}

function normalize(raw: Record<string, unknown>, keyword: string | null): DiscoveredPlace | null {
  const placeId = str(raw["placeId"]) ?? str(raw["place_id"]) ?? str(raw["fid"]);
  const name = str(raw["title"]) ?? str(raw["name"]);
  if (!placeId || !name) return null;
  const website = str(raw["website"]);
  const websiteStatus: WebsiteStatus = website ? "present" : "missing";
  return {
    placeId,
    name,
    category: str(raw["categoryName"]) ?? str(raw["category"]),
    address: str(raw["address"]),
    city: str(raw["city"]),
    province: str(raw["state"]),
    postalCode: str(raw["postalCode"]),
    country: str(raw["countryCode"]) === "ID" ? "Indonesia" : (str(raw["country"]) ?? "Indonesia"),
    latitude: num((raw["location"] as { lat?: number } | undefined)?.lat),
    longitude: num((raw["location"] as { lng?: number } | undefined)?.lng),
    phone: str(raw["phone"]) ?? str(raw["phoneUnformatted"]),
    website,
    websiteStatus,
    rating: num(raw["totalScore"]) ?? num(raw["rating"]),
    reviewCount: num(raw["reviewsCount"]),
    mapsUrl: str(raw["url"]),
    openingHours: [],
    permanentlyClosed: raw["permanentlyClosed"] === true,
    keyword,
  };
}

export const apifyProvider: DiscoveryProvider = {
  name: "apify",
  isConfigured,
  async searchBusinesses(input: ProviderSearchInput): Promise<ProviderSearchResult> {
    if (!isConfigured()) {
      throw new ProviderNotConfiguredError("Apify belum dikonfigurasi (APIFY_API_TOKEN kosong).");
    }
    const maxItems = Math.min(20, Math.max(1, input.pageSize ?? 10));
    const run = await runApifyActor({
      actorId: apifyActorId("googleMaps"),
      maxItems,
      input: {
        searchStringsArray: [buildDiscoveryQuery(input.keyword, input.area ?? null)],
        maxCrawledPlacesPerSearch: maxItems,
        language: "id",
        countryCode: "id",
      },
    });
    if (run.status !== "succeeded") {
      throw new Error(run.error ?? "Apify gagal menjalankan pencarian.");
    }
    return {
      places: run.items
        .map((item) => normalize(item, input.keyword))
        .filter((place): place is DiscoveredPlace => place !== null),
      nextPageToken: null,
      raw: run.items,
    };
  },
  async getBusinessDetail(): Promise<DiscoveredPlace | null> {
    // Apify returns full rows from search; there is no cheap per-place lookup.
    return null;
  },
  normalizeResult: normalize,
};
