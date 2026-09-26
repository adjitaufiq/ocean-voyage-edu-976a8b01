/**
 * Bulk Entity Repair Engine — SERVER ONLY (Phase 2B).
 *
 * Resumable, cursor-paginated linking of legacy records to Business Entities.
 * It is NEVER started automatically: a human creates a job, then runs steps.
 * - cursor pagination on (created_at, id)
 * - one active job per source (unique index) + a short lease per step
 * - per-record failure storage with attempts, retry function
 * - progress counters on entity_resolution_runs
 * - decision traces for every step (and per record via ensureBusinessEntities)
 * Never deletes or merges; linking goes through the hardened resolver.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { ENSURE_COLUMNS, ensureBusinessEntities } from "./entity-resolution.server";

type Client = SupabaseClient<Database>;
type LegacyType = Database["public"]["Enums"]["business_legacy_type"];

export const REPAIR_SOURCES: LegacyType[] = ["prospect_candidate", "prospect", "consultation", "ai_conversation", "client"];
const LEASE_MS = 2 * 60 * 1000;

export async function startRepairJob(
  client: Client,
  input: { source: LegacyType; dryRun?: boolean; pageSize?: number; actorId?: string | null },
) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 100, 1), 500);
  const { data, error } = await client
    .from("entity_resolution_runs")
    .insert({ source_type: input.source, dry_run: input.dryRun ?? true, page_size: pageSize, status: "pending", started_by: input.actorId ?? null })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Sudah ada job perbaikan aktif untuk sumber ini.");
    throw new Error(`Gagal membuat job: ${error.message}`);
  }
  return data;
}

async function acquireLease(client: Client, runId: string) {
  const now = new Date();
  const { data } = await client
    .from("entity_resolution_runs")
    .update({ status: "running", lease_until: new Date(now.getTime() + LEASE_MS).toISOString() })
    .eq("id", runId)
    .in("status", ["pending", "running"])
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("*")
    .maybeSingle();
  return data;
}

async function recordFailures(client: Client, source: LegacyType, runId: string, ids: string[], reason: string) {
  if (!ids.length) return;
  const { data: existing } = await client
    .from("entity_resolution_failures")
    .select("source_id, attempts")
    .eq("source_type", source)
    .in("source_id", ids);
  const attempts = new Map((existing ?? []).map((row) => [row.source_id, row.attempts]));
  const now = new Date().toISOString();
  await client.from("entity_resolution_failures").upsert(
    ids.map((id) => ({
      source_type: source,
      source_id: id,
      run_id: runId,
      error: reason.slice(0, 500),
      attempts: (attempts.get(id) ?? 0) + 1,
      last_attempt_at: now,
      resolved_at: null,
    })),
    { onConflict: "source_type,source_id" },
  );
}

async function markResolved(client: Client, source: LegacyType, ids: string[]) {
  if (!ids.length) return;
  await client
    .from("entity_resolution_failures")
    .update({ resolved_at: new Date().toISOString() })
    .eq("source_type", source)
    .in("source_id", ids)
    .is("resolved_at", null);
}

/** Link a batch; returns which ids failed. */
async function linkBatch(client: Client, source: LegacyType, ids: string[]) {
  const result = await ensureBusinessEntities(client, source, ids);
  const failed = ids.filter((id) => !result.linked[id]);
  const reason = result.errors[0] ?? "Tidak tertaut (alasan tidak diketahui)";
  return { result, failed, reason };
}

