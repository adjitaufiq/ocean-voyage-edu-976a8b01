/**
 * KERJAKU CONSULTANT ENGINE SERVICE — SERVER ONLY (Phase 3).
 *
 * Satu pintu decision intelligence: mengumpulkan input dari Business Entity
 * Layer (Phase 1-2) + data lama yang tertaut, menjalankan engine deterministik
 * (src/lib/admin/consultant-engine.ts), lalu menyimpan hasilnya sebagai versi
 * baru pada business_consultant_analyses.
 *
 * Service ini TIDAK membuat pipeline atau scheduler baru, tidak menghapus
 * logika lama, dan tidak menyentuh chatbot (akses percakapan hanya lewat
 * consultant-chat-adapter yang read-only).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import {
  ENGINE_VERSION,
  KNOWLEDGE_VERSION,
  analysisToOrderBrief,
  buildConsultantAnalysis,
  buildSalesContextSnapshot,
  hashInput,
  type ConsultantAnalysis,
  type ConsultantEngineInput,
  type SalesContextSnapshot,
} from "@/lib/admin/consultant-engine";
import { readConversationSummaries } from "@/lib/consultant-chat-adapter";
import type { OrderBriefData } from "@/lib/order-brief";

type Client = SupabaseClient<Database>;

export type GenerateResult = {
  entityId: string;
  status: "generated" | "reused" | "skipped";
  reason?: string;
  analysisId: string | null;
  version: number;
  inputHash: string;
  confidence: number;
};

const asJson = (value: unknown): Json => JSON.parse(JSON.stringify(value ?? null)) as Json;

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[\n;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* INPUT COLLECTION                                                    */
/* ------------------------------------------------------------------ */

