/**
 * External data verification engine — SERVER ONLY.
 *
 * Apify is the *only* writer of contact facts (phone, address, website,
 * social, business existence). AI output never lands here. When Apify fails
 * the candidate is kept and marked `enrichment_failed` — we never invent data
 * and never fall back to AI for facts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { logCandidateEvent } from "@/lib/prospecting-candidates.server";
import { contactEntry } from "@/lib/admin/prospect-candidates";
import { createProspect } from "@/lib/prospecting.server";
import {
  buildScopedSearchQuery,
  crossReferenceSocial,
  phoneGeoVerdict,
  FOREIGN_PHONE_PENALTY,
  type SocialVerdict,
} from "@/lib/admin/geofence";
import {
  apifyActorId,
  runApifyActor,
  ApifyAuthError,
  ApifyConfigError,
  type ApifyRunResult,
} from "@/lib/integrations/apify/apify.server";

type Client = SupabaseClient<Database>;
type Actor = { userId: string; email?: string | null };

export type SourceType = "google_maps" | "website" | "instagram" | "linkedin" | "facebook";

/**
 * Waterfall efficiency rule: Google Maps is the primary fact source. If its
 * confidence falls below this threshold (or the business is NOT FOUND /
 * PERMANENTLY CLOSED), enrichment stops immediately — Website and Social
 * scrapers are never triggered, saving Apify credits and runtime.
 */
export const MAPS_CONFIDENCE_THRESHOLD = 50;

export type MapsEvidence = {
  business_name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  reviews: number | null;
  place_id: string | null;
  google_maps_url: string | null;
  permanently_closed: boolean;
};

export type WebsiteEvidence = {
  website_status: number | null;
  ssl_valid: boolean;
  contact_page: string | null;
  emails_found: string[];
  company_description: string | null;
};

export type SocialEvidence = {
  profile_exists: boolean;
  followers: number | null;
  last_activity: string | null;
  profile_name: string | null;
  profile_url: string | null;
  platform: SourceType;
};

export type EnrichmentOutcome = {
  candidateId: string;
  status: "completed" | "failed";
  sources: SourceType[];
  maps: MapsEvidence | null;
  website: WebsiteEvidence | null;
  social: SocialEvidence | null;
  error?: string;
};

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* ------------------------------------------------------------------ logging */

