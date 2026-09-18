/**
 * Prospect Qualification Intelligence — client-safe rules (Prompt 4.4).
 *
 * Turns a raw discovery candidate into a validated sales opportunity:
 * business validation -> digital gap analysis -> lead scoring -> reasoning.
 * Everything here is deterministic and testable without a database, so the
 * numbers shown to sales can always be explained.
 */

import { countryCode } from "@/lib/admin/prospect-candidates";
import { phoneGeoVerdict } from "@/lib/admin/geofence";
import {
  categoryMatches,
  screenPlace,
  type LeadTemperature,
  type WebsiteStatus,
} from "@/lib/admin/discovery";

/* ------------------------------ PART 1 ---------------------------------- */

export const VALIDATION_STATUSES = ["pending", "validated", "rejected"] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  pending: "Belum divalidasi",
  validated: "Tervalidasi",
  rejected: "Ditolak",
};

export function validationStatusClass(status: ValidationStatus): string {
  switch (status) {
    case "validated":
      return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
    case "rejected":
      return "border-rose-400/40 bg-rose-400/10 text-rose-200";
    default:
      return "border-border/50 bg-muted/20 text-muted-foreground";
  }
}

export const VALIDATION_CHECK_KEYS = [
  "business_exists",
  "location_valid",
  "category_match",
  "business_active",
  "not_duplicate",
  "contact_valid",
  "country_allowed",
] as const;
export type ValidationCheckKey = (typeof VALIDATION_CHECK_KEYS)[number];

export const VALIDATION_CHECK_LABELS: Record<ValidationCheckKey, string> = {
  business_exists: "Bisnis benar ada",
  location_valid: "Lokasi valid",
  category_match: "Kategori sesuai kampanye",
  business_active: "Bisnis masih aktif",
  not_duplicate: "Bukan duplikat",
  contact_valid: "Data kontak valid",
  country_allowed: "Negara sesuai aturan",
};

export type ValidationCheck = {
  key: ValidationCheckKey;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
};

export type ContactEntryLike = { value?: string | null; source?: string | null };

export type QualificationInput = {
  businessName: string;
  category: string | null;
  industry?: string | null;
  address: string | null;
  city: string | null;
  province?: string | null;
  country: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone: string | null;
  website: string | null;
  websiteStatus: WebsiteStatus;
  rating: number | null;
  reviewCount: number | null;
  placeId?: string | null;
  googleMapsUrl?: string | null;
  permanentlyClosed: boolean;
  duplicateStatus?: string | null;
  contactData?: Record<string, ContactEntryLike> | null;
  socialActive?: boolean | null;
  targetCategories?: string[];
  targetCities?: string[];
};

export type ValidationResult = {
  status: ValidationStatus;
  reason: string;
  checks: ValidationCheck[];
};

function hasContact(input: QualificationInput): boolean {
  if (input.phone) return true;
  const data = input.contactData ?? {};
  return Object.values(data).some((entry) => Boolean(entry?.value && entry?.source));
}

