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

export type AdvanceResult = { advanced: number; blocked: number };

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
    .select("candidate_id")
    .eq("is_active", true)
    .in("candidate_id", ids);
  const prepared = new Set(
    ((preps ?? []) as { candidate_id: string }[]).map((row) => row.candidate_id),
  );

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
    readyOutreach: { advanced: 0, blocked: 0 },
    errors: [],
  };

  const leased = await acquireLease(supabase);
  if (!leased) {
    result.skipped = true;
    return result;
  }

  const { runDiscoveryBatch, retryFailedDiscoveryTasks } = await import(
    "./prospecting-discovery.server"
  );
  const { qualifyCandidates } = await import("./prospecting-qualification.server");
  const { prepareSalesForCandidates } = await import("./prospecting-salesprep.server");

  try {
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
      `discovery ${result.discovery.saved} • qc ${result.qualification.autoApproved} • prep ${result.preparation.prepared} • ready ${result.readyOutreach.advanced}`,
    );
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Pipeline gagal.");
    await releaseLease(supabase, "failed", result.errors.join(" | "));
  }

  return result;
}
