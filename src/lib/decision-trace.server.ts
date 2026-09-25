/**
 * Decision Observability Layer (Step 1) — write-only tracing.
 *
 * Records WHICH module decided WHAT (problem / solution / package / strategy)
 * and on which evidence. It never changes business behaviour: every write is
 * wrapped so a failure is swallowed and logged, never thrown to the caller.
 */

export type LegacyType = "prospect_candidate" | "prospect" | "consultation" | "ai_conversation" | "client";

export type DecisionTraceInput = {
  entityId?: string | null;
  legacyType?: LegacyType | null;
  legacyId?: string | null;
  module: string;
  decisionType: string;
  decision: unknown;
  analysisId?: string | null;
  analysisVersion?: number | null;
  engineVersion?: string | null;
  evidence?: unknown;
  confidence?: number | null;
  actorKind?: "system" | "user" | "ai" | "customer";
  actorId?: string | null;
  override?: unknown;
};

/** Pure: build the row written to decision_traces (exported for tests). */
export function buildTraceRow(input: DecisionTraceInput, entityId: string | null) {
  const confidence =
    typeof input.confidence === "number" && Number.isFinite(input.confidence) ? input.confidence : null;
  return {
    business_entity_id: entityId,
    legacy_type: input.legacyType ?? null,
    legacy_id: input.legacyId ?? null,
    source_module: input.module,
    decision_type: input.decisionType,
    decision_output: (input.decision ?? {}) as never,
    analysis_id: input.analysisId ?? null,
    analysis_version: input.analysisVersion ?? null,
    engine_version: input.engineVersion ?? null,
    evidence_source: (input.evidence ?? null) as never,
    confidence,
    actor_kind: input.actorKind ?? "system",
    actor_id: input.actorId ?? null,
    override_info: (input.override ?? null) as never,
  };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

async function resolveEntities(
  db: { from: (t: string) => any },
  legacyType: LegacyType,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await db
    .from("business_entity_links")
    .select("legacy_id, business_entity_id")
    .eq("legacy_type", legacyType)
    .eq("is_active", true)
    .in("legacy_id", ids);
  for (const row of (data ?? []) as { legacy_id: string; business_entity_id: string }[]) {
    map.set(row.legacy_id, row.business_entity_id);
  }
  return map;
}

/** Record many traces; never throws. */
export async function recordDecisionTraces(inputs: DecisionTraceInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const db = await admin();
    const byType = new Map<LegacyType, string[]>();
    for (const t of inputs) {
      if (!t.entityId && t.legacyType && t.legacyId) {
        byType.set(t.legacyType, [...(byType.get(t.legacyType) ?? []), t.legacyId]);
      }
    }
    const resolved = new Map<string, string>();
    for (const [type, ids] of byType) {
      const m = await resolveEntities(db, type, [...new Set(ids)].slice(0, 500));
      for (const [k, v] of m) resolved.set(`${type}:${k}`, v);
    }
    // Enrichment only: a chatbot conversation resolves through its lead.
    const unresolvedConv = inputs
      .filter((t) => !t.entityId && t.legacyType === "ai_conversation" && t.legacyId && !resolved.has(`ai_conversation:${t.legacyId}`))
      .map((t) => t.legacyId as string);
    if (unresolvedConv.length > 0) {
      const { data: convs } = await db.from("ai_conversations").select("id, lead_id").in("id", [...new Set(unresolvedConv)]);
      const leadByConv = new Map<string, string>();
      for (const c of (convs ?? []) as { id: string; lead_id: string | null }[]) if (c.lead_id) leadByConv.set(c.id, c.lead_id);
      const leadEntities = await resolveEntities(db, "consultation", [...new Set(leadByConv.values())]);
      for (const [conv, lead] of leadByConv) {
        const e = leadEntities.get(lead);
        if (e) resolved.set(`ai_conversation:${conv}`, e);
      }
    }
    const rows = inputs.map((t) =>
      buildTraceRow(
        t,
        t.entityId ?? (t.legacyType && t.legacyId ? resolved.get(`${t.legacyType}:${t.legacyId}`) ?? null : null),
      ),
    );
    const { error } = await db.from("decision_traces").insert(rows);
    if (error) console.warn("[decision-trace] insert failed", error.message);
  } catch (error) {
    console.warn("[decision-trace] skipped", (error as Error).message);
  }
}

/** Record one trace; never throws. */
export function recordDecisionTrace(input: DecisionTraceInput): Promise<void> {
  return recordDecisionTraces([input]);
}
