/**
 * Outbound prospecting — client-safe model, ICP config and deterministic scoring.
 *
 * Prospects live OUTSIDE the inbound CRM (`consultations`) until a human
 * approves a handoff. Nothing here calls AI or Supabase: scoring must be
 * reproducible and explainable in the UI.
 */

export const PROSPECT_STATUSES = [
  "new",
  "researched",
  "ready",
  "approved",
  "contacted",
  "replied",
  "meeting",
  "negotiation",
  "converted",
  "deal",
  "lost",
  "rejected",
  "do_not_contact",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "Baru ditemukan",
  researched: "Sudah diriset",
  ready: "Siap dihubungi",
  approved: "Disetujui",
  contacted: "Sudah dihubungi",
  replied: "Membalas",
  meeting: "Meeting",
  negotiation: "Negosiasi",
  converted: "Jadi lead",
  deal: "Deal",
  lost: "Lost",
  rejected: "Ditolak",
  do_not_contact: "Jangan dihubungi",
};

/** Ordered funnel for reporting (terminal states excluded). */
export const PROSPECT_FUNNEL: ProspectStatus[] = [
  "new",
  "researched",
  "ready",
  "approved",
  "contacted",
  "replied",
  "meeting",
  "negotiation",
  "converted",
  "deal",
];

/** Pipeline stages a salesperson can move a prospect through manually. */
export const PIPELINE_STAGES: ProspectStatus[] = [
  "new",
  "ready",
  "contacted",
  "replied",
  "meeting",
  "negotiation",
  "deal",
  "lost",
];

/** A prospect is actionable when at least one contact channel exists. */
export function isActionable(prospect: {
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  contact_phone?: string | null;
  website?: string | null;
}): boolean {
  return Boolean(
    (prospect.contact_email ?? "").trim() ||
      (prospect.contact_whatsapp ?? "").trim() ||
      (prospect.contact_phone ?? "").trim() ||
      (prospect.website ?? "").trim(),
  );
}

/* ------------------------------- Campaigns -------------------------------- */

export const CAMPAIGN_STATUSES = ["active", "paused", "done"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  active: "Aktif",
  paused: "Dijeda",
  done: "Selesai",
};

export const CAMPAIGN_SOLUTIONS = [
  "Website Development",
  "Web Application",
  "Custom Software",
  "CRM System",
  "Booking System",
  "Business Dashboard",
  "AI Assistant",
  "Workflow Automation",
  "Digital Transformation",
] as const;

export const CAMPAIGN_INDUSTRIES = [
  "Restaurant",
  "Cafe",
  "Interior & Kitchen Set",
  "Manufaktur",
  "Distributor",
  "Retail",
  "Properti",
  "Klinik & Healthcare",
  "Pendidikan",
  "Jasa Profesional",
  "Konstruksi",
  "Logistik",
] as const;

export const PROSPECT_SOURCES = [
  "google_business",
  "google_search",
  "company_website",
  "instagram",
  "linkedin",
  "business_directory",
  "industry_listing",
  "referral",
  "manual",
] as const;
export type ProspectSource = (typeof PROSPECT_SOURCES)[number];

export const PROSPECT_SOURCE_LABELS: Record<string, string> = {
  google_business: "Google Business",
  google_search: "Google Search",
  company_website: "Company Website",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  business_directory: "Business Directory",
  industry_listing: "Industry Listing",
  referral: "Referral",
  manual: "Input manual",
};

export type CampaignRow = {
  id: string;
  name: string;
  industry: string;
  location: string;
  keywords: string[];
  solution: string;
  daily_target: number;
  status: string;
  notes: string | null;
  last_run_at: string | null;
  total_discovered: number;
  created_at: string;
};


export const PROSPECT_ACTIVITY_ACTIONS = [
  "research",
  "score",
  "draft",
  "approval",
  "sent",
  "reply",
  "note",
  "handoff",
  "status",
] as const;
export type ProspectActivityAction = (typeof PROSPECT_ACTIVITY_ACTIONS)[number];

