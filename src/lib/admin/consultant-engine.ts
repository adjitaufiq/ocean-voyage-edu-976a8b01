/**
 * KERJAKU CONSULTANT ENGINE (Phase 3).
 *
 * Satu pintu decision intelligence untuk Sales Agent, Sales Preparation,
 * Ready Outreach, Order Brief, dan Proposal.
 *
 * Aturan pokok:
 *   1. Engine TIDAK membuat knowledge baru. Seluruh keputusan memakai library
 *      yang sudah ada (consultant-library, industry-context,
 *      problem-solution-map, feature-library, package-decision-sop).
 *   2. FACT hanya berasal dari evidence yang benar-benar ada pada input.
 *      HYPOTHESIS ditandai jelas dan TIDAK boleh dianggap kebutuhan customer.
 *   3. Seluruh proses deterministik (tanpa panggilan AI), sehingga hasilnya
 *      dapat diversi dan dibandingkan lewat input_hash.
 *   4. Chatbot existing tidak disentuh — engine ini murni analysis layer.
 */

import {
  detectBusinessMaturity,
  selectConsultantFeatures,
  consultantFeature,
  type BusinessMaturity,
  type ConsultantPick,
  type ConsultantTier,
} from "./consultant-library";
import {
  detectIndustryContext,
  shortBusinessName,
  stagePhrase,
  BUSINESS_MODEL_NOTE,
  type BusinessModel,
  type IndustryContext,
} from "./industry-context";
import { buildProblemSolutionPlan } from "./problem-solution-map";
import { detectSelectedFeatures, recommendFeatures, findFeature } from "./feature-library";
import { decidePackageLevel, type PackageLevel } from "./package-decision-sop";
import type { OrderBriefData } from "../order-brief";

export const ENGINE_VERSION = "consultant-engine@1.0.0";
export const KNOWLEDGE_VERSION = "kerjaku-knowledge@2026-09";

/* ------------------------------------------------------------------ */
/* INPUT                                                               */
/* ------------------------------------------------------------------ */

export type ConsultantEngineInput = {
  businessName: string;
  category?: string | null;
  industryHint?: string | null;
  city?: string | null;
  province?: string | null;
  address?: string | null;
  website?: string | null;
  websiteStatus?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  socialProfiles?: { network: string; url?: string | null; active?: boolean }[];
  rating?: number | null;
  reviewCount?: number | null;
  googleMapsUrl?: string | null;
  placeId?: string | null;
  /** Masalah yang customer sebut sendiri (konsultasi / order brief). */
  statedProblems?: string[];
  /** Tujuan yang customer sebut sendiri. */
  statedGoals?: string[];
  /** Fitur yang sudah diminta customer. */
  statedFeatures?: string[];
  /** Skala pengguna / kebutuhan admin. */
  scaleText?: string | null;
  /** Catatan tambahan (ringkasan percakapan read-only, catatan sales). */
  notes?: string[];
  /** Revisi data sumber; naik saat evidence berubah. */
  sourceRevision?: number;
};

/* ------------------------------------------------------------------ */
/* OUTPUT                                                              */
/* ------------------------------------------------------------------ */

export type FactSource = "google_maps" | "website" | "social" | "contact_data" | "customer" | "review";

export type ObservedFact = {
  key: string;
  statement: string;
  source: FactSource;
  sourceUrl: string | null;
  confidence: number;
};

export type ProblemHypothesis = {
  id: string;
  statement: string;
  /** Fakta yang menjadi dasar dugaan (key dari observed facts). */
  basis: string[];
  confidence: number;
  /** Fitur yang relevan bila dugaan ini terbukti. */
  featureHints: string[];
  /** Selalu true: dugaan bukan kebutuhan yang dikonfirmasi customer. */
  needsValidation: true;
};

export type ConfirmedProblem = {
  statement: string;
  source: "customer";
  featureHints: string[];
};

export type SolutionFeature = {
  id: string;
  name: string;
  reason: string;
  /** Masalah/dugaan yang menjadi alasan fitur ini muncul. */
  solves: string | null;
  basis: "fact" | "customer" | "hypothesis";
};

