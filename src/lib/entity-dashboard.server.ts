/**
 * Unified business dashboard — SERVER ONLY (Phase 5).
 *
 * Every number comes from one business entity row (view
 * business_entity_overview), so a business found on Google Maps, discovered
 * again by AI, and later promoted to CRM counts once. Legacy tables are read
 * by reference through business_entity_links; nothing is copied or moved.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export const FUNNEL_STAGES = [
  "found",
  "enriched",
  "verified",
  "qualified",
  "analyzed",
  "sales_prepared",
  "ready_outreach",
  "contacted",
  "meeting",
  "deal",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  found: "Ditemukan",
  enriched: "Data diperkaya",
  verified: "Terverifikasi",
  qualified: "Sesuai target",
  analyzed: "Dianalisis konsultan",
  sales_prepared: "Materi penjualan siap",
  ready_outreach: "Siap dihubungi",
  contacted: "Sudah dihubungi",
  meeting: "Meeting",
  deal: "Deal",
};

const STAGE_COLUMN: Record<FunnelStage, string> = {
  found: "stage_found",
  enriched: "stage_enriched",
  verified: "stage_verified",
  qualified: "stage_qualified",
  analyzed: "stage_analyzed",
  sales_prepared: "stage_sales_prepared",
  ready_outreach: "stage_ready_outreach",
  contacted: "stage_contacted",
  meeting: "stage_meeting",
  deal: "stage_deal",
};

export type EntityFilter = {
  search?: string;
  industry?: string;
  stage?: FunnelStage;
  source?: "prospect_candidate" | "prospect" | "consultation" | "ai_conversation";
  analysis?: "with" | "without";
  sales?: "prepared" | "not_prepared" | "ready";
  contact?: "contacted" | "not_contacted";
  duplicatesOnly?: boolean;
};

type Query = ReturnType<Client["from"]>;

function applyFilter(query: any, filter: EntityFilter) {
  const term = filter.search?.trim();
  if (term) {
    const safe = term.replace(/[%,()]/g, " ").trim();
    query = query.or(
      [
        `canonical_name.ilike.%${safe}%`,
        `website_domain.ilike.%${safe}%`,
        `phone.ilike.%${safe}%`,
        `whatsapp.ilike.%${safe}%`,
        `city.ilike.%${safe}%`,
        `industry.ilike.%${safe}%`,
        `discovery_sources.ilike.%${safe}%`,
      ].join(","),
    );
  }
  if (filter.industry) query = query.ilike("industry", `%${filter.industry}%`);
  if (filter.stage) query = query.eq(STAGE_COLUMN[filter.stage], true);
  if (filter.source === "prospect_candidate") query = query.gt("candidate_links", 0);
  if (filter.source === "prospect") query = query.gt("prospect_links", 0);
  if (filter.source === "consultation") query = query.gt("consultation_links", 0);
  if (filter.source === "ai_conversation") query = query.gt("conversation_links", 0);
  if (filter.analysis === "with") query = query.eq("stage_analyzed", true);
  if (filter.analysis === "without") query = query.eq("stage_analyzed", false);
  if (filter.sales === "prepared") query = query.gt("active_preparations", 0);
  if (filter.sales === "not_prepared") query = query.eq("active_preparations", 0);
  if (filter.sales === "ready") query = query.eq("stage_ready_outreach", true);
  if (filter.contact === "contacted") query = query.eq("stage_contacted", true);
  if (filter.contact === "not_contacted") query = query.eq("stage_contacted", false);
  if (filter.duplicatesOnly) query = query.gt("pending_reviews", 0);
  return query;
}

export type EntityListRow = {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  sources: number;
  candidateLinks: number;
  prospectLinks: number;
  consultationLinks: number;
  conversationLinks: number;
  discoverySources: string | null;
  leadScore: number | null;
  stage: FunnelStage;
  analyzed: boolean;
  activePreparations: number;
  contactStage: string | null;
  prospectStatus: string | null;
  duplicateWarning: boolean;
};

function currentStage(row: Record<string, unknown>): FunnelStage {
  const order: FunnelStage[] = [...FUNNEL_STAGES].reverse();
  for (const stage of order) {
    if (row[STAGE_COLUMN[stage]] === true) return stage;
  }
  return "found";
}

function toRow(row: Record<string, unknown>): EntityListRow {
  return {
    id: String(row["id"]),
    name: String(row["canonical_name"] ?? ""),
    industry: (row["industry"] as string | null) ?? null,
    city: (row["city"] as string | null) ?? null,
    website: (row["website"] as string | null) ?? null,
    phone: ((row["phone"] as string | null) ?? (row["whatsapp"] as string | null)) ?? null,
    sources: Number(row["source_count"] ?? 0),
    candidateLinks: Number(row["candidate_links"] ?? 0),
    prospectLinks: Number(row["prospect_links"] ?? 0),
    consultationLinks: Number(row["consultation_links"] ?? 0),
    conversationLinks: Number(row["conversation_links"] ?? 0),
    discoverySources: (row["discovery_sources"] as string | null) ?? null,
    leadScore: row["lead_score"] == null ? null : Number(row["lead_score"]),
    stage: currentStage(row),
    analyzed: row["stage_analyzed"] === true,
    activePreparations: Number(row["active_preparations"] ?? 0),
    contactStage: (row["contact_stage"] as string | null) ?? null,
    prospectStatus: (row["prospect_status"] as string | null) ?? null,
    duplicateWarning:
      Number(row["pending_reviews"] ?? 0) > 0 || row["duplicate_flag"] === true,
  };
}

/** Funnel counts: one aggregate request per stage, never a per-row query. */
export async function buildEntityFunnel(
  supabase: Client,
  filter: EntityFilter = {},
): Promise<{ total: number; stages: { stage: FunnelStage; label: string; count: number }[] }> {
  const totalQuery = applyFilter(
    supabase.from("business_entity_overview").select("id", { count: "exact", head: true }),
    filter,
  );
  const stageQueries = FUNNEL_STAGES.map((stage) =>
    applyFilter(
      supabase
        .from("business_entity_overview")
        .select("id", { count: "exact", head: true })
        .eq(STAGE_COLUMN[stage], true),
      { ...filter, stage: undefined },
    ),
  );

  const [total, ...results] = await Promise.all([totalQuery, ...stageQueries]);
  if (total.error) throw new Error(total.error.message);

  return {
    total: total.count ?? 0,
    stages: FUNNEL_STAGES.map((stage, index) => ({
      stage,
      label: FUNNEL_LABELS[stage],
      count: results[index]?.count ?? 0,
    })),
  };
}

