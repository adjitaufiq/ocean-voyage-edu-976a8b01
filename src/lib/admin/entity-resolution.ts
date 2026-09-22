/**
 * Entity Resolution — pure matching logic (client-safe, Phase 2).
 *
 * Decides which Business Entity a legacy record belongs to. It NEVER merges
 * or deletes anything: the strongest result is a link, the weakest is a
 * review queue entry for a human.
 */

export const MATCH_METHODS = [
  "google_place_id",
  "website_domain",
  "verified_contact",
  "business_identity",
  "fuzzy",
  "promoted_link",
  "new_entity",
] as const;
export type MatchMethod = (typeof MATCH_METHODS)[number];

export const MATCH_STATUSES = [
  "auto_matched",
  "suggested",
  "review_required",
  "rejected",
  "created",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const MATCH_METHOD_LABELS: Record<MatchMethod, string> = {
  google_place_id: "ID tempat Google sama",
  website_domain: "Domain situs sama",
  verified_contact: "Kontak terverifikasi sama",
  business_identity: "Nama + kota + alamat sama",
  fuzzy: "Nama & lokasi mirip",
  promoted_link: "Kandidat sudah dipromosikan ke prospek ini",
  new_entity: "Bisnis baru",
};

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  auto_matched: "Cocok otomatis",
  suggested: "Saran cocok",
  review_required: "Perlu ditinjau",
  rejected: "Ditolak",
  created: "Bisnis baru dibuat",
};

/** Attributes we can compare across every legacy source. */
export type EntitySignals = {
  name: string;
  normalizedName: string | null;
  city: string | null;
  province: string | null;
  address: string | null;
  category: string | null;
  website: string | null;
  websiteDomain: string | null;
  googlePlaceId: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
};

export type EntityCandidateRow = EntitySignals & { id: string };

export type MatchResult = {
  entityId: string | null;
  method: MatchMethod;
  status: MatchStatus;
  confidence: number;
  reason: string;
  comparison: Record<string, unknown>;
};

const GENERIC_WORDS = new Set([
  "pt",
  "cv",
  "ud",
  "pd",
  "tbk",
  "persero",
  "inc",
  "llc",
  "ltd",
  "co",
  "corp",
  "company",
  "indonesia",
  "the",
  "toko",
  "warung",
]);

/** lowercase, strip legal/filler words and punctuation. */
export function normalizeName(raw: string | null | undefined): string | null {
  const base = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!base) return null;
  const words = base.split(" ").filter((w) => w && !GENERIC_WORDS.has(w));
  const value = (words.length ? words : base.split(" ")).join(" ").trim();
  return value || null;
}

/** https://WWW.Toko.co.id/menu/ -> toko.co.id */
export function normalizeDomain(raw: string | null | undefined): string | null {
  let value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split(/[/?#]/)[0] ?? "";
  value = value.replace(/\.+$/, "").replace(/:\d+$/, "");
  if (!value || !value.includes(".")) return null;
  return value;
}

/** Indonesian phone numbers to a comparable +62 form; null when unusable. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  let value = digits.replace(/^\+/, "");
  if (value.startsWith("0")) value = `62${value.slice(1)}`;
  if (value.startsWith("620")) value = `62${value.slice(3)}`;
  if (value.length < 9 || value.length > 16) return null;
  return value;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value.includes("@") || value.length < 6) return null;
  // Generic inbox on a shared provider is not an identity signal.
  return value;
}

export function normalizeText(raw: string | null | undefined): string | null {
  const value = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return value || null;
}

/** Dice coefficient on bigrams, 0..1. */
export function similarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const grams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i += 1) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  let hits = 0;
  for (const [g, count] of ga) {
    const other = gb.get(g);
    if (other) hits += Math.min(count, other);
  }
  const total = a.length - 1 + (b.length - 1);
  return total === 0 ? 0 : (2 * hits) / total;
}

export const FUZZY_REVIEW_MIN = 0.72;
export const IDENTITY_SUGGEST_MIN = 0.9;

/**
 * Levels 1-5 in priority order. Returns the first decisive answer.
 * Never returns a merge instruction — only link / suggest / review.
 */
