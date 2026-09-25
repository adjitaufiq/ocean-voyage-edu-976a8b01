/**
 * Pure helpers for the Decision Observability layer. They only DESCRIBE a
 * decision for tracing; they never influence what the app decides.
 */

export type AssistantDecisionKind = "package_recommendation" | "next_action" | "follow_up_strategy" | "objection_response";

const PATTERNS: Record<AssistantDecisionKind, RegExp> = {
  package_recommendation: /\b(paket|package|starter|growth|business|enterprise|custom system|qresto)\b/i,
  next_action: /\b(langkah (berikut|selanjutnya)|next (step|action)|sebaiknya|rekomendasi(ku)? aksi|lakukan)\b/i,
  follow_up_strategy: /\b(follow[- ]?up|tindak lanjut|hubungi (lagi|kembali)|reminder|jadwalkan)\b/i,
  objection_response: /\b(keberatan|objection|terlalu mahal|kemahalan|pikir[- ]pikir dulu|belum butuh|tidak ada budget)\b/i,
};

/** Which decision kinds an assistant reply contains (empty = no decision). */
export function classifyAssistantReply(text: string): AssistantDecisionKind[] {
  if (!text) return [];
  return (Object.keys(PATTERNS) as AssistantDecisionKind[]).filter((k) => PATTERNS[k].test(text));
}

/** Kind of decision behind a confirmed Sales Assistant action. */
export function assistantActionDecision(actionType: string): AssistantDecisionKind | "task" | "lead_status" {
  if (actionType === "create_followup_task") return "follow_up_strategy";
  if (actionType === "update_lead_status") return "lead_status";
  if (actionType === "save_sales_activity") return "next_action";
  return "task";
}

type Named = { name?: string | null } | string;
const names = (list: unknown): string[] =>
  Array.isArray(list)
    ? (list as Named[]).map((x) => (typeof x === "string" ? x : String(x?.name ?? ""))).filter(Boolean)
    : [];

/** Diff of the decision-relevant fields of a proposal edit. */
export function proposalDecisionDiff(
  before: { recommended_package?: string | null; core_features?: unknown; enhancements?: unknown },
  after: { recommended_package?: string | null; core_features?: unknown; enhancements?: unknown },
) {
  const bf = names(before.core_features);
  const af = names(after.core_features);
  const be = names(before.enhancements);
  const ae = names(after.enhancements);
  const packageChanged = (before.recommended_package ?? null) !== (after.recommended_package ?? null);
  const featuresAdded = af.filter((f) => !bf.includes(f));
  const featuresRemoved = bf.filter((f) => !af.includes(f));
  const enhancementsAdded = ae.filter((f) => !be.includes(f));
  const enhancementsRemoved = be.filter((f) => !ae.includes(f));
  return {
    packageChanged,
    packageFrom: before.recommended_package ?? null,
    packageTo: after.recommended_package ?? null,
    featuresAdded,
    featuresRemoved,
    enhancementsAdded,
    enhancementsRemoved,
    featuresChanged:
      featuresAdded.length + featuresRemoved.length + enhancementsAdded.length + enhancementsRemoved.length > 0,
  };
}
