/**
 * Sales Preparation Intelligence — SERVER ONLY (Prompt 4.5).
 *
 * Qualified hot lead -> business brief + approach + outreach draft + asset,
 * stored as a versioned sales_preparations row. Nothing is ever sent from
 * here: a human still approves the draft before any outreach happens.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ContactEntryLike, QualificationInput } from "@/lib/admin/qualification";
import type { WebsiteStatus } from "@/lib/admin/discovery";
import { buildEvidence, type EvidenceItem } from "@/lib/admin/evidence";
import {
  CONTACT_STAGES,
  checklistComplete,
  normalizeChecklist,
  VERIFICATION_ITEMS,
  type ContactStage,
  type VerificationChecklist,
  type VerificationItem,
} from "@/lib/admin/verification";
import {
  prepareSales,
  readyOutreachBlockers,
  salesAssetByKey,
  salesPrepBlockers,
  SALES_PREP_BLOCKER_LABELS,
  SALES_STAGES,
  type SalesPrepBlocker,
  type SalesStage,
} from "@/lib/admin/sales-prep";

type Client = SupabaseClient<Database>;
type Actor = { userId: string; email?: string | null };

const PREP_COLUMNS =
  "id, campaign_id, business_name, industry, category, address, city, province, country, latitude, longitude, phone, website, website_status, rating, review_count, place_id, google_maps_url, permanently_closed, duplicate_status, promoted_prospect_id, contact_data, lead_score, lead_temperature, validation_status, sales_stage, qc_status";


function toInput(row: Record<string, unknown>): QualificationInput {
  return {
    businessName: String(row["business_name"] ?? ""),
    category: (row["category"] as string | null) ?? null,
    industry: (row["industry"] as string | null) ?? null,
    address: (row["address"] as string | null) ?? null,
    city: (row["city"] as string | null) ?? null,
    province: (row["province"] as string | null) ?? null,
    country: (row["country"] as string | null) ?? null,
    latitude: row["latitude"] == null ? null : Number(row["latitude"]),
    longitude: row["longitude"] == null ? null : Number(row["longitude"]),
    phone: (row["phone"] as string | null) ?? null,
    website: (row["website"] as string | null) ?? null,
    websiteStatus: ((row["website_status"] as WebsiteStatus | null) ?? "unknown") as WebsiteStatus,
    rating: row["rating"] == null ? null : Number(row["rating"]),
    reviewCount: row["review_count"] == null ? null : Number(row["review_count"]),
    placeId: (row["place_id"] as string | null) ?? null,
    googleMapsUrl: (row["google_maps_url"] as string | null) ?? null,
    permanentlyClosed: Boolean(row["permanently_closed"]),
    duplicateStatus: (row["duplicate_status"] as string | null) ?? null,
    contactData: (row["contact_data"] as Record<string, ContactEntryLike> | null) ?? {},
    targetCategories: [],
    targetCities: [],
  };
}

export type SalesPrepRunResult = {
  scanned: number;
  prepared: number;
  skipped: number;
  failed: number;
  /** Reason label -> how many candidates were skipped for it. */
  skippedReasons: Record<string, number>;
  errors: string[];
  /** Batch cursor: offset for the next chunk, or null when finished. */
  nextOffset: number | null;
  /** Total QC-approved candidates in scope (batch mode only). */
  total: number | null;
};

function emptyRun(): SalesPrepRunResult {
  return {
    scanned: 0,
    prepared: 0,
    skipped: 0,
    failed: 0,
    skippedReasons: {},
    errors: [],
    nextOffset: null,
    total: null,
  };
}

function noteSkip(outcome: SalesPrepRunResult, blockers: SalesPrepBlocker[]) {
  outcome.skipped += 1;
  for (const blocker of blockers) {
    const label = SALES_PREP_BLOCKER_LABELS[blocker];
    outcome.skippedReasons[label] = (outcome.skippedReasons[label] ?? 0) + 1;
  }
}

