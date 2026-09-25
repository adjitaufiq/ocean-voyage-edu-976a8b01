/**
 * Prospect Qualification Intelligence — SERVER ONLY (Prompt 4.4).
 *
 * Discovery -> business validation -> digital gap -> lead scoring -> reasoning
 * -> QC queue. Facts stay external (Google Maps / enrichment); this layer only
 * derives a deterministic verdict and stores the audit trail behind it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { QC_STATUSES, type QcStatus, type WebsiteStatus } from "@/lib/admin/discovery";
import { autoQcDecision, computeConfidence } from "@/lib/admin/qc-rules";
import {
  qualifyCandidate,
  type ContactEntryLike,
  type QualificationInput,
  type QualificationResult,
  type ValidationCheck,
} from "@/lib/admin/qualification";

type Client = SupabaseClient<Database>;

const QUALIFY_COLUMNS =
  "id, campaign_id, business_name, industry, category, address, city, province, country, latitude, longitude, phone, website, website_status, rating, review_count, place_id, google_maps_url, permanently_closed, duplicate_status, contact_data, qc_status, lead_temperature, lead_score, validation_status";

type CandidateFacts = {
  id: string;
  campaign_id: string | null;
  qc_status: string | null;
  [key: string]: unknown;
};

type CampaignTargets = { categories: string[]; cities: string[] };

function toInput(row: CandidateFacts, targets: CampaignTargets): QualificationInput {
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
    targetCategories: targets.categories,
    targetCities: targets.cities,
  };
}

async function loadCampaignTargets(
  supabase: Client,
  ids: string[],
): Promise<Map<string, CampaignTargets>> {
  const map = new Map<string, CampaignTargets>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("prospect_campaigns")
    .select("id, target_categories, areas, location")
    .in("id", ids);
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const areas = (row["areas"] as string[] | null) ?? [];
    const location = (row["location"] as string | null) ?? null;
    map.set(String(row["id"]), {
      categories: (row["target_categories"] as string[] | null) ?? [],
      cities: areas.length ? areas : location ? [location] : [],
    });
  }
  return map;
}

/** Everything the qualification layer writes back to a candidate row. */
export function qualificationPatch(result: QualificationResult): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    validation_status: result.validation.status,
    validation_reason: result.validation.reason.slice(0, 500),
    validation_checks: result.validation.checks,
    validated_at: now,
    qualified_at: now,
    lead_score: result.score,
    lead_temperature: result.temperature,
    lead_reason: result.leadReason.slice(0, 500),
    pain_signal: result.painSignal.slice(0, 500),
    digital_gap: result.digitalGap.website_gap,
    recommended_solution: result.recommendedSolution.slice(0, 300),
    sales_priority: result.salesPriority,
  };
}

export type QualificationRunResult = {
  scanned: number;
  validated: number;
  rejected: number;
  hot: number;
  /** Auto QC: approved by the rules without a human. */
  autoApproved: number;
  /** Auto QC: rejected by the rules. */
  autoRejected: number;
  /** Queued for a person because confidence was too low. */
  needReview: number;
  /** Sales material generated right after an automatic approval. */
  autoPrepared: number;
};

/**
 * Qualify candidates in bounded batches, then let the rules screen and QC them
 * so nobody reviews hundreds of rows by hand. A human decision (any qc_status
 * other than "new") is never overwritten.
 */
