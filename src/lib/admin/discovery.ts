/**
 * Discovery layer — client-safe model.
 *
 * Concepts adapted from the reference Google Maps prospect scraper, but
 * re-implemented as a server-side module: the same business fields (name,
 * category, address, phone, website + website status, rating, review count,
 * maps URL) are collected through the Google Maps Platform connector instead
 * of a browser extension, and de-duplicated on the Place ID rather than on a
 * DOM link.
 */

export const DISCOVERY_TASK_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type DiscoveryTaskStatus = (typeof DISCOVERY_TASK_STATUSES)[number];

export const DISCOVERY_TASK_STATUS_LABELS: Record<DiscoveryTaskStatus, string> = {
  queued: "Menunggu",
  running: "Berjalan",
  completed: "Selesai",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

export const QC_STATUSES = [
  "new",
  "reviewed",
  "approved",
  "rejected",
  "duplicate",
  "contacted",
] as const;
export type QcStatus = (typeof QC_STATUSES)[number];

export const QC_STATUS_LABELS: Record<QcStatus, string> = {
  new: "Baru",
  reviewed: "Sudah ditinjau",
  approved: "Disetujui",
  rejected: "Ditolak",
  duplicate: "Duplikat",
  contacted: "Sudah dihubungi",
};

export function qcStatusClass(status: QcStatus): string {
  switch (status) {
    case "approved":
      return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
    case "reviewed":
      return "border-sky-400/40 bg-sky-400/10 text-sky-200";
    case "rejected":
      return "border-rose-400/40 bg-rose-400/10 text-rose-200";
    case "duplicate":
      return "border-orange-400/40 bg-orange-400/10 text-orange-200";
    case "contacted":
      return "border-primary/40 bg-primary/10 text-primary";
    default:
      return "border-border/50 bg-muted/20 text-muted-foreground";
  }
}

export const LEAD_TEMPERATURES = ["hot", "warm", "cold"] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];

export const LEAD_TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  hot: "Hot lead",
  warm: "Warm lead",
  cold: "Cold lead",
};

export function leadTemperatureClass(value: LeadTemperature): string {
  switch (value) {
    case "hot":
      return "border-rose-400/40 bg-rose-400/10 text-rose-200";
    case "warm":
      return "border-amber-400/40 bg-amber-400/10 text-amber-200";
    default:
      return "border-sky-400/40 bg-sky-400/10 text-sky-200";
  }
}

export const WEBSITE_STATUSES = ["missing", "present", "unknown"] as const;
export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number];

export const WEBSITE_STATUS_LABELS: Record<WebsiteStatus, string> = {
  missing: "Belum ada website",
  present: "Sudah punya website",
  unknown: "Belum diketahui",
};

/** A normalized business record produced by any discovery provider. */
export type DiscoveredPlace = {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  websiteStatus: WebsiteStatus;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  openingHours: string[];
  permanentlyClosed: boolean;
  keyword: string | null;
};

export type ScreeningInput = Pick<
  DiscoveredPlace,
  | "category"
  | "city"
  | "permanentlyClosed"
  | "rating"
  | "reviewCount"
  | "phone"
  | "websiteStatus"
> & {
  targetCategories?: string[];
  targetCities?: string[];
};

export type ScreeningResult = {
  score: number;
  temperature: LeadTemperature;
  reason: string;
  digitalGap: string;
  recommendedSolution: string;
  salesPriority: "high" | "medium" | "low";
};

export const HOT_LEAD_MIN = 70;
export const WARM_LEAD_MIN = 45;

function includesAny(value: string | null, list: string[] | undefined): boolean {
  if (!value || !list || list.length === 0) return false;
  const haystack = value.toLowerCase();
  return list.some((item) => {
    const needle = item.trim().toLowerCase();
    return needle.length > 1 && (haystack.includes(needle) || needle.includes(haystack));
  });
}

/**
 * Deterministic 0-100 screening score. No AI call — the factors are all
 * observable facts from the maps provider, so the number is reproducible and
 * auditable.
 */