async function hasActivePreparation(supabase: Client, candidateId: string): Promise<boolean> {
  const { data } = await supabase
    .from("sales_preparations")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("is_active", true)
    .maybeSingle();
  return Boolean(data);
}

/** Generate + store one candidate's material. Throws on any database failure. */
async function writePreparation(supabase: Client, row: Record<string, unknown>): Promise<void> {
  const id = String(row["id"]);
  const input = toInput(row);
  const prep = prepareSales(input);

  const { error: deactivateError } = await supabase
    .from("sales_preparations")
    .update({ is_active: false } as never)
    .eq("candidate_id", id)
    .eq("is_active", true);
  if (deactivateError) throw new Error(deactivateError.message);

  const { error: insertError } = await supabase.from("sales_preparations").insert({
    candidate_id: id,
    campaign_id: (row["campaign_id"] as string | null) ?? null,
    business_brief: prep.brief,
    approach_category: prep.approach.category,
    approach_reason: prep.approach.reason,
    recommended_solution: prep.approach.recommendation,
    outreach_message: prep.outreach,
    selected_asset: prep.asset,
    // Every claim shown to a sales agent carries its source and confidence.
    evidence: buildEvidence(input),
    generated_by: "rules",
    is_active: true,
  } as never);
  if (insertError) throw new Error(insertError.message);

  const stage = String(row["sales_stage"] ?? "qualified");
  if (stage !== "ready_outreach") {
    const { error: stageError } = await supabase
      .from("prospect_candidates")
      .update({
        sales_stage: "sales_prepared",
        sales_prepared_at: new Date().toISOString(),
      } as never)
      .eq("id", id);
    if (stageError) throw new Error(stageError.message);

    if (stage !== "sales_prepared") {
      await supabase.from("candidate_status_history").insert({
        candidate_id: id,
        from_status: stage,
        to_status: "sales_prepared",
        actor_kind: "system",
        actor_label: "sales_preparation",
        reason: prep.approach.recommendation.slice(0, 300),
      } as never);
    }
  }
}

/**
 * Manual mode: prepare (or regenerate) material for a single candidate.
 * Regenerating deactivates the previous version but keeps it as history.
 */
export async function prepareSalesForCandidate(
  supabase: Client,
  candidateId: string,
): Promise<SalesPrepRunResult> {
  const outcome = emptyRun();
  const { data, error } = await supabase
    .from("prospect_candidates")
    .select(PREP_COLUMNS)
    .eq("id", candidateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kandidat tidak ditemukan.");

  const row = data as unknown as Record<string, unknown>;
  outcome.scanned = 1;

  const blockers = salesPrepBlockers({
    qcStatus: String(row["qc_status"] ?? "new"),
    duplicateStatus: (row["duplicate_status"] as string | null) ?? null,
    promotedProspectId: (row["promoted_prospect_id"] as string | null) ?? null,
    // Manual regeneration is allowed on purpose (quality control).
    hasActivePreparation: false,
    contactData:
      (row["contact_data"] as Record<string, { value?: string | null; source?: string | null }>) ??
      {},
  });
  if (blockers.length > 0) {
    noteSkip(outcome, blockers);
    return outcome;
  }

  try {
    await writePreparation(supabase, row);
    outcome.prepared = 1;
  } catch (err) {
    outcome.failed = 1;
    outcome.errors.push(err instanceof Error ? err.message : "Gagal menyimpan materi.");
  }
  return outcome;
}

/**
 * Batch mode: one bounded chunk of QC-approved candidates per call, so a
 * campaign with thousands of candidates never becomes one blocking request.
 */
export async function prepareSalesForCandidates(
  supabase: Client,
  input: { campaignId?: string; limit?: number; offset?: number } = {},
): Promise<SalesPrepRunResult> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const outcome = emptyRun();

  let query = supabase
    .from("prospect_candidates")
    .select(PREP_COLUMNS, { count: "exact" })
    .eq("qc_status", "approved")
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (input.campaignId) query = query.eq("campaign_id", input.campaignId);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  outcome.total = count ?? null;
  outcome.nextOffset = rows.length === limit ? offset + rows.length : null;

  const ids = rows.map((row) => String(row["id"]));
  const prepared = new Set<string>();
  if (ids.length > 0) {
    const { data: existing } = await supabase
      .from("sales_preparations")
      .select("candidate_id")
      .in("candidate_id", ids)
      .eq("is_active", true);
    for (const item of (existing ?? []) as Record<string, unknown>[]) {
      prepared.add(String(item["candidate_id"]));
    }
  }

  for (const row of rows) {
    outcome.scanned += 1;
    const id = String(row["id"]);
    const blockers = salesPrepBlockers({
      qcStatus: String(row["qc_status"] ?? "new"),
      duplicateStatus: (row["duplicate_status"] as string | null) ?? null,
      promotedProspectId: (row["promoted_prospect_id"] as string | null) ?? null,
      hasActivePreparation: prepared.has(id),
      contactData:
        (row["contact_data"] as Record<
          string,
          { value?: string | null; source?: string | null }
        >) ?? {},
    });
    if (blockers.length > 0) {
      noteSkip(outcome, blockers);
      continue;
    }

    try {
      await writePreparation(supabase, row);
      outcome.prepared += 1;
    } catch (err) {
      outcome.failed += 1;
      const message = err instanceof Error ? err.message : "Gagal menyimpan materi.";
      if (outcome.errors.length < 5)
        outcome.errors.push(`${String(row["business_name"] ?? id)}: ${message}`);
    }
  }

  return outcome;
}


