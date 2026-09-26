/**
 * Entity review helpers — pure, client-safe (Phase 2B).
 * Risk classification + signal summary for the match review queue, and
 * canonical-chain resolution for replaced business entities.
 */

export type ReviewRisk = "high" | "medium" | "low";

export const REVIEW_RISK_LABELS: Record<ReviewRisk, string> = {
  high: "Risiko tinggi",
  medium: "Risiko sedang",
  low: "Risiko rendah",
};

/**
 * high   = shared contact (franchise / agency risk) or weak fuzzy score
 * medium = fuzzy name+location between 80 and 89, or a suggestion under 95
 * low    = identity suggestion (name + city + address) at 95+
 */
export function classifyReviewRisk(method: string, confidence: number): ReviewRisk {
  if (method === "verified_contact") return "high";
  if (method === "fuzzy") return confidence >= 80 ? "medium" : "high";
  if (method === "business_identity") return confidence >= 95 ? "low" : "medium";
  return "medium";
}

type Scores = { name?: number; city?: number; address?: number; category?: number };

/** Human-readable matching signals from an entity_match_history comparison. */
export function summarizeSignals(method: string, comparison: unknown): string[] {
  const c = (comparison && typeof comparison === "object" ? comparison : {}) as Record<string, unknown>;
  const out: string[] = [];
  if (method === "verified_contact") {
    if (c["phone"]) out.push(`Telepon sama: ${String(c["phone"])}`);
    if (c["email"]) out.push(`Email sama: ${String(c["email"])}`);
    return out.length ? out : ["Kontak sama"];
  }
  const scores = (c["scores"] ?? {}) as Scores;
  const pct = (v: number | undefined) => `${Math.round((v ?? 0) * 100)}%`;
  if (scores.name !== undefined) out.push(`Nama ${pct(scores.name)}`);
  if (scores.city) out.push(`Kota ${pct(scores.city)}`);
  if (scores.address) out.push(`Alamat ${pct(scores.address)}`);
  if (scores.category) out.push(`Kategori ${pct(scores.category)}`);
  if (c["google_place_id"]) out.push("ID tempat Google sama");
  if (c["website_domain"]) out.push(`Domain sama: ${String(c["website_domain"])}`);
  return out;
}

/** Follow replaced_by links to the active entity; stops on cycles or after 5 hops. */
export function resolveCanonicalChain(
  replacedBy: Map<string, string | null>,
  entityId: string,
): string {
  let current = entityId;
  const seen = new Set<string>([current]);
  for (let i = 0; i < 5; i += 1) {
    const next = replacedBy.get(current);
    if (!next || seen.has(next)) break;
    seen.add(next);
    current = next;
  }
  return current;
}
