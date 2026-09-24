/**
 * Autonomous sales pipeline orchestration — SERVER ONLY.
 *
 * A thin layer on top of the existing modules (discovery, qualification,
 * sales preparation). It never replaces them: it calls them in order so a
 * candidate flows Discovery -> Candidate Inbox -> auto QC -> Sales
 * Preparation -> Ready Outreach without a manual click. A human still owns
 * the final evidence checklist and the actual contact.
 *
 * Safety: one bounded run at a time (lease row), bounded work per run,
 * idempotent (each step skips what is already done), never throws.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { readyOutreachBlockers } from "@/lib/admin/sales-prep";
import { logAutomation } from "@/lib/automation.server";

type Client = SupabaseClient<Database>;

/* ----------------------------- Event pipeline ----------------------------- */

export const SALES_PIPELINE_EVENTS = [
  "campaign.created",
  "candidate.created",
  "qualification.completed",
  "qc.approved",
  "salesprep.completed",
  "ready_outreach.created",
] as const;
export type SalesPipelineEvent = (typeof SALES_PIPELINE_EVENTS)[number];

/** Records a pipeline event. Best effort: logging never breaks the pipeline. */
export async function emitSalesPipelineEvent(input: {
  event: SalesPipelineEvent;
  title: string;
  detail?: string | null;
  entityId?: string | null;
  status?: "success" | "skipped" | "failed";
  meta?: Record<string, unknown>;
}): Promise<void> {
  await logAutomation({
    ruleKey: "outbound.auto_pipeline",
    event: input.event,
    title: input.title,
    detail: input.detail ?? null,
    status: input.status ?? "success",
    entityType: "prospect_candidate",
    entityId: input.entityId ?? null,
    meta: { ...(input.meta ?? {}), pipeline: "sales" },
  });
}

/* --------------------------- Ready Outreach gate --------------------------- */

export type AdvanceResult = { advanced: number; blocked: number; unifiedBlocked?: Record<string, number> };

/**
 * Moves prepared candidates into Ready Outreach automatically.
 * Ready Outreach is an AI-completed queue, not permission to contact:
 * the human evidence checklist still guards the WhatsApp action.
 */
export async function advanceReadyOutreach(
  supabase: Client,
  input: { candidateId?: string; campaignId?: string; limit?: number } = {},
): Promise<AdvanceResult> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const result: AdvanceResult = { advanced: 0, blocked: 0 };

  let query = supabase
    .from("prospect_candidates")
    .select("id, business_name, sales_stage, validation_status, qc_status, contact_data")
    .eq("qc_status", "approved")
    .neq("sales_stage", "ready_outreach")
    .limit(limit);
  if (input.candidateId) query = query.eq("id", input.candidateId);
  if (input.campaignId) query = query.eq("campaign_id", input.campaignId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (rows.length === 0) return result;

  const ids = rows.map((row) => String(row["id"]));
  const { data: preps } = await supabase
    .from("sales_preparations")
    .select("candidate_id, analysis_id, analysis_version")
    .eq("is_active", true)
    .in("candidate_id", ids);
  const prepRows = (preps ?? []) as { candidate_id: string; analysis_id: string | null; analysis_version: number | null }[];
  const prepared = new Set(prepRows.map((row) => row.candidate_id));
  const prepByCandidate = new Map(prepRows.map((row) => [row.candidate_id, row]));

  // Phase A: in unified mode ON the gate is BLOCKING, not a warning.
  const { getUnifiedMode, entityIdsForCandidates, loadActiveAnalyses } = await import("./unified-pipeline.server");
  const { unifiedReadyBlockers } = await import("@/lib/admin/unified-cutover");
  const mode = await getUnifiedMode(supabase);
  const entities = mode === "on" ? await entityIdsForCandidates(supabase, ids) : new Map<string, string>();
  const analyses = mode === "on" ? await loadActiveAnalyses(supabase, [...entities.values()]) : new Map();
  result.unifiedBlocked = {};

  for (const row of rows) {
    const id = String(row["id"]);
    const blockers = readyOutreachBlockers({
      validationStatus: (row["validation_status"] as string | null) ?? null,
      qcStatus: String(row["qc_status"] ?? "new"),
      hasPreparation: prepared.has(id),
      contactData:
        (row["contact_data"] as Record<
          string,
          { value?: string | null; source?: string | null }
        > | null) ?? {},
    });
    if (blockers.length > 0) {
      result.blocked += 1;
      continue;
    }
    if (mode === "on") {
      const entityId = entities.get(id) ?? null;
      const prep = prepByCandidate.get(id);
      const unified = unifiedReadyBlockers({
        entityId,
        analysis: entityId ? analyses.get(entityId) ?? null : null,
        preparation: prep ? { analysisId: prep.analysis_id, analysisVersion: prep.analysis_version } : null,
      });
      if (unified.length > 0) {
        result.blocked += 1;
        for (const key of unified) result.unifiedBlocked[key] = (result.unifiedBlocked[key] ?? 0) + 1;
        continue;
      }
    }

    const { error: updateError } = await supabase
      .from("prospect_candidates")
      .update({ sales_stage: "ready_outreach" } as never)
      .eq("id", id);
    if (updateError) {
      result.blocked += 1;
      continue;
    }

    await supabase.from("candidate_status_history").insert({
      candidate_id: id,
      from_status: String(row["sales_stage"] ?? "sales_prepared"),
      to_status: "ready_outreach",
      actor_kind: "system",
      actor_label: "auto_pipeline",
      reason: "Materi penjualan lengkap — masuk antrean Ready Outreach.",
    } as never);

    result.advanced += 1;
    await emitSalesPipelineEvent({
      event: "ready_outreach.created",
      title: `Ready Outreach: ${String(row["business_name"] ?? "Kandidat")}`,
      detail: "Menunggu ceklis verifikasi manusia sebelum dihubungi.",
      entityId: id,
    });
  }

  return result;
}