/** Human-driven stage change. Ready Outreach requires a reachable contact. */
export async function setSalesStage(
  supabase: Client,
  input: { id: string; stage: SalesStage },
  actor: Actor,
): Promise<{ ok: true } | { ok: false; blockers: string[] }> {
  if (!SALES_STAGES.includes(input.stage)) throw new Error("Tahap penjualan tidak dikenal.");

  const { data } = await supabase
    .from("prospect_candidates")
    .select("sales_stage, validation_status, qc_status, contact_data")
    .eq("id", input.id)
    .maybeSingle();
  if (!data) throw new Error("Kandidat tidak ditemukan.");

  const row = data as Record<string, unknown>;
  const from = String(row["sales_stage"] ?? "qualified");

  if (input.stage === "ready_outreach") {
    const blockers = readyOutreachBlockers({
      validationStatus: (row["validation_status"] as string | null) ?? null,
      qcStatus: String(row["qc_status"] ?? "new"),
      hasPreparation: await hasActivePreparation(supabase, input.id),
      contactData:
        (row["contact_data"] as Record<string, { value?: string | null; source?: string | null }>) ??
        {},
    });
    if (blockers.length > 0) return { ok: false, blockers };
  }



  const { error } = await supabase
    .from("prospect_candidates")
    .update({ sales_stage: input.stage } as never)
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await supabase.from("candidate_status_history").insert({
    candidate_id: input.id,
    from_status: from,
    to_status: input.stage,
    actor_kind: "human",
    actor_label: actor.email ?? null,
    actor_id: actor.userId,
    reason: `Tahap penjualan: ${input.stage}`,
  } as never);

  return { ok: true };
}

export type SalesPrepRow = {
  id: string;
  candidate_id: string;
  business_name: string;
  category: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  lead_score: number;
  lead_temperature: string;
  sales_stage: string;
  validation_status: string;
  approach_category: string;
  approach_reason: string | null;
  recommended_solution: string | null;
  business_brief: Record<string, string>;
  outreach_message: Record<string, string>;
  selected_asset: { key?: string; label?: string; url?: string; note?: string };
  ready_blockers: string[];
  evidence: EvidenceItem[];
  verification_checklist: VerificationChecklist;
  verified: boolean;
  verified_ready_at: string | null;
  contact_stage: string | null;
  google_maps_url: string | null;
  created_at: string;
};

export type SalesPrepPendingRow = {
  candidate_id: string;
  business_name: string;
  category: string | null;
  city: string | null;
  lead_score: number;
  lead_temperature: string;
  blockers: string[];
  eligible: boolean;
};

