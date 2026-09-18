/**
 * Discovery engine — SERVER ONLY.
 *
 * Campaign -> discovery tasks -> provider -> normalize -> duplicate check ->
 * candidate. No browser, no extension, no Playwright/Puppeteer: every source
 * is an HTTP data provider behind the DiscoveryProvider interface.
 *
 * Screening, lead scoring, digital-gap analysis and the QC pipeline are reused
 * from `@/lib/admin/discovery` — this module only orchestrates them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  addressKey,
  categoryMatches,
  screenPlace,
  type DiscoveredPlace,
  type DiscoveryTaskRow,
} from "@/lib/admin/discovery";
import { buildDedupeKey, normalizeBusinessKey } from "@/lib/admin/prospect-candidates";
import {
  ProviderNotConfiguredError,
  resolveDiscoveryProvider,
  type DiscoveryProvider,
} from "@/lib/integrations/discovery/provider";

type Client = SupabaseClient<Database>;

/** Hard bounds so a single run can never storm a provider. */
export const MAX_TASKS_PER_RUN = 5;
export const MAX_TASKS_PER_CAMPAIGN = 60;
export const PAGE_SIZE = 20;
/** A task locked longer than this is considered abandoned and can be retaken. */
const LEASE_MS = 10 * 60 * 1000;

const TASK_COLUMNS =
  "id, campaign_id, keyword, area, radius_meters, latitude, longitude, status, attempt, max_attempts, found_count, saved_count, duplicate_count, rejected_count, page_token, last_error, last_run_at, locked_at, created_at";

type TaskRecord = DiscoveryTaskRow & {
  latitude: number | null;
  longitude: number | null;
  page_token: string | null;
  locked_at: string | null;
};

