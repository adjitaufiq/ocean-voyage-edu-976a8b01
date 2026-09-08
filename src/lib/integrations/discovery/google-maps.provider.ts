/**
 * Google Maps Platform discovery provider — SERVER ONLY.
 *
 * A thin adapter over the existing Places API (New) client. It reports
 * "not configured" until the connector is linked, so the engine can be built
 * and tested before the credentials exist.
 */
import type { DiscoveredPlace } from "@/lib/admin/discovery";
import {
  fetchPlaceDetail,
  isMapsConfigured,
  normalizePlace,
  searchPlaces,
} from "@/lib/integrations/google-maps/maps.server";
import {
  ProviderNotConfiguredError,
  type DiscoveryProvider,
  type ProviderSearchInput,
  type ProviderSearchResult,
} from "./provider";

function assertConfigured(): void {
  if (!isMapsConfigured()) {
    throw new ProviderNotConfiguredError(
      "Google Maps Platform belum terhubung. Hubungkan konektor Google Maps, atau gunakan penyedia uji.",
    );
  }
}

export const googleMapsProvider: DiscoveryProvider = {
  name: "google_maps",
  isConfigured: () => isMapsConfigured(),
  async searchBusinesses(input: ProviderSearchInput): Promise<ProviderSearchResult> {
    assertConfigured();
    return searchPlaces({
      keyword: input.keyword,
      area: input.area ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      radiusMeters: input.radiusMeters ?? 5_000,
      pageToken: input.pageToken ?? null,
      pageSize: input.pageSize ?? 20,
    });
  },
  async getBusinessDetail(externalId: string): Promise<DiscoveredPlace | null> {
    assertConfigured();
    return fetchPlaceDetail(externalId);
  },
  normalizeResult(raw: Record<string, unknown>, keyword: string | null): DiscoveredPlace | null {
    return normalizePlace(raw, keyword);
  },
};