/* ------------------------------- Run lease -------------------------------- */

const LOCK_KEY = "sales_pipeline";
const LOCK_TTL_MS = 10 * 60 * 1000;

async function acquireLease(supabase: Client): Promise<boolean> {
  const now = Date.now();
  const { data } = await supabase
    .from("prospect_job_state")
    .select("locked_at")
    .eq("key", LOCK_KEY)
    .maybeSingle();
  const lockedAt = data?.locked_at ? Date.parse(String(data.locked_at)) : 0;
  if (lockedAt && now - lockedAt < LOCK_TTL_MS) return false;

  const { error } = await supabase.from("prospect_job_state").upsert(
    {
      key: LOCK_KEY,
      locked_at: new Date(now).toISOString(),
      last_status: "running",
      updated_at: new Date(now).toISOString(),
    } as never,
    { onConflict: "key" },
  );
  return !error;
}

async function releaseLease(supabase: Client, status: string, detail: string): Promise<void> {
  await supabase.from("prospect_job_state").upsert(
    {
      key: LOCK_KEY,
      locked_at: null,
      last_run_at: new Date().toISOString(),
      last_status: status.slice(0, 40),
      detail: detail.slice(0, 500),
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "key" },
  );
}

/* ------------------------------- Full cycle ------------------------------- */

export type SalesPipelineCycleResult = {
  skipped: boolean;
  discovery: { tasks: number; saved: number; failed: number };
  qualification: { scanned: number; autoApproved: number; needReview: number; autoPrepared: number };
  preparation: { scanned: number; prepared: number; skipped: number; failed: number };
  consultant: { mode: string; scanned: number; generated: number; reused: number; failed: number; linked: number };
  decisionSources: Record<string, number>;
  readyOutreach: AdvanceResult;
  errors: string[];
};

/**
 * One bounded pass of the whole pipeline. Safe to call repeatedly from a
 * scheduler or from the admin UI.
 */
