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

export type SalesPrepRunResult = { scanned: number; prepared: number; skipped: number };

/**
 * Prepare sales material for qualified candidates in bounded batches.
 * Older preparations stay in the table; only the newest one is active.
 */
export async function prepareSalesForCandidates(
  supabase: Client,
  input: { candidateId?: string; campaignId?: string; limit?: number } = {},
): Promise<SalesPrepRunResult> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  let query = supabase.from("prospect_candidates").select(PREP_COLUMNS).limit(limit);
  if (input.candidateId) query = query.eq("id", input.candidateId);
  if (input.campaignId) query = query.eq("campaign_id", input.campaignId);
  if (!input.candidateId) query = query.eq("validation_status", "validated");

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const outcome: SalesPrepRunResult = { scanned: 0, prepared: 0, skipped: 0 };

  for (const row of rows) {
    outcome.scanned += 1;
    const id = String(row["id"]);
    // Stage gate: sales material is only built for QC-approved candidates.
    const qc = String(row["qc_status"] ?? "new");
    if (qc !== "approved" || row["duplicate_status"] === "duplicate") {
      outcome.skipped += 1;
      continue;
    }


    const prep = prepareSales(toInput(row));

    await supabase
      .from("sales_preparations")
      .update({ is_active: false } as never)
      .eq("candidate_id", id)
      .eq("is_active", true);

    const { error: insertError } = await supabase.from("sales_preparations").insert({
      candidate_id: id,
      campaign_id: (row["campaign_id"] as string | null) ?? null,
      business_brief: prep.brief,
      approach_category: prep.approach.category,
      approach_reason: prep.approach.reason,
      recommended_solution: prep.approach.recommendation,
      outreach_message: prep.outreach,
      selected_asset: prep.asset,
      generated_by: "rules",
      is_active: true,
    } as never);
    if (insertError) throw new Error(insertError.message);

    const stage = String(row["sales_stage"] ?? "qualified");
    if (stage === "qualified") {
      await supabase
        .from("prospect_candidates")
        .update({ sales_stage: "sales_prepared", sales_prepared_at: new Date().toISOString() } as never)
        .eq("id", id);
      await supabase.from("candidate_status_history").insert({
        candidate_id: id,
        from_status: stage,
        to_status: "sales_prepared",
        actor_kind: "system",
        actor_label: "sales_preparation",
        reason: prep.approach.recommendation.slice(0, 300),
      } as never);
    }
    outcome.prepared += 1;
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
    const { data: prep } = await supabase
      .from("sales_preparations")
      .select("id")
      .eq("candidate_id", input.id)
      .eq("is_active", true)
      .maybeSingle();
    const blockers = readyOutreachBlockers({
      validationStatus: (row["validation_status"] as string | null) ?? null,
      qcStatus: String(row["qc_status"] ?? "new"),
      hasPreparation: Boolean(prep),
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
  created_at: string;
};

export type SalesPrepBoard = {
  counts: { qualified: number; prepared: number; ready: number };
  rows: SalesPrepRow[];
};

/** Feeds the Sales preparation tab. */
export async function buildSalesPrepBoard(
  supabase: Client,
  filter: { campaignId?: string; stage?: string; limit?: number } = {},
): Promise<SalesPrepBoard> {
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 300);

  let candidates = supabase
    .from("prospect_candidates")
    .select(
      "id, campaign_id, business_name, category, city, phone, website, lead_score, lead_temperature, sales_stage, validation_status, qc_status, contact_data",
    )
    .order("lead_score", { ascending: false })
    .limit(limit);
  if (filter.campaignId) candidates = candidates.eq("campaign_id", filter.campaignId);
  if (filter.stage && filter.stage !== "all") candidates = candidates.eq("sales_stage", filter.stage);

  const { data: candidateData, error } = await candidates;
  if (error) throw new Error(error.message);
  const rows = (candidateData ?? []) as unknown as Record<string, unknown>[];

  const ids = rows.map((row) => String(row["id"]));
  const prepByCandidate = new Map<string, Record<string, unknown>>();
  if (ids.length > 0) {
    const { data: preps } = await supabase
      .from("sales_preparations")
      .select(
        "id, candidate_id, business_brief, approach_category, approach_reason, recommended_solution, outreach_message, selected_asset, created_at",
      )
      .in("candidate_id", ids)
      .eq("is_active", true);
    for (const prep of (preps ?? []) as Record<string, unknown>[]) {
      prepByCandidate.set(String(prep["candidate_id"]), prep);
    }
  }

  const counts = { qualified: 0, prepared: 0, ready: 0 };
  const board: SalesPrepRow[] = [];

  for (const row of rows) {
    const stage = String(row["sales_stage"] ?? "qualified");
    if (stage === "ready_outreach") counts.ready += 1;
    else if (stage === "sales_prepared") counts.prepared += 1;
    else counts.qualified += 1;

    const prep = prepByCandidate.get(String(row["id"]));
    if (!prep) continue;

    board.push({
      id: String(prep["id"]),
      candidate_id: String(row["id"]),
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
        contactData:
          (row["contact_data"] as Record<
            string,
            { value?: string | null; source?: string | null }
          >) ?? {},
      }),
      created_at: String(prep["created_at"] ?? new Date().toISOString()),
    });
  }

  return { counts, rows: board };
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
