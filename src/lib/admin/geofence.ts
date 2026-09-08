/**
 * Geofencing + cross-reference validation (client-safe).
 *
 * Prevents foreign look-alike entities (same business name, different country)
 * from polluting the local pipeline. Facts stay facts: this module only judges
 * evidence that already exists — it never invents contacts.
 */

export const TARGET_COUNTRY_CODE = "ID";
export const TARGET_DIAL_CODE = "62";

/** Trust penalty applied when a phone belongs to another country. */
export const FOREIGN_PHONE_PENALTY = 50;
/** Trust penalty when a social bio links to a different domain. */
export const SOCIAL_LINK_MISMATCH_PENALTY = 40;

export const LOCAL_KEYWORDS = [
  "indonesia",
  "jakarta",
  "bandung",
  "surabaya",
  "medan",
  "semarang",
  "yogyakarta",
  "jogja",
  "bali",
  "denpasar",
  "makassar",
  "bekasi",
  "tangerang",
  "depok",
  "bogor",
  "malang",
  "solo",
  "palembang",
  "batam",
  "+62",
  "62 8",
  "08",
  "wa.me/62",
  "ongkir",
  "gratis ongkir",
  "free ongkir",
  "cod",
  "rp",
  "idr",
  "umkm",
  "jl.",
  "jalan",
  "kota",
  "kab.",
  "kecamatan",
];

/** Strong hints that a profile belongs to another market entirely. */
export const FOREIGN_KEYWORDS = [
  "lebanon",
  "beirut",
  "dubai",
  "uae",
  "abu dhabi",
  "riyadh",
  "saudi",
  "qatar",
  "kuwait",
  "singapore",
  "malaysia",
  "kuala lumpur",
  "philippines",
  "manila",
  "bangkok",
  "thailand",
  "vietnam",
  "india",
  "pakistan",
  "usa",
  "united states",
  "london",
  "united kingdom",
  "australia",
  "sydney",
  "canada",
  "nigeria",
  "egypt",
  "turkey",
  "istanbul",
];

export type PhoneGeoVerdict = {
  /** Digits only, best-effort E.164 without the plus. */
  normalized: string | null;
  /** true when the number provably belongs to the target country. */
  local: boolean;
  /** true when the number provably belongs to another country. */
  foreign: boolean;
  dialCode: string | null;
  reason: string | null;
};

/**
 * Judges a phone number against the target country (Indonesia / +62).
 * A bare local number (08xx / 8xx) counts as local; an explicit foreign
 * country code (+1, +961, ...) is rejected.
 */
export function phoneGeoVerdict(
  raw: string | null | undefined,
  dialCode: string = TARGET_DIAL_CODE,
): PhoneGeoVerdict {
  const value = (raw ?? "").trim();
  if (!value) return { normalized: null, local: false, foreign: false, dialCode: null, reason: null };

  const hasPlus = value.startsWith("+") || value.startsWith("00");
  const digits = value.replace(/\D+/g, "").replace(/^00/, "");
  if (digits.length < 8) {
    return { normalized: null, local: false, foreign: false, dialCode: null, reason: "Nomor terlalu pendek." };
  }

  if (digits.startsWith(dialCode)) {
    return { normalized: digits, local: true, foreign: false, dialCode, reason: null };
  }

  // Local trunk format without a country code, e.g. 0812xxxx.
  if (!hasPlus && digits.startsWith("0")) {
    return { normalized: `${dialCode}${digits.slice(1)}`, local: true, foreign: false, dialCode, reason: null };
  }
  if (!hasPlus && digits.startsWith("8")) {
    return { normalized: `${dialCode}${digits}`, local: true, foreign: false, dialCode, reason: null };
  }

  const guessed = digits.slice(0, digits.length >= 11 ? 2 : 1);
  return {
    normalized: digits,
    local: false,
    foreign: true,
    dialCode: guessed,
    reason: `Kode negara +${guessed} bukan +${dialCode} (bukan nomor ${TARGET_COUNTRY_CODE}).`,
  };
}

/** True when both numbers may be compared: never match across country codes. */
export function phonesComparable(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = phoneGeoVerdict(a);
  const right = phoneGeoVerdict(b);
  if (!left.normalized || !right.normalized) return false;
  if (left.foreign !== right.foreign) return false;
  if (left.foreign && right.foreign && left.dialCode !== right.dialCode) return false;
  return true;
}

function domainOfUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const host = cleaned.split(/[/?#]/)[0] ?? "";
  return host.includes(".") ? host : null;
}

export type SocialCrossRef = {
  /** Website domain the candidate is known by. */
  candidateWebsite?: string | null;
  candidatePhone?: string | null;
  candidateEmail?: string | null;
  /** Link found in the social profile bio. */
  bioLink?: string | null;
  bio?: string | null;
};

export type SocialVerdict = {
  status: "verified" | "mismatch_social" | "rejected_foreign_entity" | "unverified";
  penalty: number;
  matches: string[];
  reasons: string[];
};

/**
 * Cross-references a social profile against the candidate's own facts.
 * Handle/name similarity alone is never enough.
 */
export function crossReferenceSocial(input: SocialCrossRef): SocialVerdict {
  const matches: string[] = [];
  const reasons: string[] = [];
  let penalty = 0;

  const bio = (input.bio ?? "").toLowerCase();

  // 3. Geographic keywords — a bio that only speaks of another market is out.
  const localHit = LOCAL_KEYWORDS.some((word) => bio.includes(word));
  const foreignHit = FOREIGN_KEYWORDS.find((word) => bio.includes(word));
  if (foreignHit && !localHit) {
    return {
      status: "rejected_foreign_entity",
      penalty: 100,
      matches: [],
      reasons: [`Bio menyebut "${foreignHit}" tanpa kaitan Indonesia.`],
    };
  }
  if (localHit) matches.push("Bio menyebut lokasi/indikator Indonesia");

  // 2. Contact check in bio — a foreign country code is an instant reject.
  const bioPhone = bio.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[1] ?? null;
  if (bioPhone) {
    const verdict = phoneGeoVerdict(bioPhone);
    if (verdict.foreign) {
      return {
        status: "rejected_foreign_entity",
        penalty: 100,
        matches: [],
        reasons: [verdict.reason ?? "Nomor di bio memakai kode negara asing."],
      };
    }
    const candidate = phoneGeoVerdict(input.candidatePhone);
    if (candidate.normalized && verdict.normalized) {
      if (candidate.normalized.slice(-9) === verdict.normalized.slice(-9)) {
        matches.push("Nomor di bio cocok dengan kontak kandidat");
      } else {
        reasons.push("Nomor di bio berbeda dengan kontak kandidat.");
      }
    }
  }

  const candidateEmail = input.candidateEmail?.trim().toLowerCase();
  if (candidateEmail && bio.includes(candidateEmail)) matches.push("Email di bio cocok");

  // 1. Bio link check.
  const candidateDomain = domainOfUrl(input.candidateWebsite);
  const bioDomain = domainOfUrl(input.bioLink);
  if (candidateDomain && bioDomain) {
    const same =
      bioDomain === candidateDomain ||
      bioDomain.endsWith(`.${candidateDomain}`) ||
      candidateDomain.endsWith(`.${bioDomain}`) ||
      // linktree-style aggregators are not proof, but not a mismatch either
      /linktr\.ee|linkin\.bio|bit\.ly|wa\.me|beacons\.ai/.test(bioDomain);
    if (same) {
      matches.push("Link bio mengarah ke domain kandidat");
    } else {
      penalty += SOCIAL_LINK_MISMATCH_PENALTY;
      reasons.push(`Link bio (${bioDomain}) berbeda dengan domain kandidat (${candidateDomain}).`);
      return { status: "mismatch_social", penalty, matches, reasons };
    }
  }

  if (matches.length === 0) {
    return {
      status: "unverified",
      penalty: 0,
      matches,
      reasons: reasons.length > 0 ? reasons : ["Tidak ada bukti silang selain nama akun."],
    };
  }

  return { status: "verified", penalty, matches, reasons };
}

/**
 * Region-isolated search query for external scrapers.
 * Never a bare business name — always scoped to city + country.
 */
export function buildScopedSearchQuery(input: {
  businessName: string;
  city?: string | null;
  country?: string | null;
  includeDialCode?: boolean;
}): string {
  const parts = [`"${input.businessName.trim()}"`];
  const city = input.city?.trim();
  if (city) parts.push(`"${city}"`);
  const country = input.country?.trim() || "Indonesia";
  parts.push(`"${country}"`);
  if (input.includeDialCode) parts.push(`"+${TARGET_DIAL_CODE}"`);
  return parts.join(" ");
}
