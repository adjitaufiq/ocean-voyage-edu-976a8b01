/**
 * Unified Trust Score + Entity Resolution model (client-safe).
 *
 * One number sales can read instead of four separate scores:
 *   trust = 25% ICP fit + 25% validation + 15% AI quality + 35% external verification
 * External verification carries the largest weight because it is external fact,
 * not model output. Geofencing rules (see ./geofence) apply on top.
 */
import { phoneGeoVerdict, phonesComparable, FOREIGN_PHONE_PENALTY } from "@/lib/admin/geofence";


export const TRUST_WEIGHTS = {
  fit: 0.25,
  validation: 0.25,
  quality: 0.15,
  external: 0.35,
} as const;

export const TRUST_TIERS = ["untrusted", "emerging", "trusted", "verified"] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  untrusted: "Belum tepercaya",
  emerging: "Mulai tepercaya",
  trusted: "Tepercaya",
  verified: "Terverifikasi",
};

export function trustTier(score: number): TrustTier {
  if (score >= 90) return "verified";
  if (score >= 75) return "trusted";
  if (score >= 50) return "emerging";
  return "untrusted";
}

export function trustTierClass(tier: string): string {
  switch (tier) {
    case "verified":
      return "border-primary/40 bg-primary/15 text-primary";
    case "trusted":
      return "border-accent/40 bg-accent/20 text-accent-foreground";
    case "emerging":
      return "border-border/60 bg-secondary/40 text-secondary-foreground";
    default:
      return "border-destructive/40 bg-destructive/10 text-destructive";
  }
}

export type TrustBreakdown = {
  fit_score: number;
  validation_score: number;
  quality_score: number;
  external_score: number;
  trust_score: number;
  tier: TrustTier;
  reason: string[];
  computed_at: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

export type TrustInput = {
  fitScore?: number | null;
  validationScore?: number | null;
  qualityScore?: number | null;
  externalScore?: number | null;
  reasons?: string[];
  /** Primary contact phone — checked against the target country code. */
  phone?: string | null;
  /** Extra penalty points, e.g. a social bio linking to a foreign domain. */
  penalty?: number;
};

export function computeTrust(input: TrustInput): TrustBreakdown {
  const fit = clamp(input.fitScore ?? 0);
  const validation = clamp(input.validationScore ?? 0);
  const quality = clamp(input.qualityScore ?? 0);
  const external = clamp(input.externalScore ?? 0);

  const reason = [...(input.reasons ?? [])];

  // Geofence penalty: a phone from another country is not our prospect.
  let penalty = Math.max(0, input.penalty ?? 0);
  const geo = phoneGeoVerdict(input.phone ?? null);
  if (geo.foreign) {
    penalty += FOREIGN_PHONE_PENALTY;
    reason.push(geo.reason ?? "Nomor telepon memakai kode negara asing.");
  }

  const score = clamp(
    fit * TRUST_WEIGHTS.fit +
      validation * TRUST_WEIGHTS.validation +
      quality * TRUST_WEIGHTS.quality +
      external * TRUST_WEIGHTS.external -
      penalty,
  );

  if (external === 0) reason.push("Belum ada bukti eksternal (Google Maps/website).");
  if (validation === 0) reason.push("Belum melewati validation pipeline.");
  if (fit >= 70) reason.push("Cocok dengan ICP.");

  return {
    fit_score: fit,
    validation_score: validation,
    quality_score: quality,
    external_score: external,
    trust_score: score,
    tier: trustTier(score),
    reason: reason.slice(0, 10),
    computed_at: new Date().toISOString(),
  };
}

export function parseTrustBreakdown(raw: unknown): TrustBreakdown | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value["trust_score"] === undefined) return null;
  const score = clamp(Number(value["trust_score"]));
  return {
    fit_score: clamp(Number(value["fit_score"] ?? 0)),
    validation_score: clamp(Number(value["validation_score"] ?? 0)),
    quality_score: clamp(Number(value["quality_score"] ?? 0)),
    external_score: clamp(Number(value["external_score"] ?? 0)),
    trust_score: score,
    tier: trustTier(score),
    reason: Array.isArray(value["reason"])
      ? (value["reason"] as unknown[]).map(String).filter(Boolean).slice(0, 10)
      : [],
    computed_at: String(value["computed_at"] ?? ""),
  };
}

