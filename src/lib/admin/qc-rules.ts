/**
 * Automatic QC — client-safe rules.
 *
 * Screening and QC run without a human so nobody has to review hundreds of
 * candidates by hand. Only candidates the rules are confident about are
 * auto-approved; anything doubtful is queued for a person. A human decision
 * always wins and is never overwritten by these rules.
 */
import type { QualificationInput, QualificationResult } from "@/lib/admin/qualification";

/* ------------------------------ Confidence ------------------------------- */

export type ConfidenceFactor = { label: string; points: number };

export type ConfidenceResult = {
  score: number;
  factors: ConfidenceFactor[];
  summary: string;
};

/**
 * How complete and traceable the facts are — separate from how attractive the
 * lead is. A perfect lead with no sources must not be auto-approved.
 */
export function computeConfidence(input: QualificationInput): ConfidenceResult {
  const factors: ConfidenceFactor[] = [];
  const add = (label: string, points: number) => factors.push({ label, points });

  if (input.placeId) add("Terdaftar di Google Maps (Place ID)", 30);
  else if (input.googleMapsUrl) add("Ada tautan profil Google Maps", 18);

  if (input.address) add("Alamat lengkap tersedia", 12);
  if (input.city) add("Kota diketahui", 6);

  const contacts = Object.values(input.contactData ?? {});
  if (contacts.some((entry) => entry?.value && entry?.source))
    add("Kontak punya sumber data", 20);
  else if (input.phone) add("Nomor telepon tersedia tanpa sumber", 6);

  const reviews = input.reviewCount ?? 0;
  if (reviews >= 50) add(`Bukti aktivitas kuat (${reviews} ulasan)`, 14);
  else if (reviews >= 10) add(`Ada bukti aktivitas (${reviews} ulasan)`, 8);
  else if (reviews > 0) add(`Ulasan sedikit (${reviews})`, 3);

  if (input.websiteStatus !== "unknown") add("Status website sudah diperiksa", 10);
  if (input.category) add("Kategori bisnis diketahui", 8);

  const score = Math.max(0, Math.min(100, factors.reduce((sum, item) => sum + item.points, 0)));
  return {
    score,
    factors,
    summary: factors.map((item) => item.label).join(", ") || "Data pendukung masih minim",
  };
}

/* ------------------------------ Screening -------------------------------- */

export const SCREENING_LABELS = ["ai_qualified", "need_review", "rejected"] as const;
export type ScreeningLabel = (typeof SCREENING_LABELS)[number];

export const SCREENING_LABEL_TEXT: Record<ScreeningLabel, string> = {
  ai_qualified: "AI Qualified",
  need_review: "Perlu ditinjau",
  rejected: "Ditolak",
};

export function screeningLabelClass(label: ScreeningLabel): string {
  switch (label) {
    case "ai_qualified":
      return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
    case "rejected":
      return "border-rose-400/40 bg-rose-400/10 text-rose-200";
    default:
      return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  }
}

/** Minimum confidence for the machine to decide on its own. */
export const AUTO_QC_MIN_CONFIDENCE = 70;
/** Minimum opportunity score for the machine to approve on its own. */
export const AUTO_QC_MIN_SCORE = 55;

export type AutoQcDecision = {
  screeningLabel: ScreeningLabel;
  /** qc_status the rules want; "new" means a person must look at it. */
  qcStatus: "approved" | "rejected" | "new";
  confidence: number;
  reason: string;
};

/**
 * Rule-based QC: category match + business active + sourced data + a real
 * opportunity + high confidence = auto approved. Everything else waits for a
 * human instead of being silently dropped.
 */
export function autoQcDecision(
  input: QualificationInput,
  qualification: QualificationResult,
  confidence: ConfidenceResult = computeConfidence(input),
): AutoQcDecision {
  if (qualification.validation.status === "rejected") {
    return {
      screeningLabel: "rejected",
      qcStatus: "rejected",
      confidence: confidence.score,
      reason: `Ditolak otomatis: ${qualification.validation.reason}`.slice(0, 500),
    };
  }

  const checks = new Map(qualification.validation.checks.map((check) => [check.key, check]));
  const missing: string[] = [];

  if (!checks.get("category_match")?.passed) missing.push("kategori belum sesuai target kampanye");
  if (!checks.get("business_active")?.passed) missing.push("status aktif belum pasti");
  if (!checks.get("contact_valid")?.passed) missing.push("kontak belum bersumber");
  if (confidence.score < AUTO_QC_MIN_CONFIDENCE)
    missing.push(`keyakinan data ${confidence.score}% di bawah ambang ${AUTO_QC_MIN_CONFIDENCE}%`);
  if (qualification.score < AUTO_QC_MIN_SCORE)
    missing.push(`skor peluang ${qualification.score} di bawah ambang ${AUTO_QC_MIN_SCORE}`);

  if (missing.length === 0) {
    return {
      screeningLabel: "ai_qualified",
      qcStatus: "approved",
      confidence: confidence.score,
      reason:
        `Disetujui otomatis: kategori sesuai, bisnis aktif, kontak bersumber, peluang ${qualification.score}, keyakinan ${confidence.score}%.`.slice(
          0,
          500,
        ),
    };
  }

  return {
    screeningLabel: "need_review",
    qcStatus: "new",
    confidence: confidence.score,
    reason: `Perlu tinjauan manusia: ${missing.join(", ")}.`.slice(0, 500),
  };
}