export const OUTREACH_CHANNELS = ["whatsapp", "email", "linkedin", "other"] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export type FitTier = "unscored" | "low" | "medium" | "high";

export const FIT_TIER_LABELS: Record<FitTier, string> = {
  unscored: "Belum dinilai",
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
};

export function isProspectStatus(value: unknown): value is ProspectStatus {
  return typeof value === "string" && (PROSPECT_STATUSES as readonly string[]).includes(value);
}

/* --------------------------------- ICP ----------------------------------- */

export const ICP_CONFIG_KEY = "default";

export type IcpConfig = {
  /** Industries KERJAKU serves best; matched case-insensitively as substrings. */
  industries: string[];
  /** Priority cities/regions. */
  cities: string[];
  /** Signals in research notes that indicate a real operational pain. */
  painKeywords: string[];
  /** Signals that disqualify (agency, competitor, reseller, ...). */
  excludeKeywords: string[];
  weights: {
    industry: number;
    city: number;
    digitalPresence: number;
    painSignals: number;
    contactability: number;
    evidence: number;
  };
  /** Score thresholds. */
  thresholds: { medium: number; high: number };
  /** Cost/volume guardrails for automated discovery runs. */
  limits: { perRun: number; perDay: number; researchPerRun: number };
};

export const DEFAULT_ICP_CONFIG: IcpConfig = {
  industries: [
    "konstruksi",
    "kontraktor",
    "interior",
    "manufaktur",
    "distribusi",
    "logistik",
    "properti",
    "klinik",
    "pendidikan",
    "retail",
    "f&b",
    "jasa profesional",
  ],
  cities: ["jakarta", "bekasi", "tangerang", "depok", "bogor", "bandung", "surabaya"],
  painKeywords: [
    "manual",
    "excel",
    "spreadsheet",
    "whatsapp",
    "catat tangan",
    "belum ada sistem",
    "belum ada website",
    "laporan lambat",
    "stok",
    "rekap",
    "antrian",
    "double input",
  ],
  excludeKeywords: ["agency", "digital agency", "software house", "jasa website", "reseller"],
  weights: {
    industry: 25,
    city: 10,
    digitalPresence: 20,
    painSignals: 25,
    contactability: 15,
    evidence: 5,
  },
  thresholds: { medium: 45, high: 70 },
  limits: { perRun: 20, perDay: 60, researchPerRun: 10 },
};

export function mergeIcpConfig(raw: unknown): IcpConfig {
  const base = DEFAULT_ICP_CONFIG;
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<IcpConfig>;
  const list = (input: unknown, fallback: string[]) =>
    Array.isArray(input) && input.every((item) => typeof item === "string")
      ? (input as string[]).map((item) => item.trim().toLowerCase()).filter(Boolean)
      : fallback;
  return {
    industries: list(value.industries, base.industries),
    cities: list(value.cities, base.cities),
    painKeywords: list(value.painKeywords, base.painKeywords),
    excludeKeywords: list(value.excludeKeywords, base.excludeKeywords),
    weights: { ...base.weights, ...(value.weights ?? {}) },
    thresholds: { ...base.thresholds, ...(value.thresholds ?? {}) },
    limits: { ...base.limits, ...(value.limits ?? {}) },
  };
}

/* ------------------------------- Scoring ---------------------------------- */

export type FitFactor = {
  key: string;
  label: string;
  score: number;
  max: number;
  detail: string;
};

export type FitResult = {
  total: number;
  max: number;
  tier: FitTier;
  factors: FitFactor[];
  disqualified: boolean;
  disqualifyReason?: string;
};

export type ScorableProspect = {
  business_name?: string | null;
  industry?: string | null;
  city?: string | null;
  website?: string | null;
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  contact_name?: string | null;
  research_summary?: string | null;
  pain_signals?: unknown;
  evidence?: unknown;
};

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "text" in (item as Record<string, unknown>)
          ? String((item as Record<string, unknown>).text ?? "")
          : "",
    )
    .filter(Boolean);
}

