/**
 * Candidate layer — client-safe model (V4 sales intelligence pipeline).
 *
 * A candidate is an AI *hypothesis* about a business. It never holds contact
 * facts: phone, email, address, maps URL and social URLs may only be written
 * by the external verification layer. Candidates cannot be contacted and never
 * appear in the daily sales queue — they must be promoted to a prospect first.
 */

export const CANDIDATE_STATUSES = [
  "discovered",
  "enriching",
  "verified",
  "pending_review",
  "approved",
  "rejected",
  "promoted",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  discovered: "Kandidat baru",
  enriching: "Sedang diverifikasi",
  verified: "Terverifikasi",
  pending_review: "Menunggu tinjauan",
  approved: "Disetujui",
  rejected: "Ditolak",
  promoted: "Sudah jadi prospek",
};

export function candidateStatusClass(status: CandidateStatus): string {
  switch (status) {
    case "verified":
      return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
    case "pending_review":
      return "border-amber-400/40 bg-amber-400/10 text-amber-200";
    case "approved":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";
    case "enriching":
      return "border-sky-400/40 bg-sky-400/10 text-sky-200";
    case "promoted":
      return "border-primary/40 bg-primary/10 text-primary";
    case "rejected":
      return "border-rose-400/40 bg-rose-400/10 text-rose-200";
    default:
      return "border-border/50 bg-muted/20 text-muted-foreground";
  }
}


export const DUPLICATE_STATUSES = ["unchecked", "unique", "suspected", "duplicate"] as const;
export type DuplicateStatus = (typeof DUPLICATE_STATUSES)[number];

export const DUPLICATE_STATUS_LABELS: Record<DuplicateStatus, string> = {
  unchecked: "Belum dicek",
  unique: "Unik",
  suspected: "Diduga kembar",
  duplicate: "Duplikat",
};

export const DISCOVERY_METHODS = ["ai_discovery", "manual", "import", "apify_search"] as const;
export type DiscoveryMethod = (typeof DISCOVERY_METHODS)[number];

export const DISCOVERY_METHOD_LABELS: Record<DiscoveryMethod, string> = {
  ai_discovery: "AI discovery",
  manual: "Input manual",
  import: "Import",
  apify_search: "Pencarian eksternal",
};

/** A candidate row as rendered in the Candidate Inbox. */
export type CandidateRow = {
  id: string;
  campaign_id: string | null;
  business_name: string;
  industry: string | null;
  city: string | null;
  country: string;
  why_match_icp: string | null;
  potential_problem_hypothesis: string | null;
  buying_signal_hypothesis: string | null;
  suggested_solution: string | null;
  discovery_reason: string | null;
  discovery_method: DiscoveryMethod;
  discovery_query: string | null;
  discovery_source: string | null;
  candidate_status: CandidateStatus;
  duplicate_status: DuplicateStatus;
  duplicate_of: string | null;
  icp_score: number;
  trust_score: number;
  rejected_reason: string | null;
  promoted_prospect_id: string | null;
  created_at: string;
};

/** Fact fields an AI answer may never provide on a candidate. */
export const AI_FORBIDDEN_CANDIDATE_FIELDS = [
  "phone",
  "whatsapp",
  "email",
  "address",
  "website",
  "googleMapsUrl",
  "socialMedia",
  "instagram",
  "linkedin",
  "facebook",
  "verified",
  "source",
  "sourceUrl",
] as const;

/**
 * Deterministic ICP fit for a candidate. Only hypothesis-level signals are
 * available at this stage, so the ceiling is intentionally low — external
 * verification is what unlocks a high trust score later.
 */
export function candidateIcpScore(
  candidate: Pick<
    CandidateRow,
    | "industry"
    | "city"
    | "why_match_icp"
    | "potential_problem_hypothesis"
    | "buying_signal_hypothesis"
    | "suggested_solution"
  >,
  icp?: { industries?: string[]; cities?: string[]; painKeywords?: string[] },
): number {
  let score = 0;
  const industry = (candidate.industry ?? "").toLowerCase();
  const city = (candidate.city ?? "").toLowerCase();

  if (industry) score += 10;
  if (city) score += 10;
  if ((icp?.industries ?? []).some((item) => industry.includes(item.toLowerCase()))) score += 20;
  if ((icp?.cities ?? []).some((item) => city.includes(item.toLowerCase()))) score += 15;

  const text = [
    candidate.why_match_icp,
    candidate.potential_problem_hypothesis,
    candidate.buying_signal_hypothesis,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if ((icp?.painKeywords ?? []).some((item) => item && text.includes(item.toLowerCase())))
    score += 15;

  if ((candidate.why_match_icp ?? "").length > 40) score += 10;
  if ((candidate.potential_problem_hypothesis ?? "").length > 40) score += 10;
  if ((candidate.buying_signal_hypothesis ?? "").length > 30) score += 5;
  if ((candidate.suggested_solution ?? "").length > 5) score += 5;

  return Math.max(0, Math.min(100, score));
}

/** Normalised business name, mirrors the database function of the same purpose. */
export function normalizeBusinessKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(pt|cv|ud|pd|tbk|persero|inc|llc|ltd|co|corp|company|indonesia)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