/** Paginated list; only summary columns are read, never enrichment JSON. */
export async function listEntities(
  supabase: Client,
  filter: EntityFilter & { page?: number; pageSize?: number } = {},
): Promise<{ rows: EntityListRow[]; total: number; page: number; pageSize: number }> {
  const pageSize = Math.min(Math.max(filter.pageSize ?? 25, 5), 100);
  const page = Math.max(filter.page ?? 1, 1);
  const from = (page - 1) * pageSize;

  const query = applyFilter(
    supabase
      .from("business_entity_overview")
      .select(
        "id, canonical_name, industry, city, website, phone, whatsapp, source_count, candidate_links, prospect_links, consultation_links, conversation_links, discovery_sources, lead_score, contact_stage, prospect_status, active_preparations, pending_reviews, duplicate_flag, stage_found, stage_enriched, stage_verified, stage_qualified, stage_analyzed, stage_sales_prepared, stage_ready_outreach, stage_contacted, stage_meeting, stage_deal",
        { count: "exact" },
      )
      .order("lead_score", { ascending: false, nullsFirst: false })
      .order("canonical_name", { ascending: true })
      .range(from, from + pageSize - 1),
    filter,
  );

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    rows: ((data ?? []) as Record<string, unknown>[]).map(toRow),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/* ------------------------------ detail page ------------------------------- */

export type EntityDetail = {
  profile: {
    id: string;
    name: string;
    industry: string | null;
    location: string | null;
    website: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    stage: FunnelStage;
    googleMapsUrl: string | null;
  };
  sources: { type: string; id: string; label: string; detail: string | null }[];
  evidence: { field: string; data: string; source: string; sourceUrl: string | null; confidence: number }[];
  findings: { kind: string; statement: string; status: string; confidence: number | null }[];
  consultant: {
    version: number;
    generatedAt: string | null;
    confidence: number;
    summary: string;
    hypotheses: string[];
    solution: string;
    features: string[];
    package: string;
    reasoning: string[];
  } | null;
  sales: {
    preparation: {
      createdAt: string;
      solution: string | null;
      approach: string | null;
      opening: string | null;
    } | null;
    contactStage: string | null;
    verifiedReadyAt: string | null;
  };
  crm: { at: string; kind: string; label: string; detail: string | null }[];
};

const SOURCE_LABELS: Record<string, string> = {
  prospect_candidate: "Discovery / Google Maps",
  prospect: "Prospek CRM",
  consultation: "Konsultasi",
  ai_conversation: "Percakapan AI",
};

export async function getEntityDetail(
  supabase: Client,
  entityId: string,
): Promise<EntityDetail | null> {
  const { data: overview, error } = await supabase
    .from("business_entity_overview")
    .select("*")
    .eq("id", entityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!overview) return null;
  const row = overview as unknown as Record<string, unknown>;

  const { data: links } = await supabase
    .from("business_entity_links")
    .select("legacy_type, legacy_id")
    .eq("business_entity_id", entityId)
    .eq("is_active", true);

  const idsOf = (type: string) =>
    ((links ?? []) as Record<string, unknown>[])
      .filter((l) => l["legacy_type"] === type)
      .map((l) => String(l["legacy_id"]));

  const candidateIds = idsOf("prospect_candidate");
  const prospectIds = idsOf("prospect");

  const sources: EntityDetail["sources"] = ((links ?? []) as Record<string, unknown>[]).map((l) => ({
    type: String(l["legacy_type"]),
    id: String(l["legacy_id"]),
    label: SOURCE_LABELS[String(l["legacy_type"])] ?? String(l["legacy_type"]),
    detail: null,
  }));

  // Evidence + sales preparation come from the active candidate material.
  let evidence: EntityDetail["evidence"] = [];
  let preparation: EntityDetail["sales"]["preparation"] = null;
  if (candidateIds.length) {
    const { data: preps } = await supabase
      .from("sales_preparations")
      .select("created_at, recommended_solution, approach_reason, outreach_message, evidence")
      .in("candidate_id", candidateIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const prep = (preps ?? [])[0] as Record<string, unknown> | undefined;
    if (prep) {
      const outreach = (prep["outreach_message"] as Record<string, string> | null) ?? {};
      preparation = {
        createdAt: String(prep["created_at"]),
        solution: (prep["recommended_solution"] as string | null) ?? null,
        approach: (prep["approach_reason"] as string | null) ?? null,
        opening: outreach["opening_message"] ?? null,
      };
      evidence = (Array.isArray(prep["evidence"]) ? prep["evidence"] : []).map((item) => {
        const e = item as Record<string, unknown>;
        return {
          field: String(e["field"] ?? ""),
          data: String(e["data"] ?? ""),
          source: String(e["source"] ?? ""),
          sourceUrl: (e["source_url"] as string | null) ?? null,
          confidence: Number(e["confidence"] ?? 0),
        };
      });
    }
  }

  const { data: findingRows } = await supabase
    .from("business_findings")
    .select("kind, statement, validation_status, confidence")
    .eq("business_entity_id", entityId)
    .limit(50);

  const { data: analysisRows } = await supabase
    .from("business_consultant_analyses")
    .select(
      "version, generated_at, confidence, business_profile, problem_hypotheses, core_solution, recommended_features, recommended_package, consultant_reasoning",
    )
    .eq("business_entity_id", entityId)
    .eq("status", "completed")
    .order("version", { ascending: false })
    .limit(1);

  const analysis = (analysisRows ?? [])[0] as Record<string, unknown> | undefined;
  const consultant: EntityDetail["consultant"] = analysis
    ? {
        version: Number(analysis["version"] ?? 1),
        generatedAt: (analysis["generated_at"] as string | null) ?? null,
        confidence: Number(analysis["confidence"] ?? 0),
        summary: String(
          (analysis["business_profile"] as Record<string, unknown> | null)?.["summary"] ?? "",
        ),
        hypotheses: (
          (analysis["problem_hypotheses"] as Record<string, unknown>[] | null) ?? []
        ).map((h) => String(h["statement"] ?? "")),
        solution: String(
          (analysis["core_solution"] as Record<string, unknown> | null)?.["headline"] ?? "",
        ),
        features: ((analysis["recommended_features"] as Record<string, unknown>[] | null) ?? []).map(
          (f) => String(f["name"] ?? ""),
        ),
        package: String(
          (analysis["recommended_package"] as Record<string, unknown> | null)?.["name"] ?? "",
        ),
        reasoning: ((analysis["consultant_reasoning"] as string[] | null) ?? []).map(String),
      }
    : null;

  // CRM history: candidate stage changes + prospect activities, by reference.
  const crm: EntityDetail["crm"] = [];
  if (candidateIds.length) {
    const { data: history } = await supabase
      .from("candidate_status_history")
      .select("created_at, from_status, to_status, actor_kind, reason")
      .in("candidate_id", candidateIds)
      .order("created_at", { ascending: false })
      .limit(30);
    for (const item of (history ?? []) as Record<string, unknown>[]) {
      crm.push({
        at: String(item["created_at"]),
        kind: String(item["actor_kind"] ?? "system"),
        label: `${String(item["from_status"] ?? "")} → ${String(item["to_status"] ?? "")}`,
        detail: (item["reason"] as string | null) ?? null,
      });
    }
  }
  if (prospectIds.length) {
    const { data: activities } = await supabase
      .from("prospect_activities")
      .select("created_at, action, label, content")
      .in("prospect_id", prospectIds)
      .order("created_at", { ascending: false })
      .limit(30);
    for (const item of (activities ?? []) as Record<string, unknown>[]) {
      crm.push({
        at: String(item["created_at"]),
        kind: String(item["action"] ?? "activity"),
        label: String(item["label"] ?? item["action"] ?? ""),
        detail: (item["content"] as string | null) ?? null,
      });
    }
  }
  crm.sort((a, b) => b.at.localeCompare(a.at));

  return {
    profile: {
      id: entityId,
      name: String(row["canonical_name"] ?? ""),
      industry: (row["industry"] as string | null) ?? null,
      location: [row["city"], row["province"]].filter(Boolean).join(", ") || null,
      website: (row["website"] as string | null) ?? null,
      phone: (row["phone"] as string | null) ?? null,
      whatsapp: (row["whatsapp"] as string | null) ?? null,
      email: (row["email"] as string | null) ?? null,
      stage: currentStage(row),
      googleMapsUrl: (row["google_maps_url"] as string | null) ?? null,
    },
    sources,
    evidence,
    findings: ((findingRows ?? []) as Record<string, unknown>[]).map((f) => ({
      kind: String(f["kind"] ?? "fact"),
      statement: String(f["statement"] ?? ""),
      status: String(f["validation_status"] ?? "unvalidated"),
      confidence: f["confidence"] == null ? null : Number(f["confidence"]),
    })),
    consultant,
    sales: {
      preparation,
      contactStage: (row["contact_stage"] as string | null) ?? null,
      verifiedReadyAt: null,
    },
    crm: crm.slice(0, 40),
  };
}