export function matchEntity(signals: EntitySignals, pool: EntityCandidateRow[]): MatchResult {
  const placeId = signals.googlePlaceId?.trim() || null;
  if (placeId) {
    const hit = pool.find((row) => row.googlePlaceId && row.googlePlaceId === placeId);
    if (hit) {
      return {
        entityId: hit.id,
        method: "google_place_id",
        status: "auto_matched",
        confidence: 100,
        reason: MATCH_METHOD_LABELS.google_place_id,
        comparison: { google_place_id: placeId },
      };
    }
  }

  const domain = signals.websiteDomain ?? normalizeDomain(signals.website);
  if (domain) {
    const hit = pool.find((row) => (row.websiteDomain ?? normalizeDomain(row.website)) === domain);
    if (hit) {
      return {
        entityId: hit.id,
        method: "website_domain",
        status: "auto_matched",
        confidence: 95,
        reason: MATCH_METHOD_LABELS.website_domain,
        comparison: { website_domain: domain },
      };
    }
  }

  const phones = [normalizePhone(signals.phone), normalizePhone(signals.whatsapp)].filter(
    (v): v is string => Boolean(v),
  );
  const email = normalizeEmail(signals.email);
  if (phones.length || email) {
    const hit = pool.find((row) => {
      const rowPhones = [normalizePhone(row.phone), normalizePhone(row.whatsapp)].filter(Boolean);
      if (phones.some((p) => rowPhones.includes(p))) return true;
      const rowEmail = normalizeEmail(row.email);
      return Boolean(email && rowEmail && rowEmail === email);
    });
    if (hit) {
      return {
        entityId: hit.id,
        method: "verified_contact",
        status: "auto_matched",
        confidence: 90,
        reason: MATCH_METHOD_LABELS.verified_contact,
        comparison: { phone: phones[0] ?? null, email },
      };
    }
  }

  const name = signals.normalizedName ?? normalizeName(signals.name);
  const city = normalizeText(signals.city);
  const address = normalizeText(signals.address);
  const category = normalizeText(signals.category);

  let best: { row: EntityCandidateRow; score: number; parts: Record<string, number> } | null = null;
  for (const row of pool) {
    const rowName = row.normalizedName ?? normalizeName(row.name);
    const nameScore = similarity(name, rowName);
    if (nameScore < 0.5) continue;
    const cityScore = city && normalizeText(row.city) ? similarity(city, normalizeText(row.city)) : 0;
    const addressScore =
      address && normalizeText(row.address) ? similarity(address, normalizeText(row.address)) : 0;
    const categoryScore =
      category && normalizeText(row.category)
        ? similarity(category, normalizeText(row.category))
        : 0;
    // Weighted average over the signals both sides actually have, so a
    // missing address never silently drags a strong name+city match down.
    let weight = 0.6;
    let sum = nameScore * 0.6;
    if (city && normalizeText(row.city)) {
      weight += 0.25;
      sum += cityScore * 0.25;
    }
    if (address && normalizeText(row.address)) {
      weight += 0.1;
      sum += addressScore * 0.1;
    }
    if (category && normalizeText(row.category)) {
      weight += 0.05;
      sum += categoryScore * 0.05;
    }
    const score = sum / weight;
    if (!best || score > best.score) {
      best = {
        row,
        score,
        parts: { name: nameScore, city: cityScore, address: addressScore, category: categoryScore },
      };
    }
  }

  if (best) {
    const confidence = Math.round(best.score * 100);
    const comparison = {
      name: { source: name, entity: best.row.normalizedName ?? normalizeName(best.row.name) },
      city: { source: signals.city, entity: best.row.city },
      address: { source: signals.address, entity: best.row.address },
      category: { source: signals.category, entity: best.row.category },
      scores: best.parts,
    };
    if (best.score >= IDENTITY_SUGGEST_MIN) {
      return {
        entityId: best.row.id,
        method: "business_identity",
        status: "suggested",
        confidence,
        reason: MATCH_METHOD_LABELS.business_identity,
        comparison,
      };
    }
    if (best.score >= FUZZY_REVIEW_MIN) {
      return {
        entityId: best.row.id,
        method: "fuzzy",
        status: "review_required",
        confidence,
        reason: MATCH_METHOD_LABELS.fuzzy,
        comparison,
      };
    }
  }

  return {
    entityId: null,
    method: "new_entity",
    status: "created",
    confidence: 0,
    reason: MATCH_METHOD_LABELS.new_entity,
    comparison: {},
  };
}