/** PART 1 — business validation. A blocking failure rejects the candidate. */
export function validateCandidate(input: QualificationInput): ValidationResult {
  const checks: ValidationCheck[] = [];

  const existsEvidence = Boolean(
    input.placeId || input.googleMapsUrl || (input.address && input.businessName),
  );
  checks.push({
    key: "business_exists",
    label: VALIDATION_CHECK_LABELS.business_exists,
    passed: existsEvidence,
    blocking: true,
    detail: existsEvidence
      ? input.placeId
        ? "Terdaftar di Google Maps (Place ID tersedia)."
        : "Ada bukti profil dan alamat usaha."
      : "Tidak ada bukti keberadaan usaha (tanpa Place ID maupun alamat).",
  });

  const locationValid = Boolean(
    input.city || input.address || (input.latitude != null && input.longitude != null),
  );
  checks.push({
    key: "location_valid",
    label: VALIDATION_CHECK_LABELS.location_valid,
    passed: locationValid,
    blocking: true,
    detail: locationValid
      ? [input.city, input.province].filter(Boolean).join(", ") || "Alamat/koordinat tersedia."
      : "Lokasi tidak diketahui.",
  });

  const targets = input.targetCategories ?? [];
  const categoryOk = categoryMatches(input.category ?? input.industry ?? null, targets);
  checks.push({
    key: "category_match",
    label: VALIDATION_CHECK_LABELS.category_match,
    passed: categoryOk,
    blocking: targets.length > 0,
    detail: targets.length
      ? categoryOk
        ? `Kategori "${input.category ?? input.industry ?? "-"}" sesuai target kampanye.`
        : `Kategori "${input.category ?? input.industry ?? "-"}" di luar target kampanye.`
      : "Kampanye tidak membatasi kategori.",
  });

  checks.push({
    key: "business_active",
    label: VALIDATION_CHECK_LABELS.business_active,
    passed: !input.permanentlyClosed,
    blocking: true,
    detail: input.permanentlyClosed ? "Ditandai tutup permanen." : "Tidak ada tanda tutup permanen.",
  });

  const duplicate = (input.duplicateStatus ?? "unchecked").toLowerCase();
  const notDuplicate = duplicate !== "duplicate";
  checks.push({
    key: "not_duplicate",
    label: VALIDATION_CHECK_LABELS.not_duplicate,
    passed: notDuplicate,
    blocking: true,
    detail: notDuplicate
      ? duplicate === "suspected"
        ? "Diduga kembar — perlu tinjauan QC."
        : "Tidak terdeteksi kembar."
      : "Sudah ditandai duplikat dari kandidat lain.",
  });

  const contactOk = hasContact(input);
  checks.push({
    key: "contact_valid",
    label: VALIDATION_CHECK_LABELS.contact_valid,
    passed: contactOk,
    blocking: false,
    detail: contactOk ? "Minimal satu kontak bersumber tersedia." : "Belum ada kontak bersumber.",
  });

  const verdict = phoneGeoVerdict(input.phone);
  const countryOk = countryCode(input.country) === "ID" && !verdict.foreign;
  checks.push({
    key: "country_allowed",
    label: VALIDATION_CHECK_LABELS.country_allowed,
    passed: countryOk,
    blocking: true,
    detail: countryOk
      ? "Negara dan nomor sesuai aturan (Indonesia / +62)."
      : (verdict.reason ?? `Negara "${input.country ?? "-"}" di luar cakupan KERJAKU.`),
  });

  const blockers = checks.filter((check) => check.blocking && !check.passed);
  return {
    status: blockers.length > 0 ? "rejected" : "validated",
    reason: blockers.length
      ? blockers.map((check) => check.detail).join(" ")
      : checks
          .filter((check) => check.passed)
          .map((check) => check.label)
          .join(", ") + ".",
    checks,
  };
}

/* ------------------------------ PART 2 ---------------------------------- */

export type DigitalGap = {
  website_gap: string;
  online_presence: string;
  operational_gap: string;
  business_opportunity: string;
};

function websiteLooksWeak(website: string | null): boolean {
  if (!website) return false;
  return /(linktr\.ee|carrd\.co|wixsite\.com|blogspot\.com|wordpress\.com|business\.site|facebook\.com|instagram\.com)/i.test(
    website,
  );
}

/** PART 2 — digital gap analysis from observable facts only. */
export function analyzeDigitalGap(input: QualificationInput): DigitalGap {
  const busy = (input.reviewCount ?? 0) >= 50;

  const website_gap =
    input.websiteStatus === "missing"
      ? "Belum memiliki website resmi"
      : websiteLooksWeak(input.website)
        ? "Website belum optimal (memakai halaman instan/marketplace)"
        : input.websiteStatus === "unknown"
          ? "Status website belum diketahui"
          : "Sudah memiliki website";

  const presence: string[] = [];
  presence.push(input.placeId || input.googleMapsUrl ? "Google Maps aktif" : "Google Maps belum terverifikasi");
  if (input.socialActive === true) presence.push("media sosial aktif");
  else if (input.socialActive === false) presence.push("media sosial tidak aktif");

  const operational: string[] = [];
  if (input.websiteStatus !== "present") operational.push("belum ada katalog digital");
  if (input.websiteStatus !== "present" || websiteLooksWeak(input.website))
    operational.push("belum ada sistem pemesanan");
  operational.push("operasional kemungkinan masih manual (tanpa dashboard)");

  const business_opportunity =
    input.websiteStatus === "missing"
      ? busy
        ? "Potensi website bisnis + sistem pemesanan (QResto)"
        : "Potensi landing page profil bisnis + alur pemesanan WhatsApp"
      : websiteLooksWeak(input.website)
        ? "Potensi upgrade website resmi + katalog dan pemesanan digital"
        : "Potensi dashboard operasional atau otomatisasi alur kerja";

  return {
    website_gap,
    online_presence: presence.join(", "),
    operational_gap: operational.join(", "),
    business_opportunity,
  };
}

