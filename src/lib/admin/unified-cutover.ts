/**
 * Unified pipeline cutover (Phase A) — pure rules, safe on client and server.
 *
 * Modes:
 *  - off:    legacy behaviour only (rollback position).
 *  - shadow: Consultant Analysis runs + provenance is recorded, but legacy
 *            rules still write the material and nothing is blocked.
 *  - on:     Sales Preparation takes problem/solution/package from the current
 *            Consultant Analysis and Ready Outreach is BLOCKED when the
 *            entity/analysis/version checks fail.
 */
export const UNIFIED_MODES = ["off", "shadow", "on"] as const;
export type UnifiedMode = (typeof UNIFIED_MODES)[number];
export const UNIFIED_MODE_KEY = "unified_pipeline_mode";

export const UNIFIED_MODE_LABELS: Record<UnifiedMode, string> = {
  off: "Mati — aturan lama",
  shadow: "Uji coba — analisis jalan, aturan lama tetap dipakai",
  on: "Aktif — keputusan dari analisis konsultan",
};

export function parseUnifiedMode(value: unknown): UnifiedMode {
  return UNIFIED_MODES.includes(value as UnifiedMode) ? (value as UnifiedMode) : "off";
}

export type DecisionSource = "consultant_analysis" | "legacy_rules" | "legacy_fallback";

export const UNIFIED_BLOCKERS = [
  "no_entity",
  "no_active_analysis",
  "analysis_stale",
  "version_mismatch",
] as const;
export type UnifiedBlocker = (typeof UNIFIED_BLOCKERS)[number];

export const UNIFIED_BLOCKER_LABELS: Record<UnifiedBlocker, string> = {
  no_entity: "Belum terhubung ke identitas bisnis",
  no_active_analysis: "Belum ada analisis konsultan aktif",
  analysis_stale: "Analisis bisnis sudah berubah, perlu diperbarui",
  version_mismatch: "Materi dibuat dari versi analisis lama",
};

export type UnifiedGateInput = {
  entityId: string | null;
  analysis: { id: string; version: number; stale: boolean } | null;
  preparation: { analysisId: string | null; analysisVersion: number | null } | null;
};

/** Checks required before Ready Outreach when unified mode is ON. */
export function unifiedReadyBlockers(input: UnifiedGateInput): UnifiedBlocker[] {
  if (!input.entityId) return ["no_entity"];
  if (!input.analysis) return ["no_active_analysis"];
  const out: UnifiedBlocker[] = [];
  if (input.analysis.stale) out.push("analysis_stale");
  if (
    !input.preparation ||
    input.preparation.analysisId !== input.analysis.id ||
    input.preparation.analysisVersion !== input.analysis.version
  ) {
    out.push("version_mismatch");
  }
  return out;
}

type Jsonish = unknown;
function firstText(value: Jsonish): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstText(item);
      if (text) return text;
    }
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["statement", "summary", "label", "name", "title", "text", "value"]) {
      if (typeof obj[key] === "string" && obj[key]) return obj[key] as string;
    }
  }
  return null;
}

function listText(value: Jsonish, max = 5): string[] {
  if (!Array.isArray(value)) return firstText(value) ? [firstText(value)!] : [];
  return value.map(firstText).filter((x): x is string => Boolean(x)).slice(0, max);
}

export type AnalysisDecision = {
  problem: string | null;
  solution: string | null;
  features: string[];
  packageName: string | null;
  reason: string;
};

/** Maps a stored Consultant Analysis row into the fields Sales Prep formats. */
export function decisionFromAnalysis(row: Record<string, unknown>): AnalysisDecision {
  const confirmed = listText(row["confirmed_problems"], 3);
  const hypotheses = listText(row["problem_hypotheses"], 3);
  const problem = confirmed[0] ?? (hypotheses[0] ? `Dugaan (belum dikonfirmasi): ${hypotheses[0]}` : null);
  return {
    problem,
    solution: firstText(row["core_solution"]),
    features: listText(row["recommended_features"], 6),
    packageName: firstText(row["recommended_package"]),
    reason: firstText(row["consultant_reasoning"]) ?? firstText(row["sales_angle"]) ?? "Dari analisis konsultan.",
  };
}
