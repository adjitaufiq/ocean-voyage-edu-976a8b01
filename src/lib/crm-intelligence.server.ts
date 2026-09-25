/**
 * CRM INTELLIGENCE — SERVER ONLY (Phase 6).
 *
 * Feedback loop: respons customer masuk ke Business Entity, menjadi temuan
 * bisnis (fakta/dugaan) dengan siklus hidup yang menyimpan riwayat, mencatat
 * keberatan, dan menandai analisis konsultan perlu diperbarui.
 *
 * CRM tetap menjadi relationship management: modul ini tidak membuat
 * diagnosis, tidak memilih solusi, fitur, atau paket. Diagnosis tetap milik
 * Consultant Engine. Chatbot, Order Brief, proposal, dan pipeline discovery
 * tidak disentuh.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import {
  planFindingLifecycle,
  type ExistingFinding,
} from "@/lib/admin/finding-lifecycle";
import {
  analyzeCustomerResponse,
  type ResponseChannel,
} from "@/lib/admin/response-analysis";
import { buildSalesContextSnapshot } from "@/lib/admin/consultant-engine";
import { generateAnalysis, getCurrentAnalysis } from "@/lib/consultant-engine.service";

type Client = SupabaseClient<Database>;

const asJson = (value: unknown): Json => JSON.parse(JSON.stringify(value ?? null)) as Json;

export type RecordResponseInput = {
  entityId: string;
  channel: ResponseChannel;
  content: string;
  direction?: "inbound" | "outbound";
  occurredAt?: string | null;
  legacyType?: string | null;
  legacyId?: string | null;
};

export type RecordResponseResult = {
  interactionId: string;
  findingsAdded: number;
  findingsRejected: number;
  findingsSuperseded: number;
  objectionsAdded: number;
  staleReason: string | null;
};

/* ------------------------------------------------------------------ */
/* CUSTOMER RESPONSE -> FINDINGS + OBJECTIONS                          */
/* ------------------------------------------------------------------ */

