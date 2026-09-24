/**
 * Unified pipeline cutover — SERVER ONLY (Phase A).
 * Mode is stored in the existing prospect_job_state table (no new config table).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { parseUnifiedMode, UNIFIED_MODE_KEY, type UnifiedMode } from "@/lib/admin/unified-cutover";

type Client = SupabaseClient<Database>;

export async function getUnifiedMode(supabase: Client): Promise<UnifiedMode> {
  const { data } = await supabase
    .from("prospect_job_state")
    .select("last_status")
    .eq("key", UNIFIED_MODE_KEY)
    .maybeSingle();
  return parseUnifiedMode(data?.last_status);
}

export async function setUnifiedMode(supabase: Client, mode: UnifiedMode, actor: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("prospect_job_state").upsert(
    { key: UNIFIED_MODE_KEY, last_status: mode, detail: `diubah oleh ${actor}`.slice(0, 500), last_run_at: now, updated_at: now } as never,
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
}

export type ActiveAnalysis = {
  id: string;
  version: number;
  stale: boolean;
  engineVersion: string | null;
  sourceRevision: number | null;
  row: Record<string, unknown>;
};

/** candidate id -> entity id (active links only). */
export async function entityIdsForCandidates(supabase: Client, candidateIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!candidateIds.length) return map;
  const { data } = await supabase
    .from("business_entity_links")
    .select("business_entity_id, legacy_id")
    .eq("legacy_type", "prospect_candidate")
    .eq("is_active", true)
    .in("legacy_id", candidateIds);
  for (const row of data ?? []) map.set(row.legacy_id, row.business_entity_id);
  return map;
}

/** Latest completed analysis per entity; stale when stale_reason is set. */
export async function loadActiveAnalyses(supabase: Client, entityIds: string[]): Promise<Map<string, ActiveAnalysis>> {
  const map = new Map<string, ActiveAnalysis>();
  if (!entityIds.length) return map;
  const { data, error } = await supabase
    .from("business_consultant_analyses")
    .select("*")
    .in("business_entity_id", [...new Set(entityIds)])
    .eq("status", "completed")
    .order("version", { ascending: false });
  if (error) throw new Error(error.message);
  for (const raw of (data ?? []) as unknown as Record<string, unknown>[]) {
    const entityId = String(raw["business_entity_id"]);
    if (map.has(entityId)) continue;
    map.set(entityId, {
      id: String(raw["id"]),
      version: Number(raw["version"] ?? 0),
      stale: Boolean(raw["stale_reason"]),
      engineVersion: (raw["engine_version"] as string | null) ?? null,
      sourceRevision: raw["source_revision"] == null ? null : Number(raw["source_revision"]),
      row: raw,
    });
  }
  return map;
}