/* --------------------------- PART 3 & PART 4 ----------------------------- */

export const LEAD_LABELS: Record<LeadTemperature, string> = {
  hot: "HOT LEAD",
  warm: "WARM LEAD",
  cold: "COLD LEAD",
};

export type QualificationResult = {
  validation: ValidationResult;
  digitalGap: DigitalGap;
  score: number;
  temperature: LeadTemperature;
  label: string;
  leadReason: string;
  painSignal: string;
  recommendedSolution: string;
  salesPriority: "high" | "medium" | "low";
};

function dataQualityBonus(input: QualificationInput): number {
  let bonus = 0;
  if (input.placeId) bonus += 4;
  const entries = Object.values(input.contactData ?? {});
  if (entries.some((entry) => entry?.value && entry?.source)) bonus += 4;
  if (input.address) bonus += 2;
  return bonus;
}

/** PART 3 + PART 4 — score, label, and the sentences sales actually reads. */
export function qualifyCandidate(input: QualificationInput): QualificationResult {
  const validation = validateCandidate(input);
  const digitalGap = analyzeDigitalGap(input);

  const screening = screenPlace({
    category: input.category ?? input.industry ?? null,
    city: input.city,
    permanentlyClosed: input.permanentlyClosed,
    rating: input.rating,
    reviewCount: input.reviewCount,
    phone: input.phone,
    websiteStatus: input.websiteStatus,
    targetCategories: input.targetCategories ?? [],
    targetCities: input.targetCities ?? [],
  });

  const raw = validation.status === "rejected" ? 0 : screening.score + dataQualityBonus(input);
  const score = Math.max(0, Math.min(100, raw));
  const temperature: LeadTemperature =
    validation.status === "rejected" ? "cold" : score >= 70 ? "hot" : score >= 45 ? "warm" : "cold";

  const reviews = input.reviewCount ?? 0;
  const leadReason =
    validation.status === "rejected"
      ? `Belum layak: ${validation.reason}`
      : [
          reviews >= 50
            ? `Bisnis memiliki ${reviews}+ ulasan Google`
            : reviews > 0
              ? `Bisnis punya ${reviews} ulasan Google`
              : "Bisnis terdaftar di Google Maps",
          input.rating ? `rating ${input.rating}` : null,
          input.websiteStatus === "missing"
            ? "tetapi belum memiliki website resmi"
            : websiteLooksWeak(input.website)
              ? "tetapi websitenya belum optimal"
              : "dan sudah punya website",
        ]
          .filter(Boolean)
          .join(", ") + ".";

  const painSignal =
    input.websiteStatus === "missing"
      ? "Ketergantungan pada marketplace/media sosial untuk mendapatkan pelanggan."
      : websiteLooksWeak(input.website)
        ? "Website belum jadi kanal penjualan; pemesanan masih tersebar di chat."
        : "Operasional dan pesanan kemungkinan masih dicatat manual.";

  return {
    validation,
    digitalGap,
    score,
    temperature,
    label: LEAD_LABELS[temperature],
    leadReason,
    painSignal,
    recommendedSolution: digitalGap.business_opportunity,
    salesPriority:
      validation.status === "rejected"
        ? "low"
        : temperature === "hot"
          ? "high"
          : temperature === "warm"
            ? "medium"
            : "low",
  };
}