export type SalesPrepBoard = {
  counts: {
    awaitingQc: number;
    qualified: number;
    prepared: number;
    ready: number;
    ineligible: number;
    eligible: number;
    /** Ready Outreach rows whose human checklist is complete. */
    verified: number;
    /** Ready Outreach rows still waiting for the human checklist. */
    pendingVerification: number;
  };
  rows: SalesPrepRow[];
  pending: SalesPrepPendingRow[];
};

const BOARD_SCAN_LIMIT = 1000;

/**
 * Feeds the Sales preparation tab. Counts and lists come from the same scan,
 * so the numbers can never disagree with the cards.
 */
export async function buildSalesPrepBoard(
  supabase: Client,
  filter: { campaignId?: string; stage?: string; limit?: number } = {},
): Promise<SalesPrepBoard> {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 300);

  // QC approval is the gate: only approved candidates belong on this board.
  let candidates = supabase
    .from("prospect_candidates")
    .select(
      "id, campaign_id, business_name, category, city, phone, website, google_maps_url, lead_score, lead_temperature, sales_stage, validation_status, qc_status, duplicate_status, promoted_prospect_id, contact_data, verification_checklist, verified_ready_at, contact_stage",
    )
    .eq("qc_status", "approved")
    .order("lead_score", { ascending: false })
    .limit(BOARD_SCAN_LIMIT);
  if (filter.campaignId) candidates = candidates.eq("campaign_id", filter.campaignId);

  let awaiting = supabase
    .from("prospect_candidates")
    .select("id", { count: "exact", head: true })
    .in("qc_status", ["new", "reviewed"]);
  if (filter.campaignId) awaiting = awaiting.eq("campaign_id", filter.campaignId);

  const [{ data: candidateData, error }, { count: awaitingCount }] = await Promise.all([
    candidates,
    awaiting,
  ]);
  if (error) throw new Error(error.message);
  const rows = (candidateData ?? []) as unknown as Record<string, unknown>[];

  const ids = rows.map((row) => String(row["id"]));
  const prepByCandidate = new Map<string, Record<string, unknown>>();
  if (ids.length > 0) {
    const { data: preps, error: prepError } = await supabase
      .from("sales_preparations")
      .select(
        "id, candidate_id, business_brief, approach_category, approach_reason, recommended_solution, outreach_message, selected_asset, evidence, created_at",
      )
      .in("candidate_id", ids)
      .eq("is_active", true);
    if (prepError) throw new Error(prepError.message);
    for (const prep of (preps ?? []) as Record<string, unknown>[]) {
      prepByCandidate.set(String(prep["candidate_id"]), prep);
    }
  }

  const counts = {
    awaitingQc: awaitingCount ?? 0,
    qualified: 0,
    prepared: 0,
    ready: 0,
    ineligible: 0,
    eligible: 0,
    verified: 0,
    pendingVerification: 0,
  };
  const board: SalesPrepRow[] = [];
  const pending: SalesPrepPendingRow[] = [];

  for (const row of rows) {
    const id = String(row["id"]);
    const stage = String(row["sales_stage"] ?? "qualified");
    const prep = prepByCandidate.get(id);
    const contactData =
      (row["contact_data"] as Record<string, { value?: string | null; source?: string | null }>) ??
      {};

    if (!prep) {
      const blockers = salesPrepBlockers({
        qcStatus: String(row["qc_status"] ?? "new"),
        duplicateStatus: (row["duplicate_status"] as string | null) ?? null,
        promotedProspectId: (row["promoted_prospect_id"] as string | null) ?? null,
        hasActivePreparation: false,
        contactData,
      });
      if (blockers.length === 0) {
        counts.qualified += 1;
        counts.eligible += 1;
      } else {
        counts.ineligible += 1;
      }
      if (pending.length < limit) {
        pending.push({
          candidate_id: id,
          business_name: String(row["business_name"] ?? ""),
          category: (row["category"] as string | null) ?? null,
          city: (row["city"] as string | null) ?? null,
          lead_score: Number(row["lead_score"] ?? 0),
          lead_temperature: String(row["lead_temperature"] ?? "cold"),
          blockers: blockers.map((item) => SALES_PREP_BLOCKER_LABELS[item]),
          eligible: blockers.length === 0,
        });
      }
      continue;
    }

    if (stage === "ready_outreach") counts.ready += 1;
    else counts.prepared += 1;

    if (filter.stage && filter.stage !== "all" && stage !== filter.stage) continue;
    if (board.length >= limit) continue;

    board.push({
      id: String(prep["id"]),
      candidate_id: id,
      business_name: String(row["business_name"] ?? ""),
      category: (row["category"] as string | null) ?? null,
      city: (row["city"] as string | null) ?? null,
      phone: (row["phone"] as string | null) ?? null,
      website: (row["website"] as string | null) ?? null,
      lead_score: Number(row["lead_score"] ?? 0),
      lead_temperature: String(row["lead_temperature"] ?? "cold"),
      sales_stage: stage,
      validation_status: String(row["validation_status"] ?? "pending"),
      approach_category: String(prep["approach_category"] ?? "website_opportunity"),
      approach_reason: (prep["approach_reason"] as string | null) ?? null,
      recommended_solution: (prep["recommended_solution"] as string | null) ?? null,
      business_brief: (prep["business_brief"] as Record<string, string>) ?? {},
      outreach_message: (prep["outreach_message"] as Record<string, string>) ?? {},
      selected_asset: (prep["selected_asset"] as SalesPrepRow["selected_asset"]) ?? {},
      ready_blockers: readyOutreachBlockers({
        validationStatus: (row["validation_status"] as string | null) ?? null,
        qcStatus: String(row["qc_status"] ?? "new"),
        hasPreparation: true,
        contactData,
      }),
      evidence: Array.isArray(prep["evidence"]) ? (prep["evidence"] as EvidenceItem[]) : [],
      verification_checklist: normalizeChecklist(row["verification_checklist"]),
      verified: checklistComplete(row["verification_checklist"]),
      verified_ready_at: (row["verified_ready_at"] as string | null) ?? null,
      contact_stage: (row["contact_stage"] as string | null) ?? null,
      google_maps_url: (row["google_maps_url"] as string | null) ?? null,
      created_at: String(prep["created_at"] ?? new Date().toISOString()),
    });
  }

  return { counts, rows: board, pending };
}