async function startRun(
  supabase: Client,
  input: { actor: string; sourceType: SourceType; candidateId: string; payload: unknown; userId: string },
): Promise<string | null> {
  const { data } = await supabase
    .from("apify_runs")
    .insert({
      actor: input.actor,
      source_type: input.sourceType,
      candidate_id: input.candidateId,
      input: input.payload as never,
      status: "running",
      created_by: input.userId,
    } as never)
    .select("id")
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

async function finishRun(supabase: Client, id: string | null, result: ApifyRunResult): Promise<void> {
  if (!id) return;
  await supabase
    .from("apify_runs")
    .update({
      run_id: result.runId,
      dataset_id: result.datasetId,
      status: result.status,
      duration_ms: result.durationMs,
      item_count: result.items.length,
      error: result.error ?? null,
    } as never)
    .eq("id", id);
}

async function saveEnrichment(
  supabase: Client,
  input: {
    candidateId: string;
    sourceType: SourceType;
    actorName: string;
    result: ApifyRunResult;
    normalized: Record<string, unknown>;
    confidence: number;
    sourceUrl: string | null;
    userId: string;
  },
): Promise<void> {
  await supabase.from("prospect_enrichments").insert({
    prospect_candidate_id: input.candidateId,
    provider: "apify",
    actor_name: input.actorName,
    run_id: input.result.runId,
    dataset_id: input.result.datasetId,
    source_type: input.sourceType,
    source_url: input.sourceUrl,
    raw_payload: { items: input.result.items } as never,
    normalized_data: input.normalized as never,
    confidence_score: input.confidence,
    status: input.result.status === "succeeded" ? "completed" : "failed",
    error_message: input.result.error ?? null,
    created_by: input.userId,
  } as never);
}

/* --------------------------------------------------------------- normalizers */

export function normalizeMapsItem(item: Record<string, unknown>): MapsEvidence {
  return {
    business_name: str(item["title"]) ?? str(item["name"]),
    address: str(item["address"]) ?? str(item["fullAddress"]),
    phone: str(item["phone"]) ?? str(item["phoneUnformatted"]),
    website: str(item["website"]) ?? str(item["url"]),
    category: str(item["categoryName"]) ?? str(item["category"]),
    rating: num(item["totalScore"] ?? item["rating"]),
    reviews: num(item["reviewsCount"] ?? item["reviews"]),
    place_id: str(item["placeId"]) ?? str(item["place_id"]),
    google_maps_url: str(item["url"]) ?? str(item["googleMapsUrl"]),
    permanently_closed: Boolean(item["permanentlyClosed"] ?? item["temporarilyClosed"] === "CLOSED"),
  };
}

/**
 * Waterfall confidence for a Google Maps match:
 * - 90: real place_id (identity proven)
 * - 60: no place_id but contact facts (phone/address) back it up
 * - 40: bare name-only hit — below MAPS_CONFIDENCE_THRESHOLD, stops the pipeline
 */
export function mapsMatchConfidence(maps: MapsEvidence): number {
  if (maps.place_id) return 90;
  if (maps.phone || maps.address) return 60;
  return 40;
}

export function normalizeWebsiteItem(item: Record<string, unknown>, url: string): WebsiteEvidence {
  const text = str(item["text"]) ?? str(item["markdown"]) ?? "";
  const emails = new Set<string>();
  for (const match of (text ?? "").matchAll(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g)) emails.add(match[0]);
  const links = Array.isArray(item["links"]) ? (item["links"] as unknown[]).map(String) : [];
  return {
    website_status: num(item["statusCode"] ?? item["status"]) ?? 200,
    ssl_valid: url.startsWith("https://"),
    contact_page: links.find((link) => /contact|kontak|hubungi/i.test(link)) ?? null,
    emails_found: Array.from(emails).slice(0, 5),
    company_description: str(item["description"]) ?? (text ? text.slice(0, 400) : null),
  };
}

export function normalizeSocialItem(
  item: Record<string, unknown>,
  platform: SourceType,
  url: string,
): SocialEvidence {
  const name = str(item["fullName"]) ?? str(item["username"]) ?? str(item["name"]);
  return {
    profile_exists: Boolean(name || item["followersCount"] || item["followers"]),
    followers: num(item["followersCount"] ?? item["followers"]),
    last_activity: str(item["lastPostDate"]) ?? str(item["latestPost"]),
    profile_name: name,
    profile_url: url,
    platform,
  };
}

export function socialPlatform(url: string): SourceType | null {
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/linkedin\.com/i.test(url)) return "linkedin";
  if (/facebook\.com/i.test(url)) return "facebook";
  return null;
}

/* ---------------------------------------------------------------- enrichment */