/** Run one page of a job. Safe to call repeatedly; resumes from the stored cursor. */
export async function runRepairStep(client: Client, input: { runId: string; actorId?: string | null }) {
  const run = await acquireLease(client, input.runId);
  if (!run) return { status: "busy_or_finished" as const };
  const source = run.source_type as LegacyType;
  const spec = ENSURE_COLUMNS[source];
  if (!spec) throw new Error(`Sumber tidak didukung: ${source}`);

  try {
    let query = client.from(spec.table).select("id, created_at");
    if (run.cursor_created_at && run.cursor_id) {
      query = query.or(
        `created_at.gt.${run.cursor_created_at},and(created_at.eq.${run.cursor_created_at},id.gt.${run.cursor_id})`,
      );
    }
    const { data: page, error } = await query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(run.page_size);
    if (error) throw new Error(error.message);
    const rows = (page ?? []) as { id: string; created_at: string }[];
    const ids = rows.map((r) => r.id);

    let created = 0;
    let matched = 0;
    let failed = 0;
    if (ids.length) {
      const { data: linked } = await client
        .from("business_entity_links")
        .select("legacy_id")
        .eq("legacy_type", source)
        .eq("is_active", true)
        .in("legacy_id", ids);
      const already = new Set((linked ?? []).map((r) => r.legacy_id));
      const missing = ids.filter((id) => !already.has(id));
      if (!run.dry_run && missing.length) {
        const batch = await linkBatch(client, source, missing);
        created = batch.result.created;
        matched = missing.length - batch.failed.length - created;
        failed = batch.failed.length;
        await recordFailures(client, source, run.id, batch.failed, batch.reason);
        await markResolved(client, source, missing.filter((id) => !batch.failed.includes(id)));
      } else if (run.dry_run) {
        matched = missing.length; // dry run: "would be processed"
      }
    }

    const last = rows[rows.length - 1];
    const done = rows.length < run.page_size;
    const { data: updated } = await client
      .from("entity_resolution_runs")
      .update({
        cursor_created_at: last?.created_at ?? run.cursor_created_at,
        cursor_id: last?.id ?? run.cursor_id,
        processed: run.processed + ids.length,
        created: run.created + created,
        matched: run.matched + matched,
        failed: run.failed + failed,
        status: done ? "completed" : "running",
        finished_at: done ? new Date().toISOString() : null,
        lease_until: null,
        last_error: null,
      })
      .eq("id", run.id)
      .select("*")
      .single();

    const { recordDecisionTrace } = await import("./decision-trace.server");
    await recordDecisionTrace({
      module: "entity_resolution",
      decisionType: "entity_repair_step",
      decision: { run_id: run.id, source, dry_run: run.dry_run, page: ids.length, created, matched, failed, done },
      evidence: { cursor_id: last?.id ?? null },
      actorKind: input.actorId ? "user" : "system",
      actorId: input.actorId ?? null,
    });
    return { status: done ? ("completed" as const) : ("running" as const), run: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await client
      .from("entity_resolution_runs")
      .update({ lease_until: null, last_error: message.slice(0, 500) })
      .eq("id", run.id);
    throw new Error(`Langkah perbaikan gagal: ${message}`);
  }
}

/** Retry unresolved failures for a source. */
export async function retryFailedResolutions(client: Client, input: { source: LegacyType; limit?: number }) {
  const { data, error } = await client
    .from("entity_resolution_failures")
    .select("source_id")
    .eq("source_type", input.source)
    .is("resolved_at", null)
    .order("last_attempt_at", { ascending: true })
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 500));
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => r.source_id);
  if (!ids.length) return { retried: 0, resolved: 0, stillFailing: 0 };
  const batch = await linkBatch(client, input.source, ids);
  await recordFailures(client, input.source, "", [], "");
  if (batch.failed.length) {
    const { data: existing } = await client
      .from("entity_resolution_failures")
      .select("source_id, attempts")
      .eq("source_type", input.source)
      .in("source_id", batch.failed);
    for (const row of existing ?? []) {
      await client
        .from("entity_resolution_failures")
        .update({ attempts: row.attempts + 1, error: batch.reason.slice(0, 500), last_attempt_at: new Date().toISOString() })
        .eq("source_type", input.source)
        .eq("source_id", row.source_id);
    }
  }
  await markResolved(client, input.source, ids.filter((id) => !batch.failed.includes(id)));
  return { retried: ids.length, resolved: ids.length - batch.failed.length, stillFailing: batch.failed.length };
}

/** Pause a job (keeps its cursor, frees the one-active-job slot). */
export async function pauseRepairJob(client: Client, runId: string) {
  const { error } = await client
    .from("entity_resolution_runs")
    .update({ status: "paused", lease_until: null })
    .eq("id", runId)
    .in("status", ["pending", "running"]);
  if (error) throw new Error(error.message);
  return { status: "paused" as const };
}

export async function getRepairStatus(client: Client) {
  const [{ data: runs }, { data: failures }] = await Promise.all([
    client.from("entity_resolution_runs").select("*").order("created_at", { ascending: false }).limit(20),
    client.from("entity_resolution_failures").select("source_type, resolved_at"),
  ]);
  const open: Record<string, number> = {};
  for (const row of failures ?? []) if (!row.resolved_at) open[row.source_type] = (open[row.source_type] ?? 0) + 1;
  return { runs: runs ?? [], openFailures: open };
}