export async function runSalesPipelineCycle(
  supabase: Client,
  input: { campaignId?: string; discoveryTasks?: number; qualifyLimit?: number; prepLimit?: number } = {},
): Promise<SalesPipelineCycleResult> {
  const result: SalesPipelineCycleResult = {
    skipped: false,
    discovery: { tasks: 0, saved: 0, failed: 0 },
    qualification: { scanned: 0, autoApproved: 0, needReview: 0, autoPrepared: 0 },
    preparation: { scanned: 0, prepared: 0, skipped: 0, failed: 0 },
    consultant: { mode: "off", scanned: 0, generated: 0, reused: 0, failed: 0, linked: 0 },
    decisionSources: {},
    readyOutreach: { advanced: 0, blocked: 0 },
    errors: [],
  };

  const leased = await acquireLease(supabase);
  if (!leased) {
    result.skipped = true;
    return result;
  }

  const { runDiscoveryBatch, retryFailedDiscoveryTasks, planCampaignDiscovery } = await import(
    "./prospecting-discovery.server"
  );
  const { qualifyCandidates } = await import("./prospecting-qualification.server");
  const { prepareSalesForCandidates } = await import("./prospecting-salesprep.server");

  try {
    // 0. Plan discovery tasks for active campaigns so no manual click is needed.
    try {
      let campaignQuery = supabase
        .from("prospect_campaigns")
        .select("id")
        .eq("status", "active")
        .limit(10);
      if (input.campaignId) campaignQuery = campaignQuery.eq("id", input.campaignId);
      const { data: campaigns } = await campaignQuery;
      for (const row of (campaigns ?? []) as { id: string }[]) {
        try {
          const planned = await planCampaignDiscovery(supabase, { campaignId: row.id });
          if (planned.created > 0) {
            await emitSalesPipelineEvent({
              event: "campaign.created",
              title: `${planned.created} tugas discovery direncanakan — ${planned.campaign}`,
            });
          }
        } catch (error) {
          result.errors.push(`plan: ${error instanceof Error ? error.message : "gagal"}`);
        }
      }
    } catch (error) {
      result.errors.push(`plan: ${error instanceof Error ? error.message : "gagal"}`);
    }

    // 1. Discovery — bounded batch, retries first.
    try {
      await retryFailedDiscoveryTasks(supabase, input.campaignId ? { campaignId: input.campaignId } : {});
      const discovery = await runDiscoveryBatch(supabase, {
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        limit: Math.min(Math.max(input.discoveryTasks ?? 3, 1), 5),
      });
      result.discovery = {
        tasks: discovery.tasks,
        saved: discovery.saved,
        failed: discovery.failed,
      };
      if (discovery.saved > 0) {
        await emitSalesPipelineEvent({
          event: "candidate.created",
          title: `${discovery.saved} kandidat baru dari discovery`,
          detail: discovery.errors.slice(0, 3).join(" | ") || null,
        });
      }
    } catch (error) {
      result.errors.push(`discovery: ${error instanceof Error ? error.message : "gagal"}`);
    }

    // 2. Screening + auto QC (auto-approved candidates get their material here).
    try {
      const qualification = await qualifyCandidates(supabase, {
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        limit: Math.min(Math.max(input.qualifyLimit ?? 50, 1), 200),
      });
      result.qualification = {
        scanned: qualification.scanned,
        autoApproved: qualification.autoApproved,
        needReview: qualification.needReview,
        autoPrepared: qualification.autoPrepared,
      };
      await emitSalesPipelineEvent({
        event: "qualification.completed",
        title: `Screening ${qualification.scanned} kandidat`,
        detail: `Auto approve ${qualification.autoApproved} • perlu tinjauan ${qualification.needReview}`,
      });
      if (qualification.autoApproved > 0) {
        await emitSalesPipelineEvent({
          event: "qc.approved",
          title: `${qualification.autoApproved} kandidat lolos QC otomatis`,
        });
      }
    } catch (error) {
      result.errors.push(`qualification: ${error instanceof Error ? error.message : "gagal"}`);
    }

    // 2b. Phase A: Consultant Engine after QC, before Sales Preparation.
    const cycleStartedAt = new Date().toISOString();
    try {
      const { getUnifiedMode } = await import("./unified-pipeline.server");
      const mode = await getUnifiedMode(supabase);
      result.consultant.mode = mode;
      if (mode !== "off") {
        await runConsultantStep(supabase, result, input.campaignId);
      }
    } catch (error) {
      result.errors.push(`consultant: ${error instanceof Error ? error.message : "gagal"}`);
    }

    // 3. Sales preparation for any approved candidate still without material.
    try {
      const prep = await prepareSalesForCandidates(supabase, {
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        limit: Math.min(Math.max(input.prepLimit ?? 25, 1), 100),
      });
      result.preparation = {
        scanned: prep.scanned,
        prepared: prep.prepared,
        skipped: prep.skipped,
        failed: prep.failed,
      };
      if (prep.prepared > 0) {
        await emitSalesPipelineEvent({
          event: "salesprep.completed",
          title: `${prep.prepared} materi penjualan dibuat otomatis`,
          detail: prep.errors.slice(0, 3).join(" | ") || null,
        });
      }
    } catch (error) {
      result.errors.push(`preparation: ${error instanceof Error ? error.message : "gagal"}`);
    }

    // 3b. Phase A: decision source logging for materials made this cycle.
    try {
      const { data: made } = await supabase
        .from("sales_preparations")
        .select("decision_source")
        .gte("created_at", cycleStartedAt)
        .limit(1000);
      for (const row of (made ?? []) as { decision_source: string | null }[]) {
        const key = row.decision_source ?? "legacy_rules";
        result.decisionSources[key] = (result.decisionSources[key] ?? 0) + 1;
      }
      await logAutomation({
        ruleKey: "outbound.auto_pipeline",
        event: "decision_source.summary",
        title: `Sumber keputusan materi (mode ${result.consultant.mode})`,
        detail: Object.entries(result.decisionSources).map(([k, v]) => `${k}: ${v}`).join(" • ") || "tidak ada materi baru",
        status: "success",
        entityType: "prospect_candidate",
        entityId: null,
        meta: { pipeline: "sales", mode: result.consultant.mode, consultant: result.consultant, decision_sources: result.decisionSources },
      });
    } catch (error) {
      result.errors.push(`decision_log: ${error instanceof Error ? error.message : "gagal"}`);
    }

    // 4. Ready Outreach queue.
    try {
      result.readyOutreach = await advanceReadyOutreach(
        supabase,
        input.campaignId ? { campaignId: input.campaignId } : {},
      );
    } catch (error) {
      result.errors.push(`ready_outreach: ${error instanceof Error ? error.message : "gagal"}`);
    }

    await releaseLease(
      supabase,
      result.errors.length > 0 ? "partial" : "done",
      `mode ${result.consultant.mode} • discovery ${result.discovery.saved} • qc ${result.qualification.autoApproved} • analisis ${result.consultant.generated}+${result.consultant.reused} • prep ${result.preparation.prepared} • ready ${result.readyOutreach.advanced} • diblokir ${result.readyOutreach.blocked}`,
    );
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Pipeline gagal.");
    await releaseLease(supabase, "failed", result.errors.join(" | "));
  }

  return result;
}