function matchesAny(haystack: string, needles: string[]): string | null {
  for (const needle of needles) {
    if (needle && haystack.includes(needle)) return needle;
  }
  return null;
}

/**
 * Deterministic ICP fit score. Same input always yields the same score, and
 * every point is attributable to a named factor shown in the admin UI.
 */
export function scoreProspect(prospect: ScorableProspect, config: IcpConfig = DEFAULT_ICP_CONFIG): FitResult {
  const w = config.weights;
  const industry = (prospect.industry ?? "").toLowerCase();
  const city = (prospect.city ?? "").toLowerCase();
  const summary = (prospect.research_summary ?? "").toLowerCase();
  const name = (prospect.business_name ?? "").toLowerCase();
  const pains = toStringList(prospect.pain_signals);
  const evidence = toStringList(prospect.evidence);
  const haystack = [name, industry, summary, pains.join(" ")].join(" ");

  const excluded = matchesAny(haystack, config.excludeKeywords);

  const factors: FitFactor[] = [];

  const industryHit = matchesAny([industry, name, summary].join(" "), config.industries);
  factors.push({
    key: "industry",
    label: "Kecocokan industri",
    score: industryHit ? w.industry : 0,
    max: w.industry,
    detail: industryHit ? `Cocok dengan industri "${industryHit}"` : "Industri di luar fokus ICP",
  });

  const cityHit = matchesAny(city, config.cities);
  factors.push({
    key: "city",
    label: "Lokasi prioritas",
    score: cityHit ? w.city : 0,
    max: w.city,
    detail: cityHit ? `Berada di ${cityHit}` : "Di luar kota prioritas",
  });

  const hasSite = Boolean((prospect.website ?? "").trim());
  const digital = hasSite ? Math.round(w.digitalPresence * 0.6) : w.digitalPresence;
  factors.push({
    key: "digitalPresence",
    label: "Peluang digitalisasi",
    score: digital,
    max: w.digitalPresence,
    detail: hasSite
      ? "Sudah punya website — peluang di sistem/dashboard/otomasi"
      : "Belum ada website — peluang paling jelas",
  });

  const painHits = config.painKeywords.filter((keyword) => haystack.includes(keyword));
  const painScore = painHits.length === 0 ? 0 : Math.min(w.painSignals, painHits.length * Math.ceil(w.painSignals / 3));
  factors.push({
    key: "painSignals",
    label: "Sinyal masalah operasional",
    score: painScore,
    max: w.painSignals,
    detail: painHits.length ? `Sinyal: ${painHits.slice(0, 4).join(", ")}` : "Belum ada sinyal masalah terverifikasi",
  });

  const channels = [prospect.contact_email, prospect.contact_whatsapp].filter((item) =>
    Boolean((item ?? "").trim()),
  ).length;
  const contactScore =
    channels === 0 ? 0 : channels === 1 ? Math.round(w.contactability * 0.6) : w.contactability;
  factors.push({
    key: "contactability",
    label: "Kelengkapan kontak",
    score: contactScore + (prospect.contact_name ? 0 : 0),
    max: w.contactability,
    detail:
      channels === 0
        ? "Belum ada kanal kontak"
        : `${channels} kanal kontak${prospect.contact_name ? ` (PIC: ${prospect.contact_name})` : ""}`,
  });

  factors.push({
    key: "evidence",
    label: "Bukti riset",
    score: evidence.length ? w.evidence : 0,
    max: w.evidence,
    detail: evidence.length ? `${evidence.length} bukti tercatat` : "Belum ada bukti/sumber",
  });

  const max = factors.reduce((sum, factor) => sum + factor.max, 0);
  const rawTotal = factors.reduce((sum, factor) => sum + factor.score, 0);
  const total = excluded ? 0 : Math.max(0, Math.min(max, rawTotal));

  const tier: FitTier = excluded
    ? "low"
    : total >= config.thresholds.high
      ? "high"
      : total >= config.thresholds.medium
        ? "medium"
        : "low";

  return {
    total,
    max,
    tier,
    factors,
    disqualified: Boolean(excluded),
    ...(excluded ? { disqualifyReason: `Mengandung kata kunci eksklusi "${excluded}"` } : {}),
  };
}