/* ----------------------------------------------------------- entity matching */

export const MATCH_STATUSES = [
  "flagged",
  "needs_review",
  "confirmed_duplicate",
  "not_duplicate",
  "ignored",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  flagged: "Kemungkinan besar kembar",
  needs_review: "Perlu ditinjau",
  confirmed_duplicate: "Dikonfirmasi kembar",
  not_duplicate: "Bukan kembar",
  ignored: "Diabaikan",
};

/** Auto-flag threshold; below MATCH_REVIEW_MIN we ignore the pair entirely. */
export const MATCH_FLAG_MIN = 85;
export const MATCH_REVIEW_MIN = 60;

export const MATCH_SIGNAL_WEIGHTS = {
  name: 40,
  website: 25,
  phone: 20,
  email: 10,
  city: 5,
} as const;

export type EntityFacts = {
  id: string;
  nameNormalized: string;
  websiteDomain?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  placeId?: string | null;
};

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 8) return null;
  return digits.replace(/^0/, "62").slice(-11);
}

export function domainOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const host = cleaned.split(/[/?#]/)[0] ?? "";
  return host.includes(".") ? host : null;
}

/** Character-trigram similarity, mirroring the spirit of pg_trgm. */
export function nameSimilarity(a: string, b: string): number {
  const grams = (value: string) => {
    const padded = `  ${value.trim().replace(/\s+/g, " ")} `;
    const set = new Set<string>();
    for (let i = 0; i < padded.length - 2; i += 1) set.add(padded.slice(i, i + 3));
    return set;
  };
  if (!a || !b) return 0;
  if (a === b) return 1;
  const left = grams(a);
  const right = grams(b);
  let shared = 0;
  left.forEach((gram) => {
    if (right.has(gram)) shared += 1;
  });
  const union = left.size + right.size - shared;
  return union > 0 ? shared / union : 0;
}

export type MatchVerdict = {
  score: number;
  reasons: string[];
  status: MatchStatus | null;
};

export function scoreEntityMatch(a: EntityFacts, b: EntityFacts): MatchVerdict {
  const reasons: string[] = [];

  if (a.placeId && b.placeId && a.placeId === b.placeId) {
    return {
      score: 100,
      reasons: ["Google Maps place_id identik"],
      status: "flagged",
    };
  }

  const similarity = nameSimilarity(a.nameNormalized, b.nameNormalized);
  let score = similarity * MATCH_SIGNAL_WEIGHTS.name;
  if (similarity >= 0.9) reasons.push("Nama usaha hampir identik");
  else if (similarity >= 0.6) reasons.push("Nama usaha mirip");

  const domainA = domainOf(a.websiteDomain);
  const domainB = domainOf(b.websiteDomain);
  if (domainA && domainB && domainA === domainB) {
    score += MATCH_SIGNAL_WEIGHTS.website;
    reasons.push("Domain website sama");
  }

  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);
  // Geofence: never match phones across different country codes.
  if (phoneA && phoneB && phoneA === phoneB && phonesComparable(a.phone, b.phone)) {
    score += MATCH_SIGNAL_WEIGHTS.phone;
    reasons.push("Nomor telepon sama");
  }

  const emailA = a.email?.trim().toLowerCase();
  const emailB = b.email?.trim().toLowerCase();
  if (emailA && emailB && emailA === emailB) {
    score += MATCH_SIGNAL_WEIGHTS.email;
    reasons.push("Email sama");
  }

  const cityA = a.city?.trim().toLowerCase();
  const cityB = b.city?.trim().toLowerCase();
  if (cityA && cityB && cityA === cityB) {
    score += MATCH_SIGNAL_WEIGHTS.city;
    reasons.push("Kota sama");
  }

  const total = Math.round(Math.max(0, Math.min(100, score)));
  // A similar name alone is never enough for an automatic flag.
  const hasSecondSignal = reasons.length > 1;
  let status: MatchStatus | null = null;
  if (total >= MATCH_FLAG_MIN && hasSecondSignal) status = "flagged";
  else if (total >= MATCH_REVIEW_MIN) status = "needs_review";

  return { score: total, reasons, status };
}

export type EntityMatchRow = {
  id: string;
  entity_kind: string;
  prospect_a: string;
  prospect_b: string;
  similarity_score: number;
  match_reason: string[];
  status: MatchStatus;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
};
