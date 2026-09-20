/**
 * Sales Preparation Intelligence — deterministic rules (Prompt 4.5).
 *
 * Turns a qualified hot lead into something a sales agent can act on:
 * business brief, approach recommendation, outreach draft, sales asset.
 * Every sentence is derived from observable facts already stored on the
 * candidate. No facts are invented here, and nothing is sent automatically.
 */
import { analyzeDigitalGap, type QualificationInput } from "@/lib/admin/qualification";

/* ------------------------------ PART 5 ---------------------------------- */

export const SALES_STAGES = ["qualified", "sales_prepared", "ready_outreach"] as const;
export type SalesStage = (typeof SALES_STAGES)[number];

export const SALES_STAGE_LABELS: Record<SalesStage, string> = {
  qualified: "Qualified",
  sales_prepared: "Sales Prepared",
  ready_outreach: "Ready Outreach",
};

/* ------------------------------ PART 2 ---------------------------------- */

export const APPROACH_CATEGORIES = [
  "website_opportunity",
  "fnb_opportunity",
  "automation_opportunity",
] as const;
export type ApproachCategory = (typeof APPROACH_CATEGORIES)[number];

export const APPROACH_LABELS: Record<ApproachCategory, string> = {
  website_opportunity: "Website Opportunity",
  fnb_opportunity: "F&B Opportunity",
  automation_opportunity: "Automation Opportunity",
};

const FNB_PATTERN =
  /(restaurant|restoran|rumah makan|cafe|kafe|coffee|kopi|kedai|warung|bakery|catering|bistro|food|resto)/i;

function isFnb(input: QualificationInput): boolean {
  const haystack = `${input.category ?? ""} ${input.industry ?? ""} ${input.businessName}`;
  return FNB_PATTERN.test(haystack);
}

function isGrowing(input: QualificationInput): boolean {
  return (input.reviewCount ?? 0) >= 150 || (input.rating ?? 0) >= 4.6;
}

export type ApproachRecommendation = {
  category: ApproachCategory;
  label: string;
  recommendation: string;
  reason: string;
};

/** PART 2 — approach follows the business condition, not a random template. */
export function recommendApproach(input: QualificationInput): ApproachRecommendation {
  const noWebsite = input.websiteStatus !== "present";

  if (isFnb(input)) {
    return {
      category: "fnb_opportunity",
      label: APPROACH_LABELS.fnb_opportunity,
      recommendation: "QResto + online ordering",
      reason: noWebsite
        ? "Bisnis kuliner dan belum punya website resmi, sehingga pemesanan masih bergantung kanal pihak ketiga."
        : "Bisnis kuliner yang sudah punya website tetapi belum punya alur pemesanan digital sendiri.",
    };
  }

  if (noWebsite) {
    return {
      category: "website_opportunity",
      label: APPROACH_LABELS.website_opportunity,
      recommendation: "Website bisnis + SEO lokal",
      reason: "Belum memiliki website resmi, padahal pencarian lokal adalah jalur utama calon pelanggan.",
    };
  }

  if (isGrowing(input)) {
    return {
      category: "automation_opportunity",
      label: APPROACH_LABELS.automation_opportunity,
      recommendation: "Custom system + dashboard operasional",
      reason: "Bisnis sedang berkembang (volume ulasan/rating tinggi) sehingga operasional manual mulai membebani.",
    };
  }

  return {
    category: "website_opportunity",
    label: APPROACH_LABELS.website_opportunity,
    recommendation: "Optimasi website + SEO lokal",
    reason: "Website sudah ada tetapi belum dioptimalkan untuk konversi dan pencarian lokal.",
  };
}

/* ------------------------------ PART 4 ---------------------------------- */

export const SALES_ASSETS = [
  "qresto_demo",
  "website_portfolio",
  "custom_system_portfolio",
  "analytics_demo",
] as const;
export type SalesAssetKey = (typeof SALES_ASSETS)[number];

export type SalesAsset = {
  key: SalesAssetKey;
  label: string;
  url: string;
  note: string;
};