type CampaignRecord = {
  id: string;
  name: string;
  industry: string;
  location: string;
  keywords: string[];
  areas: string[];
  target_categories: string[];
  discovery_provider: string;
  radius_meters: number;
  latitude: number | null;
  longitude: number | null;
  target_candidates: number;
  status: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function asCampaign(row: Record<string, unknown>): CampaignRecord {
  return {
    id: String(row["id"]),
    name: String(row["name"] ?? ""),
    industry: String(row["industry"] ?? ""),
    location: String(row["location"] ?? ""),
    keywords: asStringArray(row["keywords"]),
    areas: asStringArray(row["areas"]),
    target_categories: asStringArray(row["target_categories"]),
    discovery_provider: String(row["discovery_provider"] ?? "mock"),
    radius_meters: Number(row["radius_meters"] ?? 5000),
    latitude: row["latitude"] == null ? null : Number(row["latitude"]),
    longitude: row["longitude"] == null ? null : Number(row["longitude"]),
    target_candidates: Number(row["target_candidates"] ?? 100),
    status: String(row["status"] ?? "active"),
  };
}

function asTask(row: Record<string, unknown>): TaskRecord {
  return {
    id: String(row["id"]),
    campaign_id: String(row["campaign_id"]),
    keyword: String(row["keyword"]),
    area: String(row["area"]),
    radius_meters: Number(row["radius_meters"] ?? 5000),
    status: row["status"] as TaskRecord["status"],
    attempt: Number(row["attempt"] ?? 0),
    max_attempts: Number(row["max_attempts"] ?? 3),
    found_count: Number(row["found_count"] ?? 0),
    saved_count: Number(row["saved_count"] ?? 0),
    duplicate_count: Number(row["duplicate_count"] ?? 0),
    rejected_count: Number(row["rejected_count"] ?? 0),
    last_error: (row["last_error"] as string | null) ?? null,
    last_run_at: (row["last_run_at"] as string | null) ?? null,
    created_at: String(row["created_at"]),
    latitude: row["latitude"] == null ? null : Number(row["latitude"]),
    longitude: row["longitude"] == null ? null : Number(row["longitude"]),
    page_token: (row["page_token"] as string | null) ?? null,
    locked_at: (row["locked_at"] as string | null) ?? null,
  };
}

async function fetchCampaign(supabase: Client, id: string): Promise<CampaignRecord> {
  const { data, error } = await supabase
    .from("prospect_campaigns")
    .select(
      "id, name, industry, location, keywords, areas, target_categories, discovery_provider, radius_meters, latitude, longitude, target_candidates, status",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kampanye tidak ditemukan.");
  return asCampaign(data as Record<string, unknown>);
}

/* ------------------------------------------------------------------ */
/* 1. Task engine: campaign -> discovery tasks                         */
/* ------------------------------------------------------------------ */

export type PlanDiscoveryInput = {
  campaignId: string;
  keywords?: string[];
  areas?: string[];
  radiusMeters?: number;
};

export type PlanDiscoveryResult = {
  campaign: string;
  created: number;
  skipped: number;
  total: number;
};

/** Splits a campaign into keyword x area tasks. Re-running never duplicates. */
export async function planCampaignDiscovery(
  supabase: Client,
  input: PlanDiscoveryInput,
  actor?: { userId?: string | null },
): Promise<PlanDiscoveryResult> {
  const campaign = await fetchCampaign(supabase, input.campaignId);
  const keywords = (input.keywords?.length ? input.keywords : campaign.keywords)
    .map((item) => item.trim())
    .filter(Boolean);
  const areas = (
    input.areas?.length ? input.areas : campaign.areas.length ? campaign.areas : [campaign.location]
  )
    .map((item) => item.trim())
    .filter(Boolean);

  if (keywords.length === 0) throw new Error("Kampanye belum punya kata kunci pencarian.");
  if (areas.length === 0) throw new Error("Kampanye belum punya wilayah target.");

  const { data: existing, error } = await supabase
    .from("discovery_tasks")
    .select("keyword, area")
    .eq("campaign_id", campaign.id);
  if (error) throw new Error(error.message);
  const seen = new Set(
    (existing ?? []).map((row) => `${String(row.keyword).toLowerCase()}|${String(row.area).toLowerCase()}`),
  );

  const rows: Record<string, unknown>[] = [];
  for (const keyword of keywords) {
    for (const area of areas) {
      const key = `${keyword.toLowerCase()}|${area.toLowerCase()}`;
      if (seen.has(key)) continue;
      if (seen.size + rows.length >= MAX_TASKS_PER_CAMPAIGN) break;
      rows.push({
        campaign_id: campaign.id,
        keyword,
        area,
        radius_meters: input.radiusMeters ?? campaign.radius_meters,
        latitude: campaign.latitude,
        longitude: campaign.longitude,
        status: "queued",
        created_by: actor?.userId ?? null,
      });
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("discovery_tasks").insert(rows as never);
    if (insertError) throw new Error(insertError.message);
  }

  return {
    campaign: campaign.name,
    created: rows.length,
    skipped: keywords.length * areas.length - rows.length,
    total: seen.size + rows.length,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Usage counter                                                    */
/* ------------------------------------------------------------------ */

async function bumpUsage(
  supabase: Client,
  provider: string,
  delta: { requests?: number; results?: number; errors?: number },
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("discovery_usage_daily")
    .select("requests, results, errors")
    .eq("usage_date", today)
    .eq("provider", provider)
    .maybeSingle();
  const row = {
    usage_date: today,
    provider,
    requests: Number(data?.requests ?? 0) + (delta.requests ?? 0),
    results: Number(data?.results ?? 0) + (delta.results ?? 0),
    errors: Number(data?.errors ?? 0) + (delta.errors ?? 0),
    updated_at: new Date().toISOString(),
  };
  await supabase
    .from("discovery_usage_daily")
    .upsert(row as never, { onConflict: "usage_date,provider" });
}

/* ------------------------------------------------------------------ */
/* 3. Worker                                                           */
/* ------------------------------------------------------------------ */

export type DiscoveryRunResult = {
  provider: string;
  tasks: number;
  found: number;
  saved: number;
  duplicates: number;
  rejected: number;
  failed: number;
  errors: string[];
};

async function leaseTasks(
  supabase: Client,
  options: { taskId?: string; campaignId?: string; limit: number },
): Promise<TaskRecord[]> {
  const staleBefore = new Date(Date.now() - LEASE_MS).toISOString();
  let query = supabase.from("discovery_tasks").select(TASK_COLUMNS);
  if (options.taskId) query = query.eq("id", options.taskId);
  if (options.campaignId) query = query.eq("campaign_id", options.campaignId);
  const { data, error } = await query
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(options.limit * 3);
  if (error) throw new Error(error.message);

  const leased: TaskRecord[] = [];
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    if (leased.length >= options.limit) break;
    const task = asTask(raw);
    // Single-flight: a running task is only retaken when its lease expired.
    if (task.status === "running" && task.locked_at && task.locked_at > staleBefore) continue;
    const { data: claimed, error: claimError } = await supabase
      .from("discovery_tasks")
      .update({
        status: "running",
        locked_at: new Date().toISOString(),
        attempt: task.attempt + 1,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", task.id)
      .eq("status", task.status)
      .select("id");
    if (claimError) throw new Error(claimError.message);
    if ((claimed ?? []).length === 0) continue; // another worker won the race
    leased.push({ ...task, attempt: task.attempt + 1, status: "running" });
  }
  return leased;
}

type SaveOutcome = { saved: number; duplicates: number; rejected: number };

async function saveCandidates(
  supabase: Client,
  campaign: CampaignRecord,
  task: TaskRecord,
  provider: DiscoveryProvider,
  places: DiscoveredPlace[],
  raw: Record<string, unknown>[],
): Promise<SaveOutcome> {
  const outcome: SaveOutcome = { saved: 0, duplicates: 0, rejected: 0 };
  if (places.length === 0) return outcome;

  const placeIds = places.map((place) => place.placeId);
  const dedupeKeys = places
    .map((place) => buildDedupeKey(place.name, place.city, place.country))
    .filter((key): key is string => Boolean(key));
  const names = places.map((place) => normalizeBusinessKey(place.name)).filter(Boolean);

  const [{ data: existingCandidates }, { data: existingProspects }] = await Promise.all([
    supabase
      .from("prospect_candidates")
      .select("id, place_id, dedupe_key, business_name, address")
      .or(
        `place_id.in.(${placeIds.map((id) => `"${id}"`).join(",")}),dedupe_key.in.(${
          dedupeKeys.length ? dedupeKeys.map((k) => `"${k}"`).join(",") : '""'
        })`,
      ),
    names.length
      ? supabase.from("prospects").select("id, business_name_normalized").in("business_name_normalized", names)
      : Promise.resolve({ data: [] as { id: string; business_name_normalized: string | null }[] }),
  ]);

  const knownPlaceIds = new Set(
    ((existingCandidates ?? []) as Record<string, unknown>[])
      .map((row) => row["place_id"])
      .filter((id): id is string => typeof id === "string"),
  );
  const knownEntityKeys = new Set(
    ((existingCandidates ?? []) as Record<string, unknown>[]).map(
      (row) =>
        `${normalizeBusinessKey(String(row["business_name"] ?? ""))}|${addressKey(
          (row["address"] as string | null) ?? "",
        )}`,
    ),
  );
  const crmNames = new Set(
    ((existingProspects ?? []) as { business_name_normalized: string | null }[])
      .map((row) => row.business_name_normalized ?? "")
      .filter(Boolean),
  );

  const now = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  const sources: Record<string, unknown>[] = [];
  const batchPlaceIds = new Set<string>();
  const batchEntityKeys = new Set<string>();

  places.forEach((place, index) => {
    if (place.permanentlyClosed) {
      outcome.rejected += 1;
      return;
    }
    if (!categoryMatches(place.category, campaign.target_categories)) {
      outcome.rejected += 1;
      return;
    }
    if (knownPlaceIds.has(place.placeId) || batchPlaceIds.has(place.placeId)) {
      outcome.duplicates += 1;
      return;
    }
    const entityKey = `${normalizeBusinessKey(place.name)}|${addressKey(place.address)}`;
    if (knownEntityKeys.has(entityKey) || batchEntityKeys.has(entityKey)) {
      outcome.duplicates += 1;
      return;
    }
    if (crmNames.has(normalizeBusinessKey(place.name))) {
      outcome.rejected += 1;
      return;
    }
    batchPlaceIds.add(place.placeId);
    batchEntityKeys.add(entityKey);

    const screening = screenPlace({
      category: place.category,
      city: place.city,
      permanentlyClosed: place.permanentlyClosed,
      rating: place.rating,
      reviewCount: place.reviewCount,
      phone: place.phone,
      websiteStatus: place.websiteStatus,
      targetCategories: campaign.target_categories,
      targetCities: campaign.areas.length ? campaign.areas : [campaign.location],
    });

    const contactData: Record<string, unknown> = {};
    if (place.phone) {
      contactData["phone"] = {
        value: place.phone,
        source: provider.name === "mock" ? "manual" : "google_maps",
        source_url: place.mapsUrl,
        verified_at: now,
      };
    }
    if (place.website) {
      contactData["website"] = {
        value: place.website,
        source: provider.name === "mock" ? "manual" : "google_maps",
        source_url: place.website,
        verified_at: now,
      };
    }

    const qualification = qualifyCandidate({
      businessName: place.name,
      category: place.category,
      industry: campaign.industry,
      address: place.address,
      city: place.city,
      province: place.province,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      phone: place.phone,
      website: place.website,
      websiteStatus: place.websiteStatus,
      rating: place.rating,
      reviewCount: place.reviewCount,
      placeId: place.placeId,
      googleMapsUrl: place.mapsUrl,
      permanentlyClosed: place.permanentlyClosed,
      contactData: contactData as Record<string, { value?: string | null; source?: string | null }>,
      targetCategories: campaign.target_categories,
      targetCities: campaign.areas.length ? campaign.areas : [campaign.location],
    });

    rows.push({
      campaign_id: campaign.id,
      discovery_task_id: task.id,
      business_name: place.name,
      industry: campaign.industry,
      category: place.category,
      address: place.address,
      city: place.city,
      province: place.province,
      postal_code: place.postalCode,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      phone: place.phone,
      website: place.website,
      website_status: place.websiteStatus,
      rating: place.rating,
      review_count: place.reviewCount,
      google_maps_url: place.mapsUrl,
      opening_hours: place.openingHours,
      permanently_closed: place.permanentlyClosed,
      place_id: place.placeId,
      source_keyword: task.keyword,
      contact_data: contactData,
      discovery_method: "apify_search",
      discovery_source: provider.name,
      discovery_query: `${task.keyword} ${task.area}`.trim(),
      discovery_reason: screening.reason,
      candidate_status: "discovered",
      qc_status: "new",
      raw_payload: raw[index] ?? {},
      ...qualificationPatch(qualification),
    });

  });

  if (rows.length === 0) return outcome;

  const { data: inserted, error } = await supabase
    .from("prospect_candidates")
    .insert(rows as never)
    .select("id, place_id");
  if (error) throw new Error(error.message);

  const insertedRows = (inserted ?? []) as { id: string; place_id: string | null }[];
  outcome.saved = insertedRows.length;

  for (const row of insertedRows) {
    const index = rows.findIndex((item) => item["place_id"] === row.place_id);
    sources.push({
      candidate_id: row.id,
      provider: provider.name,
      source_type: "discovery_search",
      external_id: row.place_id,
      source_url: index >= 0 ? (rows[index]?.["google_maps_url"] ?? null) : null,
      raw_payload: index >= 0 ? (rows[index]?.["raw_payload"] ?? {}) : {},
      normalized_data: index >= 0 ? (rows[index] ?? {}) : {},
      confidence_score: provider.name === "google_maps" ? 90 : provider.name === "apify" ? 70 : 40,
      status: "completed",
    });
  }
  if (sources.length > 0) {
    await supabase.from("candidate_sources").insert(sources as never);
    await supabase.from("candidate_status_history").insert(
      insertedRows.map((row) => ({
        candidate_id: row.id,
        from_status: null,
        to_status: "discovered",
        actor_kind: "system",
        actor_label: `discovery:${provider.name}`,
        reason: `Ditemukan lewat tugas ${task.keyword} — ${task.area}`,
      })) as never,
    );
  }

  return outcome;
}

/** Runs a bounded batch of discovery tasks. Safe to call repeatedly. */
export async function runDiscoveryBatch(
  supabase: Client,
  options: { taskId?: string; campaignId?: string; limit?: number } = {},
): Promise<DiscoveryRunResult> {
  const limit = Math.min(MAX_TASKS_PER_RUN, Math.max(1, options.limit ?? 3));
  const tasks = await leaseTasks(supabase, { ...options, limit });
  const result: DiscoveryRunResult = {
    provider: "-",
    tasks: tasks.length,
    found: 0,
    saved: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
    errors: [],
  };
  if (tasks.length === 0) return result;

  const campaigns = new Map<string, CampaignRecord>();
  const providers = new Map<string, DiscoveryProvider>();

  for (const task of tasks) {
    let providerName = "mock";
    try {
      let campaign = campaigns.get(task.campaign_id);
      if (!campaign) {
        campaign = await fetchCampaign(supabase, task.campaign_id);
        campaigns.set(campaign.id, campaign);
      }
      providerName = campaign.discovery_provider;
      let provider = providers.get(providerName);
      if (!provider) {
        provider = await resolveDiscoveryProvider(providerName);
        providers.set(providerName, provider);
      }
      result.provider = provider.name;
      if (!provider.isConfigured()) {
        throw new ProviderNotConfiguredError(
          `Penyedia data "${provider.name}" belum terkonfigurasi.`,
        );
      }

      const search = await provider.searchBusinesses({
        keyword: task.keyword,
        area: task.area,
        latitude: task.latitude,
        longitude: task.longitude,
        radiusMeters: task.radius_meters,
        pageToken: task.page_token,
        pageSize: PAGE_SIZE,
      });
      await bumpUsage(supabase, provider.name, { requests: 1, results: search.places.length });

      const outcome = await saveCandidates(
        supabase,
        campaign,
        task,
        provider,
        search.places,
        search.raw,
      );
      result.found += search.places.length;
      result.saved += outcome.saved;
      result.duplicates += outcome.duplicates;
      result.rejected += outcome.rejected;

      const savedTotal = task.saved_count + outcome.saved;
      const reachedTarget = savedTotal >= campaign.target_candidates;
      const more = Boolean(search.nextPageToken) && !reachedTarget;

      await supabase
        .from("discovery_tasks")
        .update({
          status: more ? "queued" : "completed",
          page_token: more ? search.nextPageToken : null,
          found_count: task.found_count + search.places.length,
          saved_count: savedTotal,
          duplicate_count: task.duplicate_count + outcome.duplicates,
          rejected_count: task.rejected_count + outcome.rejected,
          last_error: null,
          last_run_at: new Date().toISOString(),
          locked_at: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", task.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Discovery gagal tanpa detail.";
      result.failed += 1;
      result.errors.push(`${task.keyword} — ${task.area}: ${message}`);
      await bumpUsage(supabase, providerName, { errors: 1 });
      const exhausted = task.attempt >= task.max_attempts;
      await supabase
        .from("discovery_tasks")
        .update({
          status: exhausted ? "failed" : "queued",
          last_error: message.slice(0, 500),
          last_run_at: new Date().toISOString(),
          locked_at: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", task.id);
    }
  }

  return result;
}

/** Puts failed tasks that still have attempts left back in the queue. */
export async function retryFailedDiscoveryTasks(
  supabase: Client,
  options: { campaignId?: string; taskId?: string } = {},
): Promise<{ requeued: number }> {
  let query = supabase.from("discovery_tasks").select("id, attempt, max_attempts").eq("status", "failed");
  if (options.campaignId) query = query.eq("campaign_id", options.campaignId);
  if (options.taskId) query = query.eq("id", options.taskId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const ids = ((data ?? []) as { id: string; attempt: number; max_attempts: number }[])
    .filter((row) => row.attempt < row.max_attempts)
    .map((row) => row.id);
  if (ids.length === 0) return { requeued: 0 };

  const { error: updateError } = await supabase
    .from("discovery_tasks")
    .update({ status: "queued", locked_at: null, updated_at: new Date().toISOString() } as never)
    .in("id", ids);
  if (updateError) throw new Error(updateError.message);
  return { requeued: ids.length };
}

/* ------------------------------------------------------------------ */
/* 4. Dashboard data                                                   */
/* ------------------------------------------------------------------ */

export type DiscoveryCampaignProgress = {
  id: string;
  name: string;
  provider: string;
  target: number;
  tasks: number;
  completed: number;
  failed: number;
  found: number;
  saved: number;
  progress: number;
};

export type DiscoveryOverview = {
  tasks: { queued: number; running: number; completed: number; failed: number; total: number };
  candidates: number;
  hotLeads: number;
  qcPending: number;
  usageToday: { provider: string; requests: number; results: number; errors: number }[];
  campaigns: DiscoveryCampaignProgress[];
  recentTasks: DiscoveryTaskRow[];
};

export async function buildDiscoveryOverview(supabase: Client): Promise<DiscoveryOverview> {
  const today = new Date().toISOString().slice(0, 10);
  const [tasksRes, campaignsRes, usageRes, candidatesRes] = await Promise.all([
    supabase
      .from("discovery_tasks")
      .select(TASK_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("prospect_campaigns")
      .select("id, name, discovery_provider, target_candidates, status")
      .order("created_at", { ascending: false }),
    supabase.from("discovery_usage_daily").select("provider, requests, results, errors").eq("usage_date", today),
    supabase
      .from("prospect_candidates")
      .select("id, lead_temperature, qc_status, discovery_task_id")
      .not("discovery_task_id", "is", null)
      .limit(2000),
  ]);

  const tasks = ((tasksRes.data ?? []) as Record<string, unknown>[]).map(asTask);
  const counts = { queued: 0, running: 0, completed: 0, failed: 0, total: tasks.length };
  for (const task of tasks) {
    if (task.status === "queued") counts.queued += 1;
    else if (task.status === "running") counts.running += 1;
    else if (task.status === "completed") counts.completed += 1;
    else if (task.status === "failed") counts.failed += 1;
  }

  const candidateRows = (candidatesRes.data ?? []) as {
    lead_temperature: string | null;
    qc_status: string | null;
  }[];

  const campaigns = ((campaignsRes.data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const id = String(row["id"]);
      const own = tasks.filter((task) => task.campaign_id === id);
      const saved = own.reduce((sum, task) => sum + task.saved_count, 0);
      const target = Number(row["target_candidates"] ?? 0) || 0;
      return {
        id,
        name: String(row["name"] ?? ""),
        provider: String(row["discovery_provider"] ?? "mock"),
        target,
        tasks: own.length,
        completed: own.filter((task) => task.status === "completed").length,
        failed: own.filter((task) => task.status === "failed").length,
        found: own.reduce((sum, task) => sum + task.found_count, 0),
        saved,
        progress: target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0,
      };
    })
    .filter((row) => row.tasks > 0 || row.target > 0);

  return {
    tasks: counts,
    candidates: candidateRows.length,
    hotLeads: candidateRows.filter((row) => row.lead_temperature === "hot").length,
    qcPending: candidateRows.filter((row) => (row.qc_status ?? "new") === "new").length,
    usageToday: ((usageRes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      provider: String(row["provider"]),
      requests: Number(row["requests"] ?? 0),
      results: Number(row["results"] ?? 0),
      errors: Number(row["errors"] ?? 0),
    })),
    campaigns,
    recentTasks: tasks.slice(0, 25),
  };
}
