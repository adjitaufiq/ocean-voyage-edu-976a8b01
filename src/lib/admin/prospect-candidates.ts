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
  "enrichment_failed",
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
  enrichment_failed: "Gagal verifikasi",
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
    case "enrichment_failed":
      return "border-orange-400/40 bg-orange-400/10 text-orange-200";
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
  icp_reason: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
  approval_note: string | null;
  review_requested_at: string | null;
  created_at: string;
};

/**
 * RULE 1 — human approval gate.
 * Scoring alone never promotes a candidate. Allowed transitions only.
 */
export const CANDIDATE_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  discovered: ["enriching", "pending_review", "rejected"],
  enriching: ["verified", "enrichment_failed", "pending_review", "rejected"],
  verified: ["pending_review", "rejected"],
  enrichment_failed: ["enriching", "discovered", "rejected"],
  pending_review: ["approved", "rejected", "discovered"],
  approved: ["promoted", "rejected"],
  rejected: ["discovered"],
  promoted: [],
};


export function canTransition(from: CandidateStatus, to: CandidateStatus): boolean {
  return (CANDIDATE_TRANSITIONS[from] ?? []).includes(to);
}

/** RULE 2 — field ownership. Enforced in the storage layer, not just docs. */
export const FIELD_OWNERSHIP = {
  ai: [
    "why_match_icp",
    "potential_problem_hypothesis",
    "buying_signal_hypothesis",
    "suggested_solution",
    "discovery_reason",
  ],
  external: ["phone", "email", "address", "website", "business_existence"],
  human: ["approval", "sales_decision", "outcome"],
} as const;

export type FieldOwner = keyof typeof FIELD_OWNERSHIP;

export const FIELD_OWNER_LABELS: Record<FieldOwner, string> = {
  ai: "AI (dugaan & rekomendasi)",
  external: "Sumber eksternal (fakta)",
  human: "Manusia (keputusan)",
};

export function fieldOwner(field: string): FieldOwner | null {
  for (const owner of Object.keys(FIELD_OWNERSHIP) as FieldOwner[]) {
    if ((FIELD_OWNERSHIP[owner] as readonly string[]).includes(field)) return owner;
  }
  return null;
}

/** RULE 3 — ICP qualification threshold before a candidate may enter review. */
export const ICP_REVIEW_THRESHOLD = 60;


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

/**
 * RULE 3 — explainable ICP priority. "Business exists" is not "sales priority",
 * so the reason string always states which ICP signals matched.
 */
export function candidateIcpReason(
  candidate: Pick<CandidateRow, "industry" | "city" | "why_match_icp" | "potential_problem_hypothesis" | "buying_signal_hypothesis">,
  icp?: { industries?: string[]; cities?: string[]; painKeywords?: string[] },
): string {
  const reasons: string[] = [];
  const industry = (candidate.industry ?? "").toLowerCase();
  const city = (candidate.city ?? "").toLowerCase();

  const industryHit = (icp?.industries ?? []).find((item) => industry.includes(item.toLowerCase()));
  if (industryHit) reasons.push(`industri cocok ICP (${industryHit})`);
  else if (industry) reasons.push(`industri "${candidate.industry}" di luar daftar ICP`);

  const cityHit = (icp?.cities ?? []).find((item) => city.includes(item.toLowerCase()));
  if (cityHit) reasons.push(`lokasi prioritas (${cityHit})`);
  else if (city) reasons.push(`lokasi "${candidate.city}" bukan prioritas`);

  const text = [
    candidate.why_match_icp,
    candidate.potential_problem_hypothesis,
    candidate.buying_signal_hypothesis,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const painHit = (icp?.painKeywords ?? []).find((item) => item && text.includes(item.toLowerCase()));
  if (painHit) reasons.push(`sinyal masalah relevan ("${painHit}")`);
  if (!candidate.buying_signal_hypothesis) reasons.push("belum ada dugaan sinyal beli");

  return reasons.length ? reasons.join("; ") : "Belum cukup sinyal ICP untuk menilai prioritas.";
}

/** RULE 4 — audit traceability: who changed what, when, from which source, why. */
export const ACTOR_KINDS = ["ai", "external", "human", "system"] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const ACTOR_KIND_LABELS: Record<ActorKind, string> = {
  ai: "AI",
  external: "Sumber eksternal",
  human: "Manusia",
  system: "Sistem",
};

export type CandidateEventRow = {
  id: string;
  candidate_id: string;
  event: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  actor_kind: ActorKind;
  actor_label: string | null;
  data_source: string | null;
  data_source_url: string | null;
  reason: string | null;
  created_at: string;
};

/* ------------------- Data quality hardening (patch V4.1) ------------------ */

/** ISO-ish country code used inside the dedupe key. Mirrors `public.country_code`. */
export function countryCode(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || value === "indonesia" || value === "id" || value === "idn") return "ID";
  return value.replace(/[^a-z]/g, "").slice(0, 2).toUpperCase() || "ID";
}

/**
 * RULE 1 (patch) — dedupe key is region scoped: name + city + country code.
 * Prevents false duplicates between same-named businesses in different places.
 * Mirrors `public.build_dedupe_key`.
 */
export function buildDedupeKey(
  businessName: string,
  city?: string | null,
  country?: string | null,
): string {
  const name = normalizeBusinessKey(businessName).replace(/\s+/g, "_");
  const town = (normalizeBusinessKey(city ?? "") || "unknown").replace(/\s+/g, "_");
  return [name, town, countryCode(country)].join("_");
}

/** RULE 2 (patch) — every contact fact carries its provenance. */
export type ContactEntry = {
  value: string;
  source: string;
  source_url: string | null;
  verified_at: string;
};
export type ContactData = Partial<Record<"phone" | "email" | "website" | "address" | "social", ContactEntry>>;

/** Builds a provenance-complete contact entry; returns null when unprovable. */
export function contactEntry(
  value: string | null | undefined,
  source: string | null | undefined,
  sourceUrl?: string | null,
): ContactEntry | null {
  const trimmed = (value ?? "").trim();
  const src = (source ?? "").trim();
  if (!trimmed || !src) return null;
  return { value: trimmed, source: src, source_url: sourceUrl ?? null, verified_at: new Date().toISOString() };
}

export const CONTACT_CHANNEL_LABELS: Record<string, string> = {
  phone: "Telepon",
  email: "Email",
  website: "Website",
  address: "Alamat",
  social: "Sosial media",
};