const ASSET_LIBRARY: Record<SalesAssetKey, SalesAsset> = {
  qresto_demo: {
    key: "qresto_demo",
    label: "Demo QResto",
    url: "https://kerjaku.space/products/qresto",
    note: "Demo pemesanan digital untuk restoran dan kafe.",
  },
  website_portfolio: {
    key: "website_portfolio",
    label: "Portofolio website bisnis",
    url: "https://kerjaku.space/jasa-pembuatan-website",
    note: "Contoh website bisnis yang fokus konversi dan pencarian lokal.",
  },
  custom_system_portfolio: {
    key: "custom_system_portfolio",
    label: "Portofolio sistem kustom",
    url: "https://kerjaku.space/jasa-sistem-perusahaan",
    note: "Contoh sistem internal perusahaan yang dibuat sesuai alur kerja.",
  },
  analytics_demo: {
    key: "analytics_demo",
    label: "Demo dashboard analitik",
    url: "https://kerjaku.space/jasa-dashboard-bisnis",
    note: "Contoh dashboard operasional dan laporan bisnis.",
  },
};

/** PART 4 — pick the supporting material that matches the approach. */
export function selectSalesAsset(
  input: QualificationInput,
  approach: ApproachRecommendation,
): SalesAsset {
  if (approach.category === "fnb_opportunity") return ASSET_LIBRARY.qresto_demo;
  if (approach.category === "automation_opportunity")
    return isGrowing(input) && input.websiteStatus === "present"
      ? ASSET_LIBRARY.analytics_demo
      : ASSET_LIBRARY.custom_system_portfolio;
  return ASSET_LIBRARY.website_portfolio;
}

export function salesAssetByKey(key: string): SalesAsset | null {
  return (ASSET_LIBRARY as Record<string, SalesAsset>)[key] ?? null;
}

/* ------------------------------ PART 1 ---------------------------------- */

export type BusinessBrief = {
  business_summary: string;
  current_digital_condition: string;
  potential_problem: string;
  opportunity: string;
  recommended_solution: string;
};

function reviewPhrase(input: QualificationInput): string {
  const count = input.reviewCount ?? 0;
  if (count >= 500) return `${count}+ ulasan Google`;
  if (count > 0) return `${count} ulasan Google`;
  return "belum banyak ulasan Google";
}

/** PART 1 — business brief built from stored facts. */
export function buildBusinessBrief(
  input: QualificationInput,
  approach: ApproachRecommendation,
): BusinessBrief {
  const gap = analyzeDigitalGap(input);
  const place = input.city ? `di ${input.city}` : "";
  const category = input.category ?? input.industry ?? "bisnis lokal";
  const rating = input.rating ? `rating ${input.rating}` : "rating belum tersedia";

  return {
    business_summary:
      `${input.businessName} adalah ${category} ${place}`.trim() +
      `, dengan ${rating} dan ${reviewPhrase(input)}.`,
    current_digital_condition: `${gap.website_gap}. ${gap.online_presence}.`,
    potential_problem:
      input.websiteStatus !== "present"
        ? "Permintaan datang dari pencarian dan media sosial, tetapi tidak ada kanal milik sendiri untuk menampung dan mengonversinya."
        : `${gap.operational_gap}.`,
    opportunity: gap.business_opportunity,
    recommended_solution: approach.recommendation,
  };
}

/* ------------------------------ PART 3 ---------------------------------- */

export type OutreachDraft = {
  opening_message: string;
  reason_contacting: string;
  value_proposition: string;
  call_to_action: string;
};

/** PART 3 — outreach draft grounded in this specific business. */
export function buildOutreachDraft(
  input: QualificationInput,
  approach: ApproachRecommendation,
  brief: BusinessBrief,
  asset: SalesAsset,
): OutreachDraft {
  const place = input.city ? ` di ${input.city}` : "";
  const category = input.category ?? input.industry ?? "bisnis";

  const value =
    approach.category === "fnb_opportunity"
      ? "Pelanggan bisa memesan langsung lewat menu digital tanpa antre, dan setiap pesanan tercatat rapi untuk laporan harian."
      : approach.category === "automation_opportunity"
        ? "Pekerjaan manual yang berulang bisa dipangkas, dan kondisi bisnis terlihat dalam satu dashboard."
        : "Calon pelanggan yang mencari lewat Google langsung menemukan profil, layanan, dan cara memesan dalam satu halaman.";

  return {
    opening_message: `Halo ${input.businessName}, saya dari KERJAKU. Saya melihat profil ${category}${place} Anda di Google Maps dengan ${reviewPhrase(input)}.`,
    reason_contacting: `${brief.current_digital_condition} ${approach.reason}`.trim(),
    value_proposition: `${approach.recommendation}. ${value}`,
    call_to_action: `Boleh saya kirimkan ${asset.label.toLowerCase()} sebagai gambaran? Kalau cocok, kita bisa bahas 15 menit sesuai waktu Anda.`,
  };
}