export async function enrichCandidateWithApify(
  supabase: Client,
  candidateId: string,
  actor: Actor,
): Promise<EnrichmentOutcome> {
  const { data: candidate, error } = await supabase
    .from("prospect_candidates")
    .select("id, business_name, city, country, candidate_status")
    .eq("id", candidateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!candidate) throw new Error("Kandidat tidak ditemukan.");

  await supabase
    .from("prospect_candidates")
    .update({ candidate_status: "enriching" } as never)
    .eq("id", candidateId);

  const location = [candidate.city, candidate.country].filter(Boolean).join(", ");
  const mapsActor = apifyActorId("googleMaps");
  const mapsInput = {
    searchStringsArray: [candidate.business_name],
    searchTerms: [candidate.business_name],
    locationQuery: location,
    location,
    maxCrawledPlacesPerSearch: 5,
    maxResults: 5,
    language: "id",
  };

  let mapsRun: ApifyRunResult;
  const runLogId = await startRun(supabase, {
    actor: mapsActor,
    sourceType: "google_maps",
    candidateId,
    payload: mapsInput,
    userId: actor.userId,
  });

  try {
    mapsRun = await runApifyActor({ actorId: mapsActor, input: mapsInput });
  } catch (err) {
    const message =
      err instanceof ApifyAuthError
        ? "Token Apify ditolak (401/403). Perbarui APIFY_API_TOKEN."
        : err instanceof ApifyConfigError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Apify gagal";
    mapsRun = { runId: null, datasetId: null, status: "failed", items: [], durationMs: 0, error: message };
  }
  await finishRun(supabase, runLogId, mapsRun);

  const mapsItem = mapsRun.items[0];
  const maps = mapsRun.status === "succeeded" && mapsItem ? normalizeMapsItem(mapsItem) : null;

  // Waterfall gate: Google Maps is the PRIMARY fact source. Confidence comes
  // from identity strength — a real place_id is a strong match (90), a hit
  // with contact facts but no place_id is moderate (60), a bare name-only hit
  // is too weak to trust (40 → below threshold → stop), nothing found is 0.
  const mapsConfidence = maps ? mapsMatchConfidence(maps) : 0;

  await saveEnrichment(supabase, {
    candidateId,
    sourceType: "google_maps",
    actorName: mapsActor,
    result: mapsRun,
    normalized: (maps ?? {}) as Record<string, unknown>,
    confidence: mapsConfidence,
    sourceUrl: maps?.google_maps_url ?? null,
    userId: actor.userId,
  });

  // WATERFALL STOP: NOT FOUND / PERMANENTLY CLOSED / confidence below the
  // threshold → mark enrichment_failed and STOP. Website and Social scrapers
  // are never triggered for such candidates (cost efficiency).
  if (!maps || maps.permanently_closed || mapsConfidence < MAPS_CONFIDENCE_THRESHOLD) {
    const reason = maps?.permanently_closed
      ? "Google Maps menandai bisnis sudah tutup permanen."
      : !maps
        ? (mapsRun.error ?? "Google Maps tidak menemukan bisnis ini.")
        : `Confidence Google Maps ${mapsConfidence} di bawah ambang ${MAPS_CONFIDENCE_THRESHOLD}.`;
    await supabase
      .from("prospect_candidates")
      .update({ candidate_status: "enrichment_failed", rejected_reason: reason } as never)
      .eq("id", candidateId);
    await logCandidateEvent(supabase, {
      candidateId,
      event: "enrichment_failed",
      actorKind: "external",
      actorLabel: "Apify",
      dataSource: "apify:google_maps",
      reason,
    });
    return { candidateId, status: "failed", sources: [], maps: null, website: null, social: null, error: reason };
  }

  const sources: SourceType[] = ["google_maps"];

  // Website verification only runs when the business is proven to exist.
  let website: WebsiteEvidence | null = null;
  if (maps.website) {
    const websiteActor = apifyActorId("website");
    const websiteInput = { startUrls: [{ url: maps.website }], maxCrawlPages: 2 };
    const logId = await startRun(supabase, {
      actor: websiteActor,
      sourceType: "website",
      candidateId,
      payload: websiteInput,
      userId: actor.userId,
    });
    const run = await runApifyActor({ actorId: websiteActor, input: websiteInput, maxItems: 2 }).catch(
      (err: unknown): ApifyRunResult => ({
        runId: null,
        datasetId: null,
        status: "failed",
        items: [],
        durationMs: 0,
        error: err instanceof Error ? err.message : "gagal",
      }),
    );
    await finishRun(supabase, logId, run);
    const item = run.items[0];
    website = run.status === "succeeded" && item ? normalizeWebsiteItem(item, maps.website) : null;
    await saveEnrichment(supabase, {
      candidateId,
      sourceType: "website",
      actorName: websiteActor,
      result: run,
      normalized: (website ?? {}) as Record<string, unknown>,
      confidence: website ? 70 : 0,
      sourceUrl: maps.website,
      userId: actor.userId,
    });
    if (website) sources.push("website");
  }

  // RULE 2 — contact facts are stored WITH provenance, and only from external
  // sources. AI output never reaches contact_data.
  const contactData: Record<string, unknown> = {};
  const phoneEntry = contactEntry(maps.phone, "google_maps", maps.google_maps_url);
  if (phoneEntry) contactData["phone"] = phoneEntry;
  const addressEntry = contactEntry(maps.address, "google_maps", maps.google_maps_url);
  if (addressEntry) contactData["address"] = addressEntry;
  const websiteEntry = contactEntry(
    maps.website,
    website ? "website_scraper" : "google_maps",
    website ? maps.website : maps.google_maps_url,
  );
  if (websiteEntry) contactData["website"] = websiteEntry;
  const emailEntry = contactEntry(website?.emails_found?.[0] ?? null, "website_scraper", maps.website);
  if (emailEntry) contactData["email"] = emailEntry;

  await supabase
    .from("prospect_candidates")
    .update({
      candidate_status: "verified",
      rejected_reason: null,
      website: maps.website ?? null,
      contact_data: contactData as never,
    } as never)
    .eq("id", candidateId);

  await logCandidateEvent(supabase, {
    candidateId,
    event: "enriched",
    field: "business_existence",
    newValue: maps.place_id,
    actorKind: "external",
    actorLabel: "Apify",
    dataSource: "apify:google_maps",
    dataSourceUrl: maps.google_maps_url,
    reason: "Bisnis terverifikasi lewat Google Maps.",
    meta: { sources },
  });

  return { candidateId, status: "completed", sources, maps, website, social: null };
}