export function screenPlace(input: ScreeningInput): ScreeningResult {
  const reasons: string[] = [];
  let score = 0;

  // Digital gap is the core buying signal for KERJAKU.
  if (input.websiteStatus === "missing") {
    score += 35;
    reasons.push("Belum punya website di profil Google Maps");
  } else if (input.websiteStatus === "unknown") {
    score += 12;
    reasons.push("Status website belum diketahui");
  } else {
    score += 5;
    reasons.push("Sudah punya website");
  }

  if (!input.permanentlyClosed) {
    score += 15;
    reasons.push("Usaha masih aktif");
  }

  const reviews = input.reviewCount ?? 0;
  if (reviews >= 200) {
    score += 20;
    reasons.push(`Ramai ulasan (${reviews})`);
  } else if (reviews >= 50) {
    score += 15;
    reasons.push(`Cukup ramai (${reviews} ulasan)`);
  } else if (reviews >= 10) {
    score += 8;
    reasons.push(`${reviews} ulasan`);
  }

  const rating = input.rating ?? 0;
  if (rating >= 4.5) {
    score += 10;
    reasons.push(`Rating tinggi ${rating}`);
  } else if (rating >= 4) {
    score += 7;
    reasons.push(`Rating ${rating}`);
  } else if (rating > 0) {
    score += 3;
  }

  if (includesAny(input.category, input.targetCategories)) {
    score += 10;
    reasons.push("Kategori sesuai target kampanye");
  }
  if (includesAny(input.city, input.targetCities)) {
    score += 5;
    reasons.push("Lokasi sesuai target kampanye");
  }
  if (input.phone) {
    score += 5;
    reasons.push("Nomor telepon tersedia di Maps");
  }

  score = Math.max(0, Math.min(100, score));
  const temperature: LeadTemperature =
    score >= HOT_LEAD_MIN ? "hot" : score >= WARM_LEAD_MIN ? "warm" : "cold";

  const digitalGap =
    input.websiteStatus === "missing"
      ? "Tidak ada website resmi — seluruh penjualan bergantung pada Google Maps dan media sosial."
      : input.websiteStatus === "unknown"
        ? "Website belum terverifikasi — perlu pengecekan lanjutan."
        : "Sudah punya website; peluangnya pada sistem/otomatisasi, bukan sekadar website baru.";

  const recommendedSolution =
    input.websiteStatus === "missing"
      ? reviews >= 50
        ? "Website profil bisnis + katalog dan alur pemesanan WhatsApp"
        : "Landing page profil bisnis dengan CTA WhatsApp"
      : "Dashboard operasional atau otomatisasi alur kerja";

  return {
    score,
    temperature,
    reason: reasons.join(". ") + ".",
    digitalGap,
    recommendedSolution,
    salesPriority: temperature === "hot" ? "high" : temperature === "warm" ? "medium" : "low",
  };
}

/** Reasons a discovered place is dropped before it becomes a candidate. */
export const REJECTION_REASONS = {
  permanently_closed: "Bisnis tutup permanen",
  category_mismatch: "Kategori tidak sesuai target kampanye",
  already_in_crm: "Sudah ada di CRM / daftar prospek",
  duplicate_place: "Sudah ada sebagai kandidat (Place ID sama)",
  duplicate_entity: "Nama + alamat sangat mirip dengan kandidat lain",
  outside_country: "Berada di luar negara target",
} as const;
export type RejectionReason = keyof typeof REJECTION_REASONS;

/** Loose text key used for name+address duplicate matching. */
export function addressKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(jl|jalan|no|nomor|rt|rw|kec|kel|kab|kota|prov)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function categoryMatches(category: string | null, targets: string[]): boolean {
  if (targets.length === 0) return true;
  return includesAny(category, targets);
}

export type DiscoveryTaskRow = {
  id: string;
  campaign_id: string;
  keyword: string;
  area: string;
  radius_meters: number;
  status: DiscoveryTaskStatus;
  attempt: number;
  max_attempts: number;
  found_count: number;
  saved_count: number;
  duplicate_count: number;
  rejected_count: number;
  last_error: string | null;
  last_run_at: string | null;
  created_at: string;
};

export type DiscoveryUsageRow = {
  usage_date: string;
  provider: string;
  requests: number;
  results: number;
  errors: number;
};