export async function qualifyCandidates(
  supabase: Client,
  input: { candidateId?: string; campaignId?: string; limit?: number } = {},
): Promise<QualificationRunResult> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  let query = supabase.from("prospect_candidates").select(QUALIFY_COLUMNS).limit(limit);
  if (input.candidateId) query = query.eq("id", input.candidateId);
  if (input.campaignId) query = query.eq("campaign_id", input.campaignId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as CandidateFacts[];
  const targets = await loadCampaignTargets(
    supabase,
    [...new Set(rows.map((row) => row.campaign_id).filter(Boolean))] as string[],
  );
  const fallback: CampaignTargets = { categories: [], cities: [] };

  const outcome: QualificationRunResult = {
    scanned: 0,
    validated: 0,
    rejected: 0,
    hot: 0,
    autoApproved: 0,
    autoRejected: 0,
    needReview: 0,
    autoPrepared: 0,
  };
  const history: Record<string, unknown>[] = [];
  const autoApprovedIds: string[] = [];
  const qcTraces: import("./decision-trace.server").DecisionTraceInput[] = [];

  for (const row of rows) {
    const qualificationInput = toInput(
      row,
      (row.campaign_id ? targets.get(row.campaign_id) : null) ?? fallback,
    );
    const result = qualifyCandidate(qualificationInput);
    const confidence = computeConfidence(qualificationInput);
    const decision = autoQcDecision(qualificationInput, result, confidence);
    const humanDecided = (row.qc_status ?? "new") !== "new";

    const patch: Record<string, unknown> = {
      ...qualificationPatch(result),
      confidence_score: decision.confidence,
      screening_label: decision.screeningLabel,
      auto_qc_reason: decision.reason,
    };
    if (!humanDecided && decision.qcStatus !== "new") {
      patch["qc_status"] = decision.qcStatus;
      patch["qc_reason"] = decision.reason;
      patch["qc_reviewed_at"] = new Date().toISOString();
      if (decision.qcStatus === "rejected") patch["rejected_reason"] = decision.reason;
    }

    const { error: updateError } = await supabase
      .from("prospect_candidates")
      .update(patch as never)
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);

    outcome.scanned += 1;
    if (result.validation.status === "rejected") outcome.rejected += 1;
    else outcome.validated += 1;
    if (result.temperature === "hot") outcome.hot += 1;

    if (!humanDecided) {
      if (decision.qcStatus === "approved") {
        outcome.autoApproved += 1;
        autoApprovedIds.push(row.id);
      } else if (decision.qcStatus === "rejected") outcome.autoRejected += 1;
      else outcome.needReview += 1;

      history.push({
        candidate_id: row.id,
        from_status: row["validation_status"] ?? null,
        to_status: result.validation.status,
        actor_kind: "system",
        actor_label: "qualification",
        reason: result.validation.reason.slice(0, 300),
      });
      if (decision.qcStatus !== "new") {
        history.push({
          candidate_id: row.id,
          from_status: String(row.qc_status ?? "new"),
          to_status: decision.qcStatus,
          actor_kind: "system",
          actor_label: "auto_qc",
          reason: decision.reason.slice(0, 300),
        });
      }
      qcTraces.push({
        legacyType: "prospect_candidate",
        legacyId: row.id,
        module: "auto_qc",
        decisionType: decision.qcStatus === "new" ? "qc_needs_review" : `qc_${decision.qcStatus}`,
        decision: {
          qc_status: decision.qcStatus,
          screening_label: decision.screeningLabel,
          lead_score: result.score,
          temperature: result.temperature,
          validation_status: result.validation.status,
        },
        evidence: { validation_reason: result.validation.reason, auto_qc_reason: decision.reason },
        confidence: decision.confidence,
        actorKind: "system",
      });
    }
  }

  if (history.length > 0) {
    await supabase.from("candidate_status_history").insert(history as never);
  }

  // Observability (write-only, never throws): automatic QC decisions.
  if (qcTraces.length > 0) {
    const { recordDecisionTraces } = await import("./decision-trace.server");
    await recordDecisionTraces(qcTraces);
  }

  // Auto-approved candidates get their sales material immediately, so a person
  // only meets a candidate that is already ready to verify and contact.
  if (autoApprovedIds.length > 0) {
    const { prepareSalesForCandidate } = await import("./prospecting-salesprep.server");
    for (const id of autoApprovedIds) {
      try {
        const run = await prepareSalesForCandidate(supabase, id);
        outcome.autoPrepared += run.prepared;
      } catch {
        // Preparation can be retried from the Sales preparation tab.
      }
    }
  }

  return outcome;
}

/* ------------------------------ PART 5 — QC ------------------------------ */

export type QcActionInput = {
  id: string;
  status: QcStatus;
  reason?: string | null;
};