/** Verifies a single social profile URL (never invents one). */
export async function enrichSocialProfile(
  supabase: Client,
  candidateId: string,
  url: string,
  actor: Actor,
): Promise<SocialEvidence | null> {
  const platform = socialPlatform(url);
  if (!platform) return null;
  const socialActor = apifyActorId("social");
  const input = { directUrls: [url], usernames: [url.split("/").filter(Boolean).pop()], resultsLimit: 1 };
  const logId = await startRun(supabase, {
    actor: socialActor,
    sourceType: platform,
    candidateId,
    payload: input,
    userId: actor.userId,
  });
  const run = await runApifyActor({ actorId: socialActor, input, maxItems: 1 }).catch(
    (err: unknown): ApifyRunResult => ({
      runId: null,
      datasetId: null,
      status: "failed",
      items: [],
      durationMs: 0,
      error: err instanceof Error ? err.message : "gagal",
    }),
  );
  await finishRun(supabase, logId, run);
  const item = run.items[0];
  const social = run.status === "succeeded" && item ? normalizeSocialItem(item, platform, url) : null;
  await saveEnrichment(supabase, {
    candidateId,
    sourceType: platform,
    actorName: socialActor,
    result: run,
    normalized: (social ?? {}) as Record<string, unknown>,
    confidence: social?.profile_exists ? 60 : 0,
    sourceUrl: url,
    userId: actor.userId,
  });
  return social;
}

/* -------------------------------------------------------- evidence + promote */

export type EvidenceVerdict = {
  ok: boolean;
  trustScore: number;
  reasons: string[];
  maps: MapsEvidence | null;
  website: WebsiteEvidence | null;
};

/** Reads stored evidence only — no AI, no guessing. */
export async function validateExternalEvidence(
  supabase: Client,
  candidateId: string,
): Promise<EvidenceVerdict> {
  const { data } = await supabase
    .from("prospect_enrichments")
    .select("source_type, status, normalized_data, confidence_score, created_at")
    .eq("prospect_candidate_id", candidateId)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as {
    source_type: string;
    normalized_data: Record<string, unknown>;
    confidence_score: number;
  }[];

  const mapsRow = rows.find((row) => row.source_type === "google_maps");
  const websiteRow = rows.find((row) => row.source_type === "website");
  const socialRow = rows.find((row) =>
    ["instagram", "linkedin", "facebook"].includes(row.source_type),
  );

  const maps = (mapsRow?.normalized_data as MapsEvidence | undefined) ?? null;
  const website = (websiteRow?.normalized_data as WebsiteEvidence | undefined) ?? null;

  const reasons: string[] = [];
  let trust = 0;

  if (!maps || !maps.place_id) reasons.push("Belum ada bukti keberadaan bisnis dari Google Maps.");
  else trust += 45;
  if (maps?.permanently_closed) reasons.push("Bisnis ditandai tutup permanen.");
  if (maps?.phone) trust += 20;
  else reasons.push("Belum ada nomor telepon dari sumber eksternal.");
  if (maps?.address) trust += 10;
  if (website) trust += 15;
  if (socialRow) trust += 10;

  trust = Math.max(0, Math.min(100, trust));
  const ok = reasons.length === 0 && trust >= 65;
  if (!ok && trust < 65) reasons.push(`Trust score ${trust} di bawah ambang 65.`);

  return { ok, trustScore: trust, reasons, maps, website };
}