export async function recordCustomerResponse(
  supabase: Client,
  userId: string,
  input: RecordResponseInput,
): Promise<RecordResponseResult> {
  const content = input.content.trim();
  if (!content) throw new Error("Isi respons customer tidak boleh kosong.");

  const current = await getCurrentAnalysis(supabase, input.entityId);

  const { data: interaction, error: interactionErr } = await supabase
    .from("business_interactions")
    .insert({
      business_entity_id: input.entityId,
      channel: input.channel,
      direction: input.direction ?? "inbound",
      content,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      legacy_type: input.legacyType ?? null,
      legacy_id: input.legacyId ?? null,
      recorded_by: userId,
      analysis_id: current?.id ?? null,
    })
    .select("id")
    .single();
  if (interactionErr) throw new Error(`Gagal menyimpan respons customer: ${interactionErr.message}`);

  const analyzed = analyzeCustomerResponse(content, input.channel);

  const { data: existingRows, error: findingErr } = await supabase
    .from("business_findings")
    .select("id, topic_key, kind, statement, validation_status")
    .eq("business_entity_id", input.entityId);
  if (findingErr) throw new Error(`Gagal membaca temuan bisnis: ${findingErr.message}`);

  const existing: ExistingFinding[] = (existingRows ?? []).map((row) => ({
    id: row.id,
    topicKey: row.topic_key,
    kind: row.kind as ExistingFinding["kind"],
    statement: row.statement,
    validationStatus: row.validation_status as ExistingFinding["validationStatus"],
  }));

  const plan = planFindingLifecycle(existing, analyzed.findings);
  const now = new Date().toISOString();

  let insertedIds: string[] = [];
  if (plan.insert.length) {
    const { data: inserted, error } = await supabase
      .from("business_findings")
      .insert(
        plan.insert.map((item) => ({
          business_entity_id: input.entityId,
          kind: item.kind,
          statement: item.statement,
          confidence: item.confidence,
          validation_status: item.validationStatus,
          topic_key: item.topicKey,
          interaction_id: interaction.id,
          analysis_id: current?.id ?? null,
          source_type: `customer_response:${input.channel}`,
          evidence_reference: asJson({ quote: content.slice(0, 500), channel: input.channel }),
          validated_at: item.validationStatus === "confirmed" ? now : null,
          validated_by: item.validationStatus === "confirmed" ? userId : null,
        })),
      )
      .select("id");
    if (error) throw new Error(`Gagal menyimpan temuan baru: ${error.message}`);
    insertedIds = (inserted ?? []).map((row) => row.id);
  }

  const replacement = insertedIds[0] ?? null;

  for (const item of plan.reject) {
    const { error } = await supabase
      .from("business_findings")
      .update({
        validation_status: "rejected",
        validated_at: now,
        validated_by: userId,
        superseded_by_id: replacement,
      })
      .eq("id", item.id);
    if (error) throw new Error(`Gagal menandai dugaan yang dibantah: ${error.message}`);
  }

  for (const item of plan.supersede) {
    const { error } = await supabase
      .from("business_findings")
      .update({
        validation_status: "superseded",
        validated_at: now,
        validated_by: userId,
        superseded_by_id: replacement,
      })
      .eq("id", item.id);
    if (error) throw new Error(`Gagal menandai temuan lama: ${error.message}`);
  }

  let objectionIds: string[] = [];
  if (analyzed.objections.length) {
    const { data: objectionRows, error } = await supabase
      .from("business_objections")
      .insert(
        analyzed.objections.map((objection) => ({
          business_entity_id: input.entityId,
          interaction_id: interaction.id,
          category: objection.category,
          quote: objection.quote,
          confidence: objection.confidence,
          recorded_by: userId,
        })),
      )
      .select("id");
    if (error) throw new Error(`Gagal menyimpan keberatan customer: ${error.message}`);
    objectionIds = (objectionRows ?? []).map((row) => row.id);
  }

  if (plan.staleReason && current) {
    const { error } = await supabase
      .from("business_consultant_analyses")
      .update({ stale_reason: plan.staleReason })
      .eq("id", current.id);
    if (error) throw new Error(`Gagal menandai analisis perlu diperbarui: ${error.message}`);
  }

  // Observability (write-only, never throws): feedback intelligence events.
  {
    const { recordDecisionTraces } = await import("./decision-trace.server");
    const base = {
      entityId: input.entityId,
      module: "feedback_intelligence",
      analysisId: current?.id ?? null,
      actorKind: "user" as const,
      actorId: userId,
    };
    const ev = (extra: Record<string, unknown>) => ({ interaction_id: interaction.id, channel: input.channel, ...extra });
    await recordDecisionTraces([
      {
        ...base,
        decisionType: "customer_interaction_recorded",
        decision: { direction: input.direction ?? "inbound", excerpt: content.slice(0, 500) },
        evidence: ev({}),
      },
      ...analyzed.objections.map((objection, i) => ({
        ...base,
        decisionType: "objection_detected",
        decision: { category: objection.category, quote: objection.quote },
        evidence: ev({ objection_id: objectionIds[i] ?? null }),
        confidence: objection.confidence,
      })),
      ...plan.insert.map((item, i) => ({
        ...base,
        decisionType: item.validationStatus === "confirmed" ? "finding_confirmed" : "finding_created",
        decision: { kind: item.kind, statement: item.statement, topic_key: item.topicKey, validation_status: item.validationStatus },
        evidence: ev({ finding_id: insertedIds[i] ?? null }),
        confidence: item.confidence,
      })),
      ...plan.reject.map((item) => ({
        ...base,
        decisionType: "finding_rejected",
        decision: { finding_id: item.id, replaced_by: replacement },
        evidence: ev({ finding_id: item.id }),
        override: { original: "unvalidated", changed: "rejected", actor: userId, reason: "customer_response", at: now },
      })),
      ...plan.supersede.map((item) => ({
        ...base,
        decisionType: "finding_superseded",
        decision: { finding_id: item.id, replaced_by: replacement },
        evidence: ev({ finding_id: item.id }),
        override: { original: "active", changed: "superseded", actor: userId, reason: "customer_response", at: now },
      })),
    ]);
  }

  return {
    interactionId: interaction.id,
    findingsAdded: plan.insert.length,
    findingsRejected: plan.reject.length,
    findingsSuperseded: plan.supersede.length,
    objectionsAdded: analyzed.objections.length,
    staleReason: plan.staleReason,
  };
}