/* --------------------------- Orchestration ------------------------------ */

export type SalesPreparation = {
  brief: BusinessBrief;
  approach: ApproachRecommendation;
  outreach: OutreachDraft;
  asset: SalesAsset;
};

export function prepareSales(input: QualificationInput): SalesPreparation {
  const approach = recommendApproach(input);
  const brief = buildBusinessBrief(input, approach);
  const asset = selectSalesAsset(input, approach);
  const outreach = buildOutreachDraft(input, approach, brief, asset);
  return { brief, approach, outreach, asset };
}

/** A lead may only move to Ready Outreach when someone can actually be reached. */
export function readyOutreachBlockers(input: {
  validationStatus?: string | null;
  qcStatus?: string | null;
  hasPreparation?: boolean;
  contactData?: Record<string, { value?: string | null; source?: string | null }> | null;
}): string[] {
  const blockers: string[] = [];
  if (input.validationStatus && input.validationStatus !== "validated")
    blockers.push("Kandidat belum lolos validasi bisnis.");
  if (input.qcStatus !== undefined && input.qcStatus !== "approved")
    blockers.push("Kandidat belum disetujui pada QC review.");
  if (input.hasPreparation === false)
    blockers.push("Materi persiapan penjualan belum dibuat.");
  const entries = Object.values(input.contactData ?? {});
  if (!entries.some((entry) => entry?.value && entry?.source))
    blockers.push("Belum ada kontak dengan sumber data yang tercatat.");
  return blockers;
}

/* --------------------- Sales preparation eligibility --------------------- */

export const SALES_PREP_BLOCKERS = [
  "awaiting_qc",
  "qc_rejected",
  "duplicate",
  "already_in_crm",
  "already_prepared",
  "contact_not_sourced",
] as const;
export type SalesPrepBlocker = (typeof SALES_PREP_BLOCKERS)[number];

export const SALES_PREP_BLOCKER_LABELS: Record<SalesPrepBlocker, string> = {
  awaiting_qc: "Menunggu QC review",
  qc_rejected: "Ditolak pada QC review",
  duplicate: "Ditandai duplikat",
  already_in_crm: "Sudah menjadi prospek CRM",
  already_prepared: "Sudah punya materi persiapan aktif",
  contact_not_sourced: "Kontak belum punya sumber data",
};

export type SalesPrepEligibilityInput = {
  qcStatus?: string | null;
  duplicateStatus?: string | null;
  promotedProspectId?: string | null;
  hasActivePreparation?: boolean;
  contactData?: Record<string, { value?: string | null; source?: string | null }> | null;
};

/**
 * QC approval is the only gate into sales preparation. Validation status is a
 * quality signal, never the gate.
 */
export function salesPrepBlockers(input: SalesPrepEligibilityInput): SalesPrepBlocker[] {
  const blockers: SalesPrepBlocker[] = [];
  const qc = String(input.qcStatus ?? "new");
  if (qc === "rejected") blockers.push("qc_rejected");
  else if (qc !== "approved") blockers.push("awaiting_qc");
  if (input.duplicateStatus === "duplicate" || qc === "duplicate") blockers.push("duplicate");
  if (input.promotedProspectId) blockers.push("already_in_crm");
  if (input.hasActivePreparation) blockers.push("already_prepared");
  const entries = Object.values(input.contactData ?? {});
  if (!entries.some((entry) => entry?.value && entry?.source))
    blockers.push("contact_not_sourced");
  return blockers;
}

export function canPrepareSales(input: SalesPrepEligibilityInput): boolean {
  return salesPrepBlockers(input).length === 0;
}