/**
 * CRM handoff: when a candidate becomes a prospect, its active preparation
 * follows along so the sales agent keeps brief, solution, asset and draft.
 */
export async function attachPreparationToProspect(
  supabase: Client,
  candidateId: string,
  prospectId: string,
): Promise<void> {
  const { data } = await supabase
    .from("sales_preparations")
    .select("id, business_brief, recommended_solution, outreach_message, selected_asset")
    .eq("candidate_id", candidateId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return;

  const prep = data as Record<string, unknown>;
  await supabase
    .from("sales_preparations")
    .update({ prospect_id: prospectId } as never)
    .eq("id", String(prep["id"]));

  const brief = (prep["business_brief"] as Record<string, string>) ?? {};
  const outreach = (prep["outreach_message"] as Record<string, string>) ?? {};
  const asset = (prep["selected_asset"] as { key?: string; label?: string; url?: string }) ?? {};
  const assetLabel = asset.key ? (salesAssetByKey(asset.key)?.label ?? asset.label) : asset.label;

  const note = [
    brief["business_summary"],
    brief["opportunity"],
    prep["recommended_solution"] ? `Solusi: ${String(prep["recommended_solution"])}` : null,
    assetLabel ? `Aset: ${assetLabel}${asset.url ? ` (${asset.url})` : ""}` : null,
    outreach["opening_message"] ? `Draf pembuka: ${outreach["opening_message"]}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (!note) return;
  await supabase.from("prospect_activities").insert({
    prospect_id: prospectId,
    action: "sales_preparation",
    label: "Materi persiapan penjualan",
    content: note.slice(0, 2000),
  } as never);
}