export type ConsultantAnalysis = {
  engineVersion: string;
  knowledgeVersion: string;
  inputHash: string;
  sourceRevision: number;
  businessProfile: {
    name: string;
    shortName: string;
    category: string | null;
    location: string | null;
    website: string | null;
    contactChannels: string[];
    summary: string;
  };
  industryContext: {
    id: string | null;
    name: string;
    aka: string;
    jobTerm: string;
    customerTerm: string;
    stages: string[];
    matched: boolean;
  };
  businessModel: { id: BusinessModel | null; note: string };
  businessMaturity: { level: BusinessMaturity; reason: string };
  observedFacts: ObservedFact[];
  problemHypotheses: ProblemHypothesis[];
  confirmedProblems: ConfirmedProblem[];
  problemEvidence: { problem: string; evidence: string[] }[];
  businessGoals: string[];
  coreSolution: { headline: string; features: SolutionFeature[] };
  coreFeatures: SolutionFeature[];
  optionalFeatures: SolutionFeature[];
  recommendedPackage: { level: PackageLevel; name: string; rationale: string; signals: string[] };
  consultantReasoning: string[];
  salesAngle: { headline: string; talkingPoints: string[]; openingHook: string };
  validationQuestions: string[];
  objectionGuidance: { objection: string; response: string }[];
  confidenceScore: number;
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

const PACKAGE_NAME: Record<PackageLevel, string> = {
  basic: "Landing Page",
  professional: "Professional System",
  business: "Digital Workflow Solution",
  enterprise: "Enterprise System",
};

function clean(value: string | null | undefined): string {
  return (value ?? "").toString().trim();
}

function list(values: string[] | undefined): string[] {
  return (values ?? []).map(clean).filter(Boolean);
}

/** FNV-1a — stabil lintas proses, cukup untuk mendeteksi perubahan input. */
export function hashInput(input: ConsultantEngineInput): string {
  const canonical = JSON.stringify({
    engine: ENGINE_VERSION,
    knowledge: KNOWLEDGE_VERSION,
    name: clean(input.businessName).toLowerCase(),
    category: clean(input.category).toLowerCase(),
    industry: clean(input.industryHint).toLowerCase(),
    city: clean(input.city).toLowerCase(),
    address: clean(input.address).toLowerCase(),
    website: clean(input.website).toLowerCase(),
    websiteStatus: clean(input.websiteStatus),
    phone: clean(input.phone),
    whatsapp: clean(input.whatsapp),
    email: clean(input.email).toLowerCase(),
    social: (input.socialProfiles ?? [])
      .map((s) => `${s.network}:${clean(s.url)}:${s.active ? 1 : 0}`)
      .sort(),
    rating: input.rating ?? null,
    reviews: input.reviewCount ?? null,
    maps: clean(input.googleMapsUrl),
    place: clean(input.placeId),
    problems: list(input.statedProblems).map((v) => v.toLowerCase()).sort(),
    goals: list(input.statedGoals).map((v) => v.toLowerCase()).sort(),
    features: list(input.statedFeatures).map((v) => v.toLowerCase()).sort(),
    scale: clean(input.scaleText).toLowerCase(),
    notes: list(input.notes).map((v) => v.toLowerCase()).sort(),
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a_${hash.toString(16).padStart(8, "0")}_${canonical.length.toString(16)}`;
}

/* ------------------------------------------------------------------ */
/* FACTS — hanya dari evidence                                         */
/* ------------------------------------------------------------------ */

function buildFacts(input: ConsultantEngineInput): ObservedFact[] {
  const facts: ObservedFact[] = [];
  const maps = clean(input.googleMapsUrl) || null;

  const listedOnMaps = Boolean(clean(input.placeId) || maps);
  if (listedOnMaps) {
    facts.push({
      key: "maps_listing",
      statement: "Bisnis terdaftar pada Google Maps",
      source: "google_maps",
      sourceUrl: maps,
      confidence: 95,
    });
  }

  const city = clean(input.city);
  const address = clean(input.address);
  if (city || address) {
    facts.push({
      key: "location_known",
      statement: `Lokasi usaha tercatat: ${[address, city, clean(input.province)].filter(Boolean).join(", ")}`,
      source: listedOnMaps ? "google_maps" : "contact_data",
      sourceUrl: maps,
      confidence: 90,
    });
  }

  const website = clean(input.website);
  const websiteStatus = clean(input.websiteStatus).toLowerCase();
  if (website) {
    facts.push({
      key: "website_found",
      statement: `Website ditemukan: ${website}`,
      source: "website",
      sourceUrl: website,
      confidence: 90,
    });
  } else {
    facts.push({
      key: "website_missing",
      statement:
        websiteStatus === "not_found" || !websiteStatus
          ? "Website tidak ditemukan pada sumber manapun"
          : `Website tidak tersedia (status: ${websiteStatus})`,
      source: listedOnMaps ? "google_maps" : "website",
      sourceUrl: maps,
      confidence: listedOnMaps ? 85 : 60,
    });
  }

  const whatsapp = clean(input.whatsapp);
  const phone = clean(input.phone);
  if (whatsapp) {
    facts.push({
      key: "whatsapp_available",
      statement: `Nomor WhatsApp tersedia: ${whatsapp}`,
      source: "contact_data",
      sourceUrl: null,
      confidence: 90,
    });
  } else if (phone) {
    facts.push({
      key: "phone_available",
      statement: `Nomor telepon tersedia: ${phone}`,
      source: "contact_data",
      sourceUrl: maps,
      confidence: 85,
    });
  } else {
    facts.push({
      key: "contact_missing",
      statement: "Nomor kontak belum ditemukan dari sumber manapun",
      source: "contact_data",
      sourceUrl: null,
      confidence: 70,
    });
  }

  if (clean(input.email)) {
    facts.push({
      key: "email_available",
      statement: `Email bisnis tersedia: ${clean(input.email)}`,
      source: "contact_data",
      sourceUrl: null,
      confidence: 80,
    });
  }

  const socials = (input.socialProfiles ?? []).filter((s) => clean(s.network));
  const activeSocial = socials.filter((s) => s.active !== false);
  if (activeSocial.length) {
    for (const s of activeSocial) {
      facts.push({
        key: `social_${clean(s.network).toLowerCase()}`,
        statement: `Akun ${clean(s.network)} aktif${clean(s.url) ? `: ${clean(s.url)}` : ""}`,
        source: "social",
        sourceUrl: clean(s.url) || null,
        confidence: 75,
      });
    }
  } else {
    facts.push({
      key: "social_missing",
      statement: "Akun media sosial bisnis belum terverifikasi",
      source: "social",
      sourceUrl: null,
      confidence: 55,
    });
  }

  const rating = typeof input.rating === "number" ? input.rating : null;
  const reviews = typeof input.reviewCount === "number" ? input.reviewCount : null;
  if (rating !== null || reviews !== null) {
    facts.push({
      key: "reviews_available",
      statement: `Ulasan publik tersedia${rating !== null ? `, rating ${rating}` : ""}${
        reviews !== null ? ` dari ${reviews} ulasan` : ""
      }`,
      source: "review",
      sourceUrl: maps,
      confidence: 85,
    });
    if (reviews !== null && reviews >= 150) {
      facts.push({
        key: "high_traffic_reviews",
        statement: `Jumlah ulasan tinggi (${reviews}) menandakan volume kunjungan besar`,
        source: "review",
        sourceUrl: maps,
        confidence: 80,
      });
    }
  }

  for (const [index, note] of list(input.notes).entries()) {
    facts.push({
      key: `customer_note_${index + 1}`,
      statement: note,
      source: "customer",
      sourceUrl: null,
      confidence: 70,
    });
  }

  return facts;
}

/* ------------------------------------------------------------------ */
/* HYPOTHESES — dugaan, bukan kebutuhan                                */
/* ------------------------------------------------------------------ */

type HypothesisRule = {
  id: string;
  requiresFacts: string[];
  forbidsFacts?: string[];
  models?: BusinessModel[];
  statement: (ctx: IndustryContext | null) => string;
  featureHints: string[];
  confidence: number;
};

const HYPOTHESIS_RULES: HypothesisRule[] = [
  {
    id: "no_owned_channel",
    requiresFacts: ["website_missing"],
    statement: (ctx) =>
      `Kemungkinan ${ctx ? ctx.customerTerm : "calon pelanggan"} hanya menemukan bisnis lewat pencarian peta dan media sosial, tanpa kanal resmi milik sendiri`,
    featureHints: ["company-profile", "katalog", "whatsapp"],
    confidence: 70,
  },
  {
    id: "manual_booking",
    requiresFacts: ["website_missing"],
    models: ["appointment", "recurring-service", "membership"],
    statement: (ctx) =>
      `Kemungkinan proses ${ctx ? ctx.intakeTerm : "pemesanan jadwal"} masih dicatat manual lewat chat atau buku jadwal`,
    featureHints: ["booking", "schedule-management", "notification"],
    confidence: 60,
  },
  {
    id: "manual_order_record",
    requiresFacts: ["maps_listing"],
    models: ["custom-project", "recurring-service", "product-sales", "wholesale", "rental", "event"],
    statement: (ctx) =>
      `Kemungkinan pencatatan ${ctx ? ctx.jobTerm : "order"} masih manual sehingga status pekerjaan sulit dipantau`,
    featureHints: ["order-management", "status-tracking", "digital-nota"],
    confidence: 55,
  },
  {
    id: "no_customer_database",
    requiresFacts: ["reviews_available"],
    statement: (ctx) =>
      `Kemungkinan data ${ctx ? ctx.customerTerm : "pelanggan"} belum tersimpan rapi sehingga follow-up pelanggan lama belum optimal`,
    featureHints: ["database-customer", "customer-history"],
    confidence: 55,
  },
  {
    id: "high_volume_ops",
    requiresFacts: ["high_traffic_reviews"],
    statement: (ctx) =>
      `Volume kunjungan besar membuat pencatatan harian kemungkinan menumpuk dan laporan bisnis masih manual`,
    featureHints: ["dashboard-admin", "laporan-penjualan"],
    confidence: 60,
  },
  {
    id: "catalog_gap",
    requiresFacts: ["website_found"],
    models: ["product-sales", "wholesale", "custom-project"],
    statement: (ctx) =>
      `Website sudah ada, kemungkinan yang belum tersedia adalah ${ctx ? `katalog ${ctx.productTerm}` : "katalog produk"} yang bisa diperbarui sendiri`,
    featureHints: ["katalog", "cms"],
    confidence: 50,
  },
  {
    id: "unreachable_channel",
    requiresFacts: ["contact_missing"],
    statement: () =>
      "Kemungkinan pesan masuk tersebar di beberapa kanal pribadi sehingga sulit dipastikan siapa yang menjawab",
    featureHints: ["whatsapp", "form-konsultasi"],
    confidence: 45,
  },
];

function buildHypotheses(
  facts: ObservedFact[],
  ctx: IndustryContext | null,
): ProblemHypothesis[] {
  const keys = new Set(facts.map((f) => f.key));
  const out: ProblemHypothesis[] = [];
  for (const rule of HYPOTHESIS_RULES) {
    if (!rule.requiresFacts.every((k) => keys.has(k))) continue;
    if (rule.forbidsFacts?.some((k) => keys.has(k))) continue;
    if (rule.models && (!ctx || !rule.models.includes(ctx.model))) continue;
    out.push({
      id: rule.id,
      statement: rule.statement(ctx),
      basis: rule.requiresFacts,
      confidence: rule.confidence,
      featureHints: rule.featureHints,
      needsValidation: true,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* ENGINE                                                              */
/* ------------------------------------------------------------------ */

function toSyntheticBrief(
  input: ConsultantEngineInput,
  problems: string[],
  goals: string[],
): OrderBriefData {
  return {
    version: 1,
    customerName: clean(input.businessName) || "Calon customer",
    whatsapp: clean(input.whatsapp) || null,
    email: clean(input.email) || null,
    business: [clean(input.businessName), clean(input.category), clean(input.industryHint)]
      .filter(Boolean)
      .join(" "),
    project: clean(input.category) || clean(input.industryHint) || clean(input.businessName),
    goal: goals.join(". ") || null,
    problems,
    usersScale: clean(input.scaleText) || null,
    adminNeeds: null,
    features: list(input.statedFeatures),
    timeline: null,
    budget: null,
    recommendation: null,
    source: null,
    createdAt: new Date(0).toISOString(),
  };
}

function pickToSolution(pick: ConsultantPick, basis: SolutionFeature["basis"]): SolutionFeature {
  return {
    id: pick.id,
    name: pick.name,
    reason: pick.reasons[0] ?? pick.benefit,
    solves: pick.solves,
    basis,
  };
}

export function buildConsultantAnalysis(input: ConsultantEngineInput): ConsultantAnalysis {
  const name = clean(input.businessName) || "Bisnis tanpa nama";
  const category = clean(input.category) || clean(input.industryHint) || null;
  const businessText = [name, category].filter(Boolean).join(" ");

  const facts = buildFacts(input);
  const contextText = [
    businessText,
    clean(input.city),
    clean(input.scaleText),
    ...list(input.statedFeatures),
    ...list(input.notes),
    ...facts.map((f) => f.statement),
  ]
    .filter(Boolean)
    .join(" | ");

  const ctx = detectIndustryContext(businessText, contextText);
  const hypotheses = buildHypotheses(facts, ctx);

  const statedProblems = list(input.statedProblems);
  const statedGoals = list(input.statedGoals);
  const confirmedProblems: ConfirmedProblem[] = statedProblems.map((statement) => ({
    statement,
    source: "customer",
    featureHints: [],
  }));

  const maturity = detectBusinessMaturity({
    context: contextText,
    problemText: statedProblems.join(" "),
    scaleText: clean(input.scaleText),
  });

  const brief = toSyntheticBrief(input, statedProblems, statedGoals);
  const decision = decidePackageLevel(brief, contextText);

  // Problem → Solution hanya dari masalah/tujuan yang customer sebut sendiri.
  const plan = buildProblemSolutionPlan({
    businessText,
    problemText: statedProblems.join(". "),
    goalText: statedGoals.join(". "),
    context: contextText,
  });
  for (const problem of confirmedProblems) {
    for (const [id, label] of plan.core.entries()) {
      if (label === problem.statement) problem.featureHints.push(id);
    }
  }

  const maxTier: ConsultantTier = decision.allowEnterprise ? "enterprise" : "business";
  const picks = selectConsultantFeatures({
    businessText,
    context: contextText,
    maxTier,
    problemText: statedProblems.join(". "),
    goalText: statedGoals.join(". "),
    scaleText: clean(input.scaleText) || undefined,
    briefFeatureText: list(input.statedFeatures).join(", "),
    allowEnterprise: decision.allowEnterprise,
    limit: 8,
  });

  const coreFromPicks = picks.filter((p) => p.role === "core").map((p) => pickToSolution(p, "customer"));
  const growthFromPicks = picks.filter((p) => p.role === "growth").map((p) => pickToSolution(p, "hypothesis"));

  // Fitur dari dugaan hanya masuk bila belum tercakup fitur dari masalah nyata.
  const used = new Set(coreFromPicks.map((f) => f.id));
  const hypothesisFeatures: SolutionFeature[] = [];
  for (const hypothesis of hypotheses) {
    for (const id of hypothesis.featureHints) {
      if (used.has(id)) continue;
      const feature = consultantFeature(id);
      if (!feature) continue;
      used.add(id);
      hypothesisFeatures.push({
        id: feature.id,
        name: feature.name,
        reason: feature.benefit,
        solves: hypothesis.statement,
        basis: "hypothesis",
      });
    }
  }

  const coreFeatures = coreFromPicks.length ? coreFromPicks : hypothesisFeatures.slice(0, 3);

  // Bila customer belum menyebut masalah apa pun, fitur inti tetap harus
  // mengikuti cara kerja industrinya — bukan paket generik yang sama untuk
  // semua bisnis. Tetap ditandai "hypothesis" karena belum divalidasi.
  if (!coreFromPicks.length && ctx) {
    for (const hintId of MODEL_CORE_HINT[ctx.model] ?? []) {
      if (coreFeatures.some((f) => f.id === hintId)) continue;
      const feature = consultantFeature(hintId);
      if (!feature) continue;
      used.add(hintId);
      coreFeatures.push({
        id: feature.id,
        name: feature.name,
        reason: feature.benefit,
        solves: `Pola kerja ${ctx.aka}: ${ctx.stages.slice(0, 3).join(" → ")}`,
        basis: "hypothesis",
      });
    }
  }

  const optionalPool = [
    ...growthFromPicks,
    ...hypothesisFeatures.filter((f) => !coreFeatures.some((c) => c.id === f.id)),
  ];
  const optionalSeen = new Set(coreFeatures.map((f) => f.id));
  const optionalFeatures = optionalPool.filter((f) => {
    if (optionalSeen.has(f.id)) return false;
    optionalSeen.add(f.id);
    return true;
  });

  // Pelengkap dari katalog fitur (harga/positioning) tanpa duplikasi.
  const selectedLibrary = detectSelectedFeatures([
    ...list(input.statedFeatures),
    ...coreFeatures.map((f) => f.name),
  ]);
  const catalogExtras = recommendFeatures({
    selected: selectedLibrary,
    excludeIds: [...optionalSeen],
    context: contextText,
    limit: 3,
  });
  for (const extra of catalogExtras) {
    if (optionalSeen.has(extra.id)) continue;
    optionalSeen.add(extra.id);
    optionalFeatures.push({
      id: extra.id,
      name: extra.name,
      reason: extra.description,
      solves: null,
      basis: "hypothesis",
    });
  }

  const shortName = shortBusinessName(name);
  const industryAka = ctx ? ctx.aka : category ?? "bisnis";
  const modelNote = ctx ? BUSINESS_MODEL_NOTE[ctx.model] : "pola pendapatan belum dapat dipastikan dari data publik";

  const contactChannels = [
    clean(input.whatsapp) ? "WhatsApp" : "",
    clean(input.phone) ? "Telepon" : "",
    clean(input.email) ? "Email" : "",
    ...(input.socialProfiles ?? []).filter((s) => s.active !== false).map((s) => clean(s.network)),
  ].filter(Boolean);

  const problemEvidence = [
    ...confirmedProblems.map((p) => ({
      problem: p.statement,
      evidence: ["Disebutkan langsung oleh customer"],
    })),
    ...hypotheses.map((h) => ({
      problem: h.statement,
      evidence: h.basis
        .map((key) => facts.find((f) => f.key === key)?.statement)
        .filter((v): v is string => Boolean(v)),
    })),
  ];

  const validationQuestions = [
    ...hypotheses.map((h) => hypothesisToQuestion(h, ctx)),
    statedProblems.length
      ? "Dari semua kendala tadi, mana yang paling ingin diselesaikan lebih dulu?"
      : `Saat ini proses ${ctx ? ctx.jobTerm : "order"} dicatat di mana?`,
  ].slice(0, 6);

  const confidenceScore = scoreConfidence(facts, hypotheses, statedProblems.length, Boolean(ctx));

  const consultantReasoning = [
    `Identifikasi bisnis: ${shortName}${category ? ` (${category})` : ""}${ctx ? `, dibaca sebagai ${industryAka}` : ", industri belum terpetakan dari kosakata publik"}.`,
    `Model bisnis: ${modelNote}.`,
    `Tahap bisnis: ${maturity} — dipakai sebagai bobot pemilihan fitur, bukan penentu paket.`,
    `Fakta terverifikasi: ${facts.length} temuan dari sumber eksternal/customer.`,
    statedProblems.length
      ? `Masalah yang customer sebut sendiri: ${statedProblems.length} poin, menjadi dasar Core Solution.`
      : "Belum ada masalah yang dikonfirmasi customer, sehingga Core Solution bersifat dugaan dan wajib divalidasi saat kontak pertama.",
    `Keputusan paket mengikuti SOP: ${decision.rationale}`,
  ];

  return {
    engineVersion: ENGINE_VERSION,
    knowledgeVersion: KNOWLEDGE_VERSION,
    inputHash: hashInput(input),
    sourceRevision: input.sourceRevision ?? 1,
    businessProfile: {
      name,
      shortName,
      category,
      location: [clean(input.city), clean(input.province)].filter(Boolean).join(", ") || null,
      website: clean(input.website) || null,
      contactChannels,
      summary: `${shortName} adalah ${industryAka}${
        clean(input.city) ? ` di ${clean(input.city)}` : ""
      }. ${capitalize(modelNote)}.`,
    },
    industryContext: {
      id: ctx?.id ?? null,
      name: ctx?.name ?? category ?? "Belum terpetakan",
      aka: industryAka,
      jobTerm: ctx?.jobTerm ?? "order",
      customerTerm: ctx?.customerTerm ?? "pelanggan",
      stages: ctx?.stages ?? [],
      matched: Boolean(ctx),
    },
    businessModel: { id: ctx?.model ?? null, note: modelNote },
    businessMaturity: {
      level: maturity,
      reason: `Dibaca dari skala pengguna, struktur tim, dan volume aktivitas pada data yang tersedia.`,
    },
    observedFacts: facts,
    problemHypotheses: hypotheses,
    confirmedProblems,
    problemEvidence,
    businessGoals: statedGoals,
    coreSolution: {
      headline: coreFeatures.length
        ? `${coreFeatures[0]!.name} sebagai titik awal pembenahan ${ctx ? ctx.jobTerm : "operasional"}`
        : "Belum cukup data untuk menetapkan solusi inti",
      features: coreFeatures,
    },
    coreFeatures,
    optionalFeatures,
    recommendedPackage: {
      level: decision.level,
      name: PACKAGE_NAME[decision.level],
      rationale: decision.rationale,
      signals: decision.signals,
    },
    consultantReasoning,
    salesAngle: buildSalesAngle({ shortName, ctx, facts, hypotheses, coreFeatures, industryAka }),
    validationQuestions,
    objectionGuidance: buildObjections(decision.level, ctx, shortName),
    confidenceScore,
  };
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function hypothesisToQuestion(h: ProblemHypothesis, ctx: IndustryContext | null): string {
  switch (h.id) {
    case "no_owned_channel":
      return `Kalau ada ${ctx ? ctx.customerTerm : "calon pelanggan"} baru yang mau cek layanan, biasanya diarahkan ke mana?`;
    case "manual_booking":
      return `Untuk ${ctx ? ctx.intakeTerm : "pemesanan jadwal"}, pencatatannya sekarang lewat apa?`;
    case "manual_order_record":
      return `Setiap ${ctx ? ctx.jobTerm : "order"} masuk, dicatat di buku, chat, atau sudah ada sistemnya?`;
    case "no_customer_database":
      return "Data pelanggan lama sekarang tersimpan di mana, dan apakah masih dihubungi lagi?";
    case "high_volume_ops":
      return "Laporan harian/bulanan sekarang disusun manual atau sudah otomatis?";
    case "catalog_gap":
      return "Isi website sekarang bisa diperbarui sendiri atau harus lewat pihak lain?";
    default:
      return "Pesan masuk dari pelanggan sekarang ditangani lewat kanal apa saja?";
  }
}

function buildSalesAngle(args: {
  shortName: string;
  ctx: IndustryContext | null;
  facts: ObservedFact[];
  hypotheses: ProblemHypothesis[];
  coreFeatures: SolutionFeature[];
  industryAka: string;
}): ConsultantAnalysis["salesAngle"] {
  const { shortName, ctx, facts, hypotheses, coreFeatures, industryAka } = args;
  const hasWebsite = facts.some((f) => f.key === "website_found");
  const reviewFact = facts.find((f) => f.key === "reviews_available");

  const headline = hasWebsite
    ? `${shortName} sudah punya kanal digital — peluangnya di sisi operasional`
    : `${shortName} belum punya kanal resmi sendiri`;

  const talkingPoints = [
    reviewFact ? reviewFact.statement : "Bisnis sudah terlihat pada pencarian lokal",
    ctx
      ? `Alur kerja ${industryAka} melewati ${stagePhrase(ctx)} — titik yang paling sering bocor ada di antara tahap tersebut`
      : "Alur kerja perlu dikonfirmasi langsung saat kontak pertama",
    coreFeatures.length ? `Solusi awal yang relevan: ${coreFeatures.map((f) => f.name).join(", ")}` : "Solusi menunggu hasil validasi",
    hypotheses.length ? `Dugaan utama yang perlu dicek: ${hypotheses[0]!.statement}` : "",
  ].filter(Boolean);

  const openingHook = hasWebsite
    ? `Halo ${shortName}, saya lihat website-nya sudah jalan. Boleh tanya, bagian ${ctx ? ctx.jobTerm : "order"} masuk sekarang dikelola bagaimana?`
    : `Halo ${shortName}, saya lihat profilnya di Google Maps${reviewFact ? " dengan ulasan yang cukup ramai" : ""}. Boleh tanya, calon ${ctx ? ctx.customerTerm : "pelanggan"} biasanya diarahkan ke mana untuk lihat layanan lengkapnya?`;

  return { headline, talkingPoints, openingHook };
}

function buildObjections(
  level: PackageLevel,
  ctx: IndustryContext | null,
  shortName: string,
): ConsultantAnalysis["objectionGuidance"] {
  return [
    {
      objection: "Belum butuh, masih bisa manual",
      response: `Wajar. Yang kami bantu justru saat manual mulai memakan waktu — mis. ketika ${
        ctx ? ctx.jobTerm : "order"
      } masuk bersamaan. Boleh saya tanya dulu berapa banyak yang masuk per hari?`,
    },
    {
      objection: "Harganya berapa?",
      response: `Untuk kebutuhan seperti ${shortName}, arahnya ke paket ${PACKAGE_NAME[level]}. Angka pastinya saya susun setelah tahu proses kerjanya, supaya tidak bayar fitur yang tidak dipakai.`,
    },
    {
      objection: "Sudah pernah bikin, tapi tidak terpakai",
      response: "Biasanya karena dibuat tanpa mengikuti alur kerja hariannya. Kami mulai dari proses yang sudah berjalan, bukan dari daftar fitur.",
    },
    {
      objection: "Nanti dulu, mau diskusi dengan partner",
      response: "Siap. Saya kirim ringkasan singkat berisi temuan dan usulan awalnya supaya mudah dibahas bersama.",
    },
  ];
}

function scoreConfidence(
  facts: ObservedFact[],
  hypotheses: ProblemHypothesis[],
  statedProblemCount: number,
  industryMatched: boolean,
): number {
  const strongFacts = facts.filter((f) => f.confidence >= 80).length;
  let score = Math.min(45, strongFacts * 9);
  if (industryMatched) score += 20;
  if (statedProblemCount > 0) score += Math.min(20, statedProblemCount * 7);
  if (hypotheses.length) score += 5;
  if (facts.some((f) => f.key === "reviews_available")) score += 5;
  if (facts.some((f) => f.key === "contact_missing")) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ------------------------------------------------------------------ */
/* SALES CONTEXT SNAPSHOT (dibaca Sales Agent, bukan diagnosis sendiri) */
/* ------------------------------------------------------------------ */

export type SalesContextSnapshot = {
  businessSummary: string;
  verifiedFacts: string[];
  problemHypotheses: string[];
  confidence: number;
  validationQuestions: string[];
  recommendedSolution: { package: string; features: string[] };
  salesAngle: ConsultantAnalysis["salesAngle"];
  objectionGuidance: ConsultantAnalysis["objectionGuidance"];
};

export function buildSalesContextSnapshot(analysis: ConsultantAnalysis): SalesContextSnapshot {
  return {
    businessSummary: analysis.businessProfile.summary,
    verifiedFacts: analysis.observedFacts.map((f) => f.statement),
    problemHypotheses: analysis.problemHypotheses.map((h) => h.statement),
    confidence: analysis.confidenceScore,
    validationQuestions: analysis.validationQuestions,
    recommendedSolution: {
      package: analysis.recommendedPackage.name,
      features: analysis.coreFeatures.map((f) => f.name),
    },
    salesAngle: analysis.salesAngle,
    objectionGuidance: analysis.objectionGuidance,
  };
}

/* ------------------------------------------------------------------ */
/* ORDER BRIEF ADAPTER (renderer/PDF lama tetap dipakai)               */
/* ------------------------------------------------------------------ */

export function analysisToOrderBrief(
  analysis: ConsultantAnalysis,
  contact: { customerName?: string | null; whatsapp?: string | null; email?: string | null } = {},
): OrderBriefData {
  const problems = [
    ...analysis.confirmedProblems.map((p) => p.statement),
    ...analysis.problemHypotheses.map((h) => `Dugaan (perlu validasi): ${h.statement}`),
  ];
  const features = analysis.coreFeatures.map((f) => {
    const lib = findFeature(f.id);
    return lib ? lib.name : f.name;
  });
  return {
    version: 1,
    customerName: clean(contact.customerName) || analysis.businessProfile.name,
    whatsapp: clean(contact.whatsapp) || null,
    email: clean(contact.email) || null,
    business: [analysis.businessProfile.name, analysis.businessProfile.category].filter(Boolean).join(" — "),
    project: analysis.coreSolution.headline,
    goal: analysis.businessGoals.join(". ") || analysis.salesAngle.headline,
    problems,
    usersScale: null,
    adminNeeds: null,
    features,
    timeline: null,
    budget: null,
    recommendation: analysis.recommendedPackage.name,
    source: null,
    createdAt: new Date().toISOString(),
  };
}