export async function collectEngineInput(
  supabase: Client,
  entityId: string,
): Promise<{ input: ConsultantEngineInput; entityName: string } | null> {
  const { data: entity, error } = await supabase
    .from("business_entities")
    .select(
      "id, canonical_name, industry, business_model, address, city, province, website, website_domain, google_place_id, phone, whatsapp, email, source_revision",
    )
    .eq("id", entityId)
    .maybeSingle();
  if (error) throw new Error(`Gagal membaca business entity: ${error.message}`);
  if (!entity) return null;

  const { data: links, error: linkErr } = await supabase
    .from("business_entity_links")
    .select("legacy_type, legacy_id")
    .eq("business_entity_id", entityId)
    .eq("is_active", true);
  if (linkErr) throw new Error(`Gagal membaca tautan data lama: ${linkErr.message}`);

  const idsOf = (type: string) =>
    (links ?? []).filter((l) => l.legacy_type === type).map((l) => l.legacy_id);

  const input: ConsultantEngineInput = {
    businessName: entity.canonical_name,
    category: entity.industry,
    industryHint: entity.business_model,
    city: entity.city,
    province: entity.province,
    address: entity.address,
    website: entity.website,
    phone: entity.phone,
    whatsapp: entity.whatsapp,
    email: entity.email,
    placeId: entity.google_place_id,
    socialProfiles: [],
    statedProblems: [],
    statedGoals: [],
    statedFeatures: [],
    notes: [],
    sourceRevision: entity.source_revision ?? 1,
  };

  // A. Scraped business (kandidat hasil discovery + enrichment).
  const candidateIds = idsOf("prospect_candidate");
  if (candidateIds.length) {
    const { data: candidates } = await supabase
      .from("prospect_candidates")
      .select(
        "id, business_name, category, industry, city, province, address, website, website_status, phone, rating, review_count, google_maps_url, place_id, contact_data, digital_gap",
      )
      .in("id", candidateIds)
      .order("updated_at", { ascending: false })
      .limit(5);
    const primary = candidates?.[0];
    if (primary) {
      input.category = input.category ?? primary.category ?? primary.industry;
      input.city = input.city ?? primary.city;
      input.province = input.province ?? primary.province;
      input.address = input.address ?? primary.address;
      input.website = input.website ?? primary.website;
      input.websiteStatus = primary.website_status;
      input.phone = input.phone ?? primary.phone;
      input.rating = primary.rating;
      input.reviewCount = primary.review_count;
      input.googleMapsUrl = primary.google_maps_url;
      input.placeId = input.placeId ?? primary.place_id;
      const contact = (primary.contact_data ?? {}) as Record<string, { value?: string; source?: string }>;
      for (const [channel, entry] of Object.entries(contact)) {
        const value = entry?.value?.trim();
        if (!value) continue;
        if (channel === "whatsapp") input.whatsapp = input.whatsapp ?? value;
        else if (channel === "email") input.email = input.email ?? value;
        else if (channel === "phone") input.phone = input.phone ?? value;
        else input.socialProfiles!.push({ network: channel, url: value, active: true });
      }
      if (primary.digital_gap) input.notes!.push(primary.digital_gap);
    }

    const { data: enrichments } = await supabase
      .from("prospect_enrichments")
      .select("prospect_candidate_id, source_type, source_url, status, normalized_data")
      .in("prospect_candidate_id", candidateIds)
      .limit(50);
    for (const row of enrichments ?? []) {
      const sourceType = String(row.source_type ?? "").toLowerCase();
      const normalized = (row.normalized_data ?? {}) as Record<string, unknown>;
      const url = row.source_url ?? (typeof normalized["url"] === "string" ? (normalized["url"] as string) : null);
      if (!url) continue;
      if (/instagram|facebook|tiktok|social/.test(sourceType)) {
        input.socialProfiles!.push({ network: sourceType, url, active: row.status === "completed" });
      } else if (sourceType.includes("website") && !input.website) {
        input.website = url;
      }
    }
  }

  // B. Data konsultasi / order brief yang customer isi sendiri.
  const consultationIds = idsOf("consultation");
  if (consultationIds.length) {
    const { data: consultations } = await supabase
      .from("consultations")
      .select("id, business_name, ai_business_category, ai_problems, features, notes, budget, whatsapp, email")
      .in("id", consultationIds)
      .limit(5);
    for (const row of consultations ?? []) {
      input.category = input.category ?? row.ai_business_category;
      input.whatsapp = input.whatsapp ?? row.whatsapp;
      input.email = input.email ?? row.email;
      input.statedProblems!.push(...textList(row.ai_problems));
      input.statedFeatures!.push(...textList(row.features));
      if (row.notes) input.notes!.push(row.notes);
    }
  }

  // C. Prospek CRM lama (masalah bisnis yang sudah dicatat sales).
  const prospectIds = idsOf("prospect");
  if (prospectIds.length) {
    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, business_problem, industry, city, contact_whatsapp, contact_email, contact_phone")
      .in("id", prospectIds)
      .limit(5);
    for (const row of prospects ?? []) {
      if (row.business_problem) input.statedProblems!.push(row.business_problem);
      input.category = input.category ?? row.industry;
      input.city = input.city ?? row.city;
      input.whatsapp = input.whatsapp ?? row.contact_whatsapp;
      input.email = input.email ?? row.contact_email;
      input.phone = input.phone ?? row.contact_phone;
    }
  }

  // D. Ringkasan percakapan chatbot — READ ONLY lewat adapter.
  const conversationIds = idsOf("ai_conversation");
  if (conversationIds.length) {
    const summaries = await readConversationSummaries(supabase, conversationIds.slice(0, 5));
    for (const row of summaries) {
      input.statedProblems!.push(...row.problems);
      input.statedFeatures!.push(...row.features);
      if (row.summary) input.notes!.push(row.summary);
      input.scaleText = input.scaleText ?? row.usersScale;
      input.category = input.category ?? row.businessCategory;
      input.whatsapp = input.whatsapp ?? row.whatsapp;
      input.email = input.email ?? row.email;
    }
  }

  // E. Temuan hasil respons customer (Phase 6). Fakta terkonfirmasi ikut
  // menjadi masukan; dugaan yang sudah ditolak customer tidak dipakai lagi.
  const { data: findings } = await supabase
    .from("business_findings")
    .select("kind, statement, validation_status")
    .eq("business_entity_id", entityId)
    .in("validation_status", ["confirmed", "unvalidated"])
    .limit(60);
  for (const row of findings ?? []) {
    if (row.validation_status === "confirmed") {
      if (/^belum memiliki/i.test(row.statement)) input.statedProblems!.push(row.statement);
      else input.notes!.push(row.statement);
    } else if (row.kind === "hypothesis") {
      input.notes!.push(`Dugaan belum divalidasi: ${row.statement}`);
    }
  }

  return { input, entityName: entity.canonical_name };
}