export type PromotionResult =
  | { status: "promoted"; prospectId: string; trustScore: number }
  | { status: "blocked"; reasons: string[]; trustScore: number };

/**
 * Promotion gate: human approval + external evidence. Facts written to the
 * prospect come from Apify only, each with a source and source URL.
 */
export async function promoteCandidateToProspect(
  supabase: Client,
  candidateId: string,
  actor: Actor,
): Promise<PromotionResult> {
  const { data: candidate } = await supabase
    .from("prospect_candidates")
    .select(
      "id, business_name, industry, city, country, candidate_status, campaign_id, why_match_icp, potential_problem_hypothesis, buying_signal_hypothesis, suggested_solution, promoted_prospect_id, duplicate_status",
    )
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidate) throw new Error("Kandidat tidak ditemukan.");
  if (candidate.promoted_prospect_id)
    return { status: "promoted", prospectId: candidate.promoted_prospect_id, trustScore: 100 };

  const verdict = await validateExternalEvidence(supabase, candidateId);
  const reasons = [...verdict.reasons];
  if (candidate.candidate_status !== "approved")
    reasons.push("Kandidat belum disetujui manusia (status harus Disetujui).");
  if (candidate.duplicate_status === "duplicate")
    reasons.push("Kandidat ditandai duplikat.");

  if (reasons.length > 0) {
    await logCandidateEvent(supabase, {
      candidateId,
      event: "promotion_blocked",
      actorKind: "system",
      actorLabel: "Promotion gate",
      reason: reasons.join("; "),
      meta: { trustScore: verdict.trustScore },
    });
    return { status: "blocked", reasons, trustScore: verdict.trustScore };
  }

  const maps = verdict.maps!;
  const created = await createProspect(
    supabase,
    {
      businessName: maps.business_name ?? candidate.business_name,
      industry: candidate.industry ?? maps.category ?? null,
      city: candidate.city ?? null,
      website: maps.website ?? null,
      contactPhone: maps.phone ?? null,
      contactWhatsapp: maps.phone ?? null,
      campaignId: candidate.campaign_id ?? null,
      source: "apify",
      sourceDetail: "Google Maps via Apify",
      researchSummary: candidate.why_match_icp ?? null,
      businessProblem: candidate.potential_problem_hypothesis ?? null,
      buyingSignal: candidate.buying_signal_hypothesis ?? null,
      recommendedSolution: candidate.suggested_solution ?? null,
      evidence: [maps.google_maps_url, maps.website].filter(Boolean) as string[],
      verified: true,
      phoneSource: maps.phone ? "google_maps" : null,
      phoneSourceUrl: maps.phone ? maps.google_maps_url : null,
      websiteSource: maps.website ? "google_maps" : null,
      websiteSourceUrl: maps.website ? maps.google_maps_url : null,
      googleMapsUrl: maps.google_maps_url,
    },
    actor,
  );

  await supabase
    .from("prospect_candidates")
    .update({
      candidate_status: "promoted",
      promoted_prospect_id: created.id,
      trust_score: verdict.trustScore,
    } as never)
    .eq("id", candidateId);

  await logCandidateEvent(supabase, {
    candidateId,
    event: "promoted",
    actorKind: "human",
    actorLabel: actor.email ?? actor.userId,
    actorId: actor.userId,
    dataSource: "apify:google_maps",
    dataSourceUrl: maps.google_maps_url,
    reason: `Dipromosikan dengan trust score ${verdict.trustScore}.`,
    meta: { prospectId: created.id, duplicate: created.status === "duplicate" },
  });

  return { status: "promoted", prospectId: created.id, trustScore: verdict.trustScore };
}