/* ------------------------------ Normalizers ------------------------------- */

export function normalizeDomain(website: string | null | undefined): string | null {
  const raw = (website ?? "").trim().toLowerCase();
  if (!raw) return null;
  const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    const host = new URL(withScheme).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/** Indonesian mobile numbers normalized to 62XXXXXXXXXX (digits only). */
export function normalizeWhatsapp(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toLowerCase();
  return raw.includes("@") ? raw : null;
}

export function prospectStatusClass(status: string): string {
  switch (status) {
    case "converted":
      return "border-primary/40 bg-primary/15 text-primary";
    case "replied":
    case "approved":
      return "border-accent/40 bg-accent/20 text-accent-foreground";
    case "contacted":
    case "ready":
      return "border-border/60 bg-secondary/40 text-secondary-foreground";
    case "rejected":
    case "do_not_contact":
      return "border-destructive/40 bg-destructive/15 text-destructive";
    default:
      return "border-border/60 bg-muted/40 text-muted-foreground";
  }
}

export function fitTierClass(tier: string): string {
  switch (tier) {
    case "high":
      return "border-primary/40 bg-primary/15 text-primary";
    case "medium":
      return "border-accent/40 bg-accent/20 text-accent-foreground";
    case "low":
      return "border-border/60 bg-muted/40 text-muted-foreground";
    default:
      return "border-border/60 bg-muted/30 text-muted-foreground";
  }
}

/* -------------------- Contact quality & sales readiness -------------------- */

/**
 * Deterministic Contact Quality Score (0-100). Measures whether a human sales
 * rep can actually reach this business — separate from ICP fit.
 *
 * WhatsApp/phone 40 · business email 25 · website 15 · PIC 10 · social 10.
 */
export type ContactQualityFactor = { key: string; label: string; score: number; max: number };

export type VerificationStatus = "sales_ready" | "qualified" | "need_verification" | "not_ready";

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  sales_ready: "SALES READY",
  qualified: "QUALIFIED",
  need_verification: "NEED VERIFICATION",
  not_ready: "NOT READY",
};

export type ContactQuality = {
  score: number;
  status: VerificationStatus;
  factors: ContactQualityFactor[];
  /** True when the only reachable channel is a social profile. */
  socialOnly: boolean;
};

export type ContactableProspect = {
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  contact_phone?: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
  website?: string | null;
  social_media?: string | null;
};

const FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "yahoo.co.id", "hotmail.com", "outlook.com"];

export function contactQuality(prospect: ContactableProspect): ContactQuality {
  const phone = normalizeWhatsapp(prospect.contact_whatsapp ?? prospect.contact_phone);
  const email = normalizeEmail(prospect.contact_email);
  const domain = normalizeDomain(prospect.website);
  const pic = (prospect.contact_name ?? "").trim();
  const social = (prospect.social_media ?? "").trim();

  // A free-mail address is still reachable, just weaker than a business domain.
  const emailScore = !email ? 0 : FREE_EMAIL_DOMAINS.some((d) => email.endsWith(`@${d}`)) ? 15 : 25;

  const factors: ContactQualityFactor[] = [
    { key: "phone", label: "WhatsApp / telepon", score: phone ? 40 : 0, max: 40 },
    { key: "email", label: "Email bisnis", score: emailScore, max: 25 },
    { key: "website", label: "Website aktif", score: domain ? 15 : 0, max: 15 },
    { key: "pic", label: "Decision maker / PIC", score: pic ? 10 : 0, max: 10 },
    { key: "social", label: "Social media resmi", score: social ? 10 : 0, max: 10 },
  ];

  const score = factors.reduce((sum, factor) => sum + factor.score, 0);
  const socialOnly = Boolean(social) && !phone && !email;

  const status: VerificationStatus = socialOnly
    ? "need_verification"
    : score >= 90
      ? "sales_ready"
      : score >= 75
        ? "qualified"
        : score >= 50
          ? "need_verification"
          : "not_ready";

  return { score, status, factors, socialOnly };
}