/* ------------------------------------------------------------------ */
/* VERSIONING + PERSISTENCE                                            */
/* ------------------------------------------------------------------ */

export async function generateAnalysis(
  supabase: Client,
  options: { entityId: string; force?: boolean },
): Promise<GenerateResult> {
  const collected = await collectEngineInput(supabase, options.entityId);
  if (!collected) {
    return {
      entityId: options.entityId,
      status: "skipped",
      reason: "Business entity tidak ditemukan",
      analysisId: null,
      version: 0,
      inputHash: "",
      confidence: 0,
    };
  }

  const inputHash = hashInput(collected.input);
  const sourceRevision = collected.input.sourceRevision ?? 1;

  const { data: latest, error: latestErr } = await supabase
    .from("business_consultant_analyses")
    .select("id, version, status, input_hash, engine_version, knowledge_version, source_revision, confidence")
    .eq("business_entity_id", options.entityId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw new Error(`Gagal membaca analisis terakhir: ${latestErr.message}`);

  const reusable =
    latest &&
    latest.status === "completed" &&
    latest.input_hash === inputHash &&
    latest.engine_version === ENGINE_VERSION &&
    latest.knowledge_version === KNOWLEDGE_VERSION &&
    latest.source_revision === sourceRevision;

  if (reusable && !options.force) {
    return {
      entityId: options.entityId,
      status: "reused",
      analysisId: latest.id,
      version: latest.version,
      inputHash,
      confidence: latest.confidence ?? 0,
    };
  }

  const analysis = buildConsultantAnalysis(collected.input);
  const version = (latest?.version ?? 0) + 1;

  const { data: inserted, error: insertErr } = await supabase
    .from("business_consultant_analyses")
    .insert({
      business_entity_id: options.entityId,
      version,
      engine_version: ENGINE_VERSION,
      knowledge_version: KNOWLEDGE_VERSION,
      input_hash: inputHash,
      source_revision: sourceRevision,
      status: "completed",
      business_profile: asJson(analysis.businessProfile),
      industry_context: asJson(analysis.industryContext),
      business_model: asJson(analysis.businessModel),
      business_stage: asJson(analysis.businessMaturity),
      observed_facts: asJson(analysis.observedFacts),
      problem_hypotheses: asJson(analysis.problemHypotheses),
      confirmed_problems: asJson(analysis.confirmedProblems),
      problem_evidence: asJson(analysis.problemEvidence),
      business_goals: asJson(analysis.businessGoals),
      core_solution: asJson(analysis.coreSolution),
      recommended_features: asJson(analysis.coreFeatures),
      optional_features: asJson(analysis.optionalFeatures),
      recommended_package: asJson(analysis.recommendedPackage),
      consultant_reasoning: asJson(analysis.consultantReasoning),
      sales_angle: asJson(analysis.salesAngle),
      validation_questions: asJson(analysis.validationQuestions),
      objection_guidance: asJson(analysis.objectionGuidance),
      confidence: analysis.confidenceScore,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(`Gagal menyimpan analisis: ${insertErr.message}`);

  // Versi lama ditandai stale (bukan dihapus) agar riwayat tetap tersimpan.
  const { error: staleErr } = await supabase
    .from("business_consultant_analyses")
    .update({ status: "stale", superseded_at: new Date().toISOString() })
    .eq("business_entity_id", options.entityId)
    .neq("id", inserted.id)
    .eq("status", "completed");
  if (staleErr) throw new Error(`Gagal menandai analisis lama: ${staleErr.message}`);

  const { error: entityErr } = await supabase
    .from("business_entities")
    .update({ current_analysis_id: inserted.id })
    .eq("id", options.entityId);
  if (entityErr) throw new Error(`Gagal memperbarui penanda analisis aktif: ${entityErr.message}`);

  return {
    entityId: options.entityId,
    status: "generated",
    analysisId: inserted.id,
    version,
    inputHash,
    confidence: analysis.confidenceScore,
  };
}

export async function generateAnalysesForEntities(
  supabase: Client,
  options: { limit?: number; force?: boolean; entityIds?: string[] } = {},
): Promise<{ scanned: number; generated: number; reused: number; skipped: number; failed: number; errors: string[]; results: GenerateResult[] }> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);
  let ids = options.entityIds ?? [];
  if (!ids.length) {
    const { data, error } = await supabase
      .from("business_entities")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Gagal membaca daftar bisnis: ${error.message}`);
    ids = (data ?? []).map((row) => row.id);
  }
  ids = ids.slice(0, limit);

  const results: GenerateResult[] = [];
  const errors: string[] = [];
  let generated = 0;
  let reused = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      const result = await generateAnalysis(supabase, { entityId: id, force: options.force });
      results.push(result);
      if (result.status === "generated") generated += 1;
      else if (result.status === "reused") reused += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      if (errors.length < 5) errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { scanned: ids.length, generated, reused, skipped, failed, errors, results };
}

/* ------------------------------------------------------------------ */
/* READ PATHS (Sales Agent, Order Brief, Proposal)                     */
/* ------------------------------------------------------------------ */

export type StoredAnalysis = {
  id: string;
  version: number;
  status: Database["public"]["Enums"]["business_analysis_status"];
  generatedAt: string | null;
  analysis: ConsultantAnalysis;
};

export async function getCurrentAnalysis(
  supabase: Client,
  entityId: string,
): Promise<StoredAnalysis | null> {
  const { data, error } = await supabase
    .from("business_consultant_analyses")
    .select("*")
    .eq("business_entity_id", entityId)
    .eq("status", "completed")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Gagal membaca analisis aktif: ${error.message}`);
  if (!data) return null;

  const analysis = {
    engineVersion: data.engine_version ?? ENGINE_VERSION,
    knowledgeVersion: data.knowledge_version ?? KNOWLEDGE_VERSION,
    inputHash: data.input_hash ?? "",
    sourceRevision: data.source_revision,
    businessProfile: data.business_profile,
    industryContext: data.industry_context,
    businessModel: data.business_model,
    businessMaturity: data.business_stage,
    observedFacts: data.observed_facts,
    problemHypotheses: data.problem_hypotheses,
    confirmedProblems: data.confirmed_problems,
    problemEvidence: data.problem_evidence,
    businessGoals: data.business_goals,
    coreSolution: data.core_solution,
    coreFeatures: data.recommended_features,
    optionalFeatures: data.optional_features,
    recommendedPackage: data.recommended_package,
    consultantReasoning: data.consultant_reasoning,
    salesAngle: data.sales_angle,
    validationQuestions: data.validation_questions,
    objectionGuidance: data.objection_guidance,
    confidenceScore: data.confidence ?? 0,
  } as unknown as ConsultantAnalysis;

  return { id: data.id, version: data.version, status: data.status, generatedAt: data.generated_at, analysis };
}

/** Sales Agent membaca snapshot ini, bukan membuat diagnosis sendiri. */
export async function getSalesContextSnapshot(
  supabase: Client,
  entityId: string,
  options: { generateIfMissing?: boolean } = {},
): Promise<(SalesContextSnapshot & { analysisId: string; version: number }) | null> {
  let stored = await getCurrentAnalysis(supabase, entityId);
  if (!stored && options.generateIfMissing) {
    await generateAnalysis(supabase, { entityId });
    stored = await getCurrentAnalysis(supabase, entityId);
  }
  if (!stored) return null;
  return { ...buildSalesContextSnapshot(stored.analysis), analysisId: stored.id, version: stored.version };
}

/** Order Brief / Proposal memakai renderer lama, hanya datanya dari engine. */
export async function getOrderBriefFromAnalysis(
  supabase: Client,
  entityId: string,
  contact: { customerName?: string | null; whatsapp?: string | null; email?: string | null } = {},
): Promise<OrderBriefData | null> {
  const stored = await getCurrentAnalysis(supabase, entityId);
  if (!stored) return null;
  return analysisToOrderBrief(stored.analysis, contact);
}
