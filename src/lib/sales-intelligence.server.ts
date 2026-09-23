/**
 * Sales intelligence bridge — SERVER ONLY (Phase 4).
 *
 * Sales Preparation and Ready Outreach read the Consultant Analysis instead of
 * diagnosing the business again. This module maps candidates to their business
 * entity, loads the active analysis in one batch, and derives the consultative
 * WhatsApp draft. It creates no new pipeline, table, or scheduler.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  buildSalesContextSnapshot,
  type ConsultantAnalysis,
  type SalesContextSnapshot,
} from "@/lib/admin/consultant-engine";
import { buildConsultantDraft, consultantDraftText } from "@/lib/admin/consultant-outreach";

type Client = SupabaseClient<Database>;

export type SalesIntelligence = {
  entityId: string;
  analysisId: string;
  version: number;
  generatedAt: string | null;
  /** Analysis is older than the candidate's latest data change. */
  stale: boolean;
  confidence: number;
  businessSummary: string;
  verifiedFacts: string[];
  problemHypotheses: string[];
  validationQuestions: string[];
  recommendedSolution: { package: string; features: string[] };
  salesAngle: SalesContextSnapshot["salesAngle"];
  objectionGuidance: SalesContextSnapshot["objectionGuidance"];
  consultantReasoning: string[];
  whatsappDraft: string;
};

function toAnalysis(row: Record<string, unknown>): ConsultantAnalysis {
  return {
    engineVersion: String(row["engine_version"] ?? ""),
    knowledgeVersion: String(row["knowledge_version"] ?? ""),
    inputHash: String(row["input_hash"] ?? ""),
    sourceRevision: Number(row["source_revision"] ?? 1),
    businessProfile: row["business_profile"],
    industryContext: row["industry_context"],
    businessModel: row["business_model"],
    businessMaturity: row["business_stage"],
    observedFacts: row["observed_facts"] ?? [],
    problemHypotheses: row["problem_hypotheses"] ?? [],
    confirmedProblems: row["confirmed_problems"] ?? [],
    problemEvidence: row["problem_evidence"] ?? [],
    businessGoals: row["business_goals"] ?? [],
    coreSolution: row["core_solution"],
    coreFeatures: row["recommended_features"] ?? [],
    optionalFeatures: row["optional_features"] ?? [],
    recommendedPackage: row["recommended_package"],
    consultantReasoning: row["consultant_reasoning"] ?? [],
    salesAngle: row["sales_angle"],
    validationQuestions: row["validation_questions"] ?? [],
    objectionGuidance: row["objection_guidance"] ?? [],
    confidenceScore: Number(row["confidence"] ?? 0),
  } as unknown as ConsultantAnalysis;
}

/**
 * One batch read for a page of candidates: links -> entities -> active
 * analyses. Missing analyses simply yield no intelligence; nothing throws and
 * no analysis is generated inside a read path.
 */
export async function loadSalesIntelligence(
  supabase: Client,
  candidates: { id: string; businessName: string; updatedAt?: string | null }[],
): Promise<Map<string, SalesIntelligence>> {
  const result = new Map<string, SalesIntelligence>();
  const ids = candidates.map((c) => c.id);
  if (ids.length === 0) return result;

  const { data: links } = await supabase
    .from("business_entity_links")
    .select("legacy_id, business_entity_id")
    .eq("legacy_type", "prospect_candidate")
    .eq("is_active", true)
    .in("legacy_id", ids);

  const entityByCandidate = new Map<string, string>();
  for (const link of (links ?? []) as Record<string, unknown>[]) {
    entityByCandidate.set(String(link["legacy_id"]), String(link["business_entity_id"]));
  }
  const entityIds = [...new Set(entityByCandidate.values())];
  if (entityIds.length === 0) return result;

  const { data: analyses } = await supabase
    .from("business_consultant_analyses")
    .select("*")
    .in("business_entity_id", entityIds)
    .eq("status", "completed")
    .order("version", { ascending: false });

  const byEntity = new Map<string, Record<string, unknown>>();
  for (const row of (analyses ?? []) as Record<string, unknown>[]) {
    const key = String(row["business_entity_id"]);
    if (!byEntity.has(key)) byEntity.set(key, row);
  }

  for (const candidate of candidates) {
    const entityId = entityByCandidate.get(candidate.id);
    if (!entityId) continue;
    const row = byEntity.get(entityId);
    if (!row) continue;

    const snapshot = buildSalesContextSnapshot(toAnalysis(row));
    const generatedAt = (row["generated_at"] as string | null) ?? null;
    const stale =
      Boolean(candidate.updatedAt && generatedAt) &&
      new Date(candidate.updatedAt as string).getTime() > new Date(generatedAt as string).getTime();

    result.set(candidate.id, {
      entityId,
      analysisId: String(row["id"]),
      version: Number(row["version"] ?? 1),
      generatedAt,
      stale,
      confidence: snapshot.confidence,
      businessSummary: snapshot.businessSummary,
      verifiedFacts: snapshot.verifiedFacts,
      problemHypotheses: snapshot.problemHypotheses,
      validationQuestions: snapshot.validationQuestions,
      recommendedSolution: snapshot.recommendedSolution,
      salesAngle: snapshot.salesAngle,
      objectionGuidance: snapshot.objectionGuidance,
      consultantReasoning: (row["consultant_reasoning"] as string[] | null) ?? [],
      whatsappDraft: consultantDraftText(buildConsultantDraft(candidate.businessName, snapshot)),
    });
  }

  return result;
}
