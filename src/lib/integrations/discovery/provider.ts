/**
 * Discovery provider abstraction — SERVER ONLY.
 *
 * The discovery worker never talks to a vendor directly: it talks to this
 * interface. That keeps the engine runnable today (mock provider) while the
 * Google Maps Platform connector is wired later, and leaves room for Apify as
 * a fallback source. No browser, extension, Playwright or Puppeteer anywhere.
 */
import type { DiscoveredPlace } from "@/lib/admin/discovery";

export const DISCOVERY_PROVIDERS = ["mock", "google_maps", "apify"] as const;
export type DiscoveryProviderName = (typeof DISCOVERY_PROVIDERS)[number];

export const DISCOVERY_PROVIDER_LABELS: Record<DiscoveryProviderName, string> = {
  mock: "Penyedia uji (mock)",
  google_maps: "Google Maps Platform",
  apify: "Apify (cadangan)",
};

export type ProviderSearchInput = {
  keyword: string;
  area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
  pageToken?: string | null;
  pageSize?: number;
};

export type ProviderSearchResult = {
  places: DiscoveredPlace[];
  nextPageToken: string | null;
  raw: Record<string, unknown>[];
};

export interface DiscoveryProvider {
  readonly name: DiscoveryProviderName;
  /** False when credentials are missing; the worker fails the task honestly. */
  isConfigured(): boolean;
  searchBusinesses(input: ProviderSearchInput): Promise<ProviderSearchResult>;
  getBusinessDetail(externalId: string): Promise<DiscoveredPlace | null>;
  normalizeResult(raw: Record<string, unknown>, keyword: string | null): DiscoveredPlace | null;
}

export class ProviderNotConfiguredError extends Error {}

/** Resolves a provider by name, falling back to the mock provider. */
export async function resolveDiscoveryProvider(
  name: string | null | undefined,
): Promise<DiscoveryProvider> {
  switch (name) {
    case "google_maps": {
      const { googleMapsProvider } = await import("./google-maps.provider");
      return googleMapsProvider;
    }
    case "apify": {
      const { apifyProvider } = await import("./apify.provider");
      return apifyProvider;
    }
    default: {
      const { mockProvider } = await import("./mock.provider");
      return mockProvider;
    }
  }
}
