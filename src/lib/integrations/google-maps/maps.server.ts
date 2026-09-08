/**
 * Google Maps Platform (Places API New) client — SERVER ONLY.
 *
 * All calls go through the Lovable connector gateway; no key is ever exposed
 * to the browser and no browser automation is involved.
 */
import type { DiscoveredPlace, WebsiteStatus } from "@/lib/admin/discovery";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.regularOpeningHours.weekdayDescriptions",
  "nextPageToken",
].join(",");

export class MapsConfigError extends Error {}
export class MapsRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function credentials(env: NodeJS.ProcessEnv = process.env) {
  const lovableKey = env["LOVABLE_API_KEY"];
  const connectionKey = env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new MapsConfigError(
      "Google Maps Platform belum terhubung. Hubungkan konektor Google Maps pada proyek ini.",
    );
  }
  return { lovableKey, connectionKey };
}

export function isMapsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env["LOVABLE_API_KEY"] && env["GOOGLE_MAPS_API_KEY"]);
}

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };

function component(components: AddressComponent[], type: string): string | null {
  const hit = components.find((c) => (c.types ?? []).includes(type));
  return hit?.longText ?? hit?.shortText ?? null;
}

export function normalizePlace(
  raw: Record<string, unknown>,
  keyword: string | null,
): DiscoveredPlace | null {
  const placeId = typeof raw["id"] === "string" ? raw["id"] : null;
  const name = (raw["displayName"] as { text?: string } | undefined)?.text ?? null;
  if (!placeId || !name) return null;

  const components = (raw["addressComponents"] as AddressComponent[] | undefined) ?? [];
  const location = raw["location"] as { latitude?: number; longitude?: number } | undefined;
  const website = typeof raw["websiteUri"] === "string" ? raw["websiteUri"] : null;
  const websiteStatus: WebsiteStatus = website ? "present" : "missing";
  const status = typeof raw["businessStatus"] === "string" ? raw["businessStatus"] : null;

  return {
    placeId,
    name,
    category:
      (raw["primaryTypeDisplayName"] as { text?: string } | undefined)?.text ??
      ((raw["types"] as string[] | undefined)?.[0]?.replace(/_/g, " ") ?? null),
    address: typeof raw["formattedAddress"] === "string" ? raw["formattedAddress"] : null,
    city:
      component(components, "locality") ??
      component(components, "administrative_area_level_2") ??
      null,
    province: component(components, "administrative_area_level_1"),
    postalCode: component(components, "postal_code"),
    country: component(components, "country") ?? "Indonesia",
    latitude: typeof location?.latitude === "number" ? location.latitude : null,
    longitude: typeof location?.longitude === "number" ? location.longitude : null,
    phone:
      (typeof raw["internationalPhoneNumber"] === "string"
        ? raw["internationalPhoneNumber"]
        : null) ??
      (typeof raw["nationalPhoneNumber"] === "string" ? raw["nationalPhoneNumber"] : null),
    website,
    websiteStatus,
    rating: typeof raw["rating"] === "number" ? raw["rating"] : null,
    reviewCount: typeof raw["userRatingCount"] === "number" ? raw["userRatingCount"] : null,
    mapsUrl: typeof raw["googleMapsUri"] === "string" ? raw["googleMapsUri"] : null,
    openingHours:
      (raw["regularOpeningHours"] as { weekdayDescriptions?: string[] } | undefined)
        ?.weekdayDescriptions ?? [],
    permanentlyClosed: status === "CLOSED_PERMANENTLY",
    keyword,
  };
}

export type SearchPlacesInput = {
  keyword: string;
  area?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
  pageToken?: string | null;
  pageSize?: number;
  regionCode?: string;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
};

export type SearchPlacesResult = {
  places: DiscoveredPlace[];
  nextPageToken: string | null;
  raw: Record<string, unknown>[];
};

/** Region-scoped text search — never a bare business name. */
export function buildDiscoveryQuery(keyword: string, area?: string | null): string {
  const parts = [keyword.trim()];
  if (area?.trim()) parts.push(area.trim());
  parts.push("Indonesia");
  return parts.filter(Boolean).join(" ");
}

export async function searchPlaces(input: SearchPlacesInput): Promise<SearchPlacesResult> {
  const { fetchImpl = fetch, env = process.env } = input;
  const { lovableKey, connectionKey } = credentials(env);

  const body: Record<string, unknown> = {
    textQuery: buildDiscoveryQuery(input.keyword, input.area),
    pageSize: Math.min(20, Math.max(1, input.pageSize ?? 20)),
    regionCode: input.regionCode ?? "ID",
    languageCode: "id",
  };
  if (input.pageToken) body["pageToken"] = input.pageToken;
  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    body["locationBias"] = {
      circle: {
        center: { latitude: input.latitude, longitude: input.longitude },
        radius: Math.min(50_000, Math.max(500, input.radiusMeters ?? 5_000)),
      },
    };
  }

  const response = await fetchImpl(`${GATEWAY_URL}/places/v1/places:searchText`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 403) {
      throw new MapsRequestError(
        `Google Maps menolak permintaan (403). Periksa pembatasan kunci di Google Cloud Console: ${text.slice(0, 300)}`,
        403,
      );
    }
    throw new MapsRequestError(
      `Google Maps gagal [${response.status}]: ${text.slice(0, 300)}`,
      response.status,
    );
  }

  const payload = (await response.json().catch(() => ({}))) as {
    places?: Record<string, unknown>[];
    nextPageToken?: string;
  };
  const raw = payload.places ?? [];
  return {
    places: raw
      .map((item) => normalizePlace(item, input.keyword))
      .filter((place): place is DiscoveredPlace => place !== null),
    nextPageToken: payload.nextPageToken ?? null,
    raw,
  };
}

const DETAIL_FIELD_MASK = FIELD_MASK.replace(/places\./g, "").replace(",nextPageToken", "");

/** Single place lookup (Places API New details endpoint). */
export async function fetchPlaceDetail(
  placeId: string,
  options: { keyword?: string | null; fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {},
): Promise<DiscoveredPlace | null> {
  const { fetchImpl = fetch, env = process.env } = options;
  const { lovableKey, connectionKey } = credentials(env);

  const response = await fetchImpl(
    `${GATEWAY_URL}/places/v1/places/${encodeURIComponent(placeId)}?languageCode=id`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "X-Goog-FieldMask": DETAIL_FIELD_MASK,
      },
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new MapsRequestError(
      `Google Maps gagal [${response.status}]: ${text.slice(0, 300)}`,
      response.status,
    );
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return normalizePlace(payload, options.keyword ?? null);
}