export async function setCandidateQc(
  supabase: Client,
  input: QcActionInput,
  actor: { userId: string; email?: string | null },
): Promise<{ ok: true }> {
  if (!QC_STATUSES.includes(input.status)) throw new Error("Status QC tidak dikenal.");

  const { data: before } = await supabase
    .from("prospect_candidates")
    .select("qc_status")
    .eq("id", input.id)
    .maybeSingle();
  const from = ((before as { qc_status?: string } | null)?.qc_status ?? "new") as string;

  const patch: Record<string, unknown> = {
    qc_status: input.status,
    qc_reviewed_by: actor.userId,
    qc_reviewed_by_email: actor.email ?? null,
    qc_reviewed_at: new Date().toISOString(),
    qc_reason: input.reason?.slice(0, 500) ?? null,
  };
  if (input.status === "duplicate") {
    patch["duplicate_status"] = "duplicate";
    patch["duplicate_detected_at"] = new Date().toISOString();
    patch["duplicate_reason"] = input.reason?.slice(0, 300) ?? "Ditandai duplikat oleh QC";
  }
  if (input.status === "rejected") {
    patch["rejected_reason"] = input.reason?.slice(0, 500) ?? "Ditolak saat QC";
  }

  const { error } = await supabase
    .from("prospect_candidates")
    .update(patch as never)
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  await supabase.from("candidate_status_history").insert({
    candidate_id: input.id,
    from_status: from,
    to_status: input.status,
    actor_kind: "human",
    actor_label: actor.email ?? null,
    actor_id: actor.userId,
    reason: input.reason?.slice(0, 300) ?? `QC: ${input.status}`,
  } as never);

  const { logCandidateEvent } = await import("./prospecting-candidates.server");
  await logCandidateEvent(supabase, {
    candidateId: input.id,
    event: `qc_${input.status}`,
    field: "qc_status",
    oldValue: from,
    newValue: input.status,
    actorKind: "human",
    actorLabel: actor.email ?? null,
    actorId: actor.userId,
    dataSource: "internal",
    reason: input.reason ?? null,
  });

  return { ok: true };
}

/* --------------------- PART 6 — Hot lead dashboard ----------------------- */

export type QualifiedCandidateRow = {
  id: string;
  business_name: string;
  category: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  website: string | null;
  website_status: string | null;
  rating: number | null;
  review_count: number | null;
  google_maps_url: string | null;
  lead_score: number;
  lead_temperature: string;
  lead_reason: string | null;
  pain_signal: string | null;
  digital_gap: string | null;
  recommended_solution: string | null;
  sales_priority: string | null;
  validation_status: string;
  validation_reason: string | null;
  validation_checks: ValidationCheck[];
  qc_status: string;
  qc_reason: string | null;
  qc_reviewed_by_email: string | null;
  qc_reviewed_at: string | null;
  campaign_id: string | null;
  created_at: string;
};

export type QualificationBoard = {
  counts: {
    found: number;
    validated: number;
    rejected: number;
    qualified: number;
    hot: number;
    warm: number;
    qcNew: number;
    approved: number;
  };
  categories: string[];
  cities: string[];
  solutions: string[];
  rows: QualifiedCandidateRow[];
};

export type BoardFilter = {
  campaignId?: string;
  category?: string;
  city?: string;
  temperature?: string;
  qcStatus?: string;
  minScore?: number;
  digitalGap?: string;
  solution?: string;
  limit?: number;
};

const BOARD_COLUMNS =
  "id, business_name, category, city, province, phone, website, website_status, rating, review_count, google_maps_url, lead_score, lead_temperature, lead_reason, pain_signal, digital_gap, recommended_solution, sales_priority, validation_status, validation_reason, validation_checks, qc_status, qc_reason, qc_reviewed_by_email, qc_reviewed_at, campaign_id, created_at";