export function verificationClass(status: VerificationStatus): string {
  switch (status) {
    case "sales_ready":
      return "border-primary/40 bg-primary/15 text-primary";
    case "qualified":
      return "border-accent/40 bg-accent/20 text-accent-foreground";
    case "need_verification":
      return "border-border/60 bg-secondary/40 text-secondary-foreground";
    default:
      return "border-destructive/40 bg-destructive/10 text-destructive";
  }
}

export type SalesPriority = "HIGH" | "MEDIUM" | "LOW";

/** Priority combines reachability (contact quality) with ICP fit. */
export function salesPriority(contactScore: number, fitScore: number): SalesPriority {
  if (contactScore >= 75 && fitScore >= 70) return "HIGH";
  if (contactScore >= 50 && fitScore >= 45) return "MEDIUM";
  return "LOW";
}

export function priorityClass(priority: SalesPriority): string {
  if (priority === "HIGH") return "border-primary/40 bg-primary/15 text-primary";
  if (priority === "MEDIUM") return "border-accent/40 bg-accent/20 text-accent-foreground";
  return "border-border/60 bg-muted/30 text-muted-foreground";
}

/**
 * Daily Sales Queue rule: valid contact, contact quality >= 75, a recorded
 * source, an opportunity reason, not DO_NOT_CONTACT, not terminal.
 */
export function isQueueEligible(prospect: {
  do_not_contact?: boolean | null;
  status?: string | null;
  source?: string | null;
  opportunity_reason?: string | null;
  research_summary?: string | null;
  business_summary?: string | null;
} & ContactableProspect): boolean {
  if (prospect.do_not_contact) return false;
  const terminal = ["converted", "deal", "lost", "rejected", "do_not_contact"];
  if (terminal.includes(String(prospect.status ?? ""))) return false;
  if (!(prospect.source ?? "").trim()) return false;
  const reason = (prospect.opportunity_reason ?? prospect.business_summary ?? prospect.research_summary ?? "").trim();
  if (!reason) return false;
  return contactQuality(prospect).score >= 75;
}

/** Human-readable reasons a prospect is not yet allowed into the Daily Sales Queue. */
export function queueBlockers(
  prospect: {
    do_not_contact?: boolean | null;
    status?: string | null;
    source?: string | null;
    opportunity_reason?: string | null;
    research_summary?: string | null;
    business_summary?: string | null;
  } & ContactableProspect,
): string[] {
  const blockers: string[] = [];
  if (prospect.do_not_contact) blockers.push("Ditandai DO NOT CONTACT");
  const terminal = ["converted", "deal", "lost", "rejected", "do_not_contact"];
  if (terminal.includes(String(prospect.status ?? ""))) blockers.push("Status sudah selesai/terminal");
  if (!(prospect.source ?? "").trim()) blockers.push("Sumber data belum dicatat");
  const reason = (
    prospect.opportunity_reason ??
    prospect.business_summary ??
    prospect.research_summary ??
    ""
  ).trim();
  if (!reason) blockers.push("Belum ada opportunity reason (jalankan Prospect intelligence)");
  const quality = contactQuality(prospect);
  if (quality.score < 75) {
    const missing = quality.factors.filter((f) => f.score === 0).map((f) => f.label);
    blockers.push(
      `Contact quality ${quality.score}/100${missing.length ? ` — lengkapi: ${missing.join(", ")}` : ""}`,
    );
  }
  return blockers;
}