export async function resolveObjection(
  supabase: Client,
  input: { objectionId: string; response?: string | null; resolution: string },
): Promise<{ ok: true }> {
  const { error } = await supabase
    .from("business_objections")
    .update({ response: input.response ?? null, resolution: input.resolution })
    .eq("id", input.objectionId);
  if (error) throw new Error(`Gagal memperbarui keberatan: ${error.message}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* SALES CONTEXT SNAPSHOT (berversi, tidak pernah ditimpa)             */
/* ------------------------------------------------------------------ */

export async function saveSalesContextSnapshot(
  supabase: Client,
  entityId: string,
): Promise<{ snapshotVersion: number; analysisId: string } | null> {
  const stored = await getCurrentAnalysis(supabase, entityId);
  if (!stored) return null;

  const snapshot = buildSalesContextSnapshot(stored.analysis);

  const { data: findings } = await supabase
    .from("business_findings")
    .select("statement, kind, validation_status, confidence")
    .eq("business_entity_id", entityId)
    .in("validation_status", ["confirmed", "unvalidated"]);

  const confirmed = (findings ?? [])
    .filter((row) => row.validation_status === "confirmed")
    .map((row) => row.statement);
  const active = (findings ?? [])
    .filter((row) => row.validation_status === "unvalidated" && row.kind === "hypothesis")
    .map((row) => row.statement);

  const { data: objections } = await supabase
    .from("business_objections")
    .select("category, quote, response, resolution")
    .eq("business_entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: interactions } = await supabase
    .from("business_interactions")
    .select("channel, content, occurred_at")
    .eq("business_entity_id", entityId)
    .order("occurred_at", { ascending: false })
    .limit(5);

  const { data: last } = await supabase
    .from("sales_context_snapshots")
    .select("snapshot_version")
    .eq("business_entity_id", entityId)
    .order("snapshot_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const snapshotVersion = (last?.snapshot_version ?? 0) + 1;

  const { error } = await supabase.from("sales_context_snapshots").insert({
    business_entity_id: entityId,
    analysis_id: stored.id,
    analysis_version: stored.version,
    snapshot_version: snapshotVersion,
    business_summary: snapshot.businessSummary,
    confirmed_facts: asJson(confirmed.length ? confirmed : snapshot.verifiedFacts),
    active_hypotheses: asJson(active.length ? active : snapshot.problemHypotheses),
    recommended_questions: asJson(snapshot.validationQuestions),
    objection_guidance: asJson({
      engine: snapshot.objectionGuidance,
      recorded: objections ?? [],
    }),
    latest_customer_info: asJson(interactions ?? []),
    recommended_solution: asJson(snapshot.recommendedSolution),
    confidence: snapshot.confidence,
  });
  if (error) throw new Error(`Gagal menyimpan konteks penjualan: ${error.message}`);

  return { snapshotVersion, analysisId: stored.id };
}

/* ------------------------------------------------------------------ */
/* RE-ANALYSIS                                                         */
/* ------------------------------------------------------------------ */

/**
 * Analisis ulang hanya untuk bisnis yang ditandai perlu diperbarui
 * (temuan penting berubah). Aktivitas CRM biasa dan follow up tidak
 * pernah memicu analisis ulang. Versi lama tetap tersimpan.
 */
export async function reanalyzeStaleEntities(
  supabase: Client,
  options: { limit?: number; entityIds?: string[] } = {},
): Promise<{ scanned: number; regenerated: number; failed: number; errors: string[] }> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);

  let ids = options.entityIds ?? [];
  if (!ids.length) {
    const { data, error } = await supabase
      .from("business_consultant_analyses")
      .select("business_entity_id")
      .eq("status", "completed")
      .not("stale_reason", "is", null)
      .limit(limit);
    if (error) throw new Error(`Gagal membaca analisis kedaluwarsa: ${error.message}`);
    ids = [...new Set((data ?? []).map((row) => row.business_entity_id))];
  }
  ids = ids.slice(0, limit);

  let regenerated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entityId of ids) {
    try {
      const result = await generateAnalysis(supabase, { entityId, force: true });
      if (result.status === "generated") {
        regenerated += 1;
        await saveSalesContextSnapshot(supabase, entityId);
      }
    } catch (error) {
      failed += 1;
      if (errors.length < 5) errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { scanned: ids.length, regenerated, failed, errors };
}

/* ------------------------------------------------------------------ */
/* READ                                                                */
/* ------------------------------------------------------------------ */

export type BusinessIntelligence = {
  staleReason: string | null;
  analysisVersion: number | null;
  interactions: { id: string; channel: string; direction: string; content: string; occurredAt: string }[];
  findings: {
    id: string;
    kind: string;
    statement: string;
    validationStatus: string;
    confidence: number | null;
    createdAt: string;
  }[];
  objections: {
    id: string;
    category: string;
    quote: string | null;
    response: string | null;
    resolution: string;
    createdAt: string;
  }[];
  snapshotVersion: number | null;
};

export async function getBusinessIntelligence(
  supabase: Client,
  entityId: string,
): Promise<BusinessIntelligence> {
  const [analysis, interactions, findings, objections, snapshot] = await Promise.all([
    supabase
      .from("business_consultant_analyses")
      .select("version, stale_reason")
      .eq("business_entity_id", entityId)
      .eq("status", "completed")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("business_interactions")
      .select("id, channel, direction, content, occurred_at")
      .eq("business_entity_id", entityId)
      .order("occurred_at", { ascending: false })
      .limit(30),
    supabase
      .from("business_findings")
      .select("id, kind, statement, validation_status, confidence, created_at")
      .eq("business_entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("business_objections")
      .select("id, category, quote, response, resolution, created_at")
      .eq("business_entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("sales_context_snapshots")
      .select("snapshot_version")
      .eq("business_entity_id", entityId)
      .order("snapshot_version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    staleReason: analysis.data?.stale_reason ?? null,
    analysisVersion: analysis.data?.version ?? null,
    interactions: (interactions.data ?? []).map((row) => ({
      id: row.id,
      channel: row.channel,
      direction: row.direction,
      content: row.content,
      occurredAt: row.occurred_at,
    })),
    findings: (findings.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      statement: row.statement,
      validationStatus: row.validation_status,
      confidence: row.confidence,
      createdAt: row.created_at,
    })),
    objections: (objections.data ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      quote: row.quote,
      response: row.response,
      resolution: row.resolution,
      createdAt: row.created_at,
    })),
    snapshotVersion: snapshot.data?.snapshot_version ?? null,
  };
}

/** Cari entitas bisnis yang tertaut ke satu kandidat prospek. */
export async function entityIdForCandidate(
  supabase: Client,
  candidateId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("business_entity_links")
    .select("business_entity_id")
    .eq("legacy_type", "prospect_candidate")
    .eq("legacy_id", candidateId)
    .eq("is_active", true)
    .maybeSingle();
  return data?.business_entity_id ?? null;
}