function asBoardRow(row: Record<string, unknown>): QualifiedCandidateRow {
  return {
    id: String(row["id"]),
    business_name: String(row["business_name"] ?? ""),
    category: (row["category"] as string | null) ?? null,
    city: (row["city"] as string | null) ?? null,
    province: (row["province"] as string | null) ?? null,
    phone: (row["phone"] as string | null) ?? null,
    website: (row["website"] as string | null) ?? null,
    website_status: (row["website_status"] as string | null) ?? null,
    rating: row["rating"] == null ? null : Number(row["rating"]),
    review_count: row["review_count"] == null ? null : Number(row["review_count"]),
    google_maps_url: (row["google_maps_url"] as string | null) ?? null,
    lead_score: Number(row["lead_score"] ?? 0),
    lead_temperature: String(row["lead_temperature"] ?? "cold"),
    lead_reason: (row["lead_reason"] as string | null) ?? null,
    pain_signal: (row["pain_signal"] as string | null) ?? null,
    digital_gap: (row["digital_gap"] as string | null) ?? null,
    recommended_solution: (row["recommended_solution"] as string | null) ?? null,
    sales_priority: (row["sales_priority"] as string | null) ?? null,
    validation_status: String(row["validation_status"] ?? "pending"),
    validation_reason: (row["validation_reason"] as string | null) ?? null,
    validation_checks: Array.isArray(row["validation_checks"])
      ? (row["validation_checks"] as ValidationCheck[])
      : [],
    qc_status: String(row["qc_status"] ?? "new"),
    qc_reason: (row["qc_reason"] as string | null) ?? null,
    qc_reviewed_by_email: (row["qc_reviewed_by_email"] as string | null) ?? null,
    qc_reviewed_at: (row["qc_reviewed_at"] as string | null) ?? null,
    campaign_id: (row["campaign_id"] as string | null) ?? null,
    created_at: String(row["created_at"] ?? new Date().toISOString()),
  };
}

/** Feeds both the QC review tab and the hot lead dashboard. */
export async function buildQualificationBoard(
  supabase: Client,
  filter: BoardFilter = {},
): Promise<QualificationBoard> {
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 500);
  let query = supabase
    .from("prospect_candidates")
    .select(BOARD_COLUMNS)
    .order("lead_score", { ascending: false })
    .limit(limit);

  if (filter.campaignId) query = query.eq("campaign_id", filter.campaignId);
  if (filter.qcStatus && filter.qcStatus !== "all") query = query.eq("qc_status", filter.qcStatus);
  if (filter.temperature && filter.temperature !== "all")
    query = query.eq("lead_temperature", filter.temperature);
  if (filter.category && filter.category !== "all") query = query.eq("category", filter.category);
  if (filter.city && filter.city !== "all") query = query.eq("city", filter.city);
  if (filter.minScore) query = query.gte("lead_score", filter.minScore);
  if (filter.digitalGap && filter.digitalGap !== "all")
    query = query.eq("digital_gap", filter.digitalGap);
  if (filter.solution && filter.solution !== "all")
    query = query.eq("recommended_solution", filter.solution);

  const [listRes, allRes] = await Promise.all([
    query,
    supabase
      .from("prospect_candidates")
      .select("category, city, recommended_solution, lead_temperature, validation_status, qc_status")
      .limit(2000),
  ]);
  if (listRes.error) throw new Error(listRes.error.message);

  const rows = ((listRes.data ?? []) as Record<string, unknown>[]).map(asBoardRow);
  const all = (allRes.data ?? []) as Record<string, unknown>[];

  const counts = {
    found: all.length,
    validated: all.filter((row) => row["validation_status"] === "validated").length,
    rejected: all.filter((row) => row["validation_status"] === "rejected").length,
    qualified: all.filter(
      (row) => row["validation_status"] === "validated" && row["lead_temperature"] !== "cold",
    ).length,
    hot: all.filter((row) => row["lead_temperature"] === "hot").length,
    warm: all.filter((row) => row["lead_temperature"] === "warm").length,
    qcNew: all.filter((row) => (row["qc_status"] ?? "new") === "new").length,
    approved: all.filter((row) => row["qc_status"] === "approved").length,
  };

  const uniq = (key: string) =>
    [...new Set(all.map((row) => (row[key] as string | null) ?? "").filter(Boolean))]
      .sort()
      .slice(0, 100);

  return {
    counts,
    categories: uniq("category"),
    cities: uniq("city"),
    solutions: uniq("recommended_solution"),
    rows,
  };
}