/**
 * Phase A: QC-approved candidates get linked to their Business Entity and a
 * current Consultant Analysis (reused when fingerprint unchanged; stale ones
 * regenerated). Bounded per cycle.
 */
async function runConsultantStep(
  supabase: Client,
  result: SalesPipelineCycleResult,
  campaignId?: string,
): Promise<void> {
  let query = supabase
    .from("prospect_candidates")
    .select("id")
    .eq("qc_status", "approved")
    .is("promoted_prospect_id", null)
    .order("updated_at", { ascending: false })
    .limit(60);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
  if (!ids.length) return;

  const { ensureBusinessEntities } = await import("./entity-resolution.server");
  const { loadActiveAnalyses } = await import("./unified-pipeline.server");
  const { generateAnalysis } = await import("./consultant-engine.service");
  const ensured = await ensureBusinessEntities(supabase, "prospect_candidate", ids);
  const entityIds = [...new Set(Object.values(ensured.linked))];
  result.consultant.linked = entityIds.length;
  const active = await loadActiveAnalyses(supabase, entityIds);
  // Only entities with no analysis or a stale one need work; max 20 per cycle.
  const todo = entityIds.filter((id) => !active.get(id) || active.get(id)!.stale).slice(0, 20);
  result.consultant.scanned = todo.length;
  for (const entityId of todo) {
    try {
      const stale = active.get(entityId)?.stale ?? false;
      const out = await generateAnalysis(supabase, { entityId, force: stale });
      if (out.status === "generated") result.consultant.generated += 1;
      else if (out.status === "reused") result.consultant.reused += 1;
    } catch (error) {
      result.consultant.failed += 1;
      if (result.errors.length < 10) result.errors.push(`consultant: ${error instanceof Error ? error.message : "gagal"}`);
    }
  }
  if (result.consultant.generated > 0) {
    await emitSalesPipelineEvent({
      event: "qc.approved",
      title: `${result.consultant.generated} analisis konsultan dibuat`,
      detail: `dipakai ulang ${result.consultant.reused} • gagal ${result.consultant.failed}`,
      meta: { step: "consultant_analysis" },
    });
  }
}
