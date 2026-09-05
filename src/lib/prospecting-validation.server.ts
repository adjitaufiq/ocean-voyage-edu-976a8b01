/**
 * Prospect Validation & Quality Gate — server-only.
 *
 * AI discovery output is never sellable on arrival. Every prospect walks the
 * ladder RAW -> VALIDATING -> VERIFIED -> SALES READY, or lands in REJECTED.
 * Six checks run first (business existence, Google Maps, contact provenance,
 * website liveness, social matching, duplicates); only when every blocking
 * check passes does the AI Quality Gate decide whether the row may be sold.
 * Nothing is deleted — results are stored on the row and in the activity trail.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";

import type { Database } from "@/integrations/supabase/types";
import { createAiModel, isAiConfigured } from "@/lib/ai/router";
import {
  contactQuality,
  scoreProspect,
  VALIDATION_CHECK_LABELS,
  VALIDATION_STAGE_LABELS,
  type QualityGateResult,
  type ValidationCheck,
  type ValidationCheckKey,
  type ValidationCheckState,
  type ValidationStage,
} from "@/lib/admin/prospecting";
import { fetchIcpConfig, findDuplicate, logProspectActivity } from "@/lib/prospecting.server";

type Client = SupabaseClient<Database>;

const VALIDATION_COLUMNS =
  "id, business_name, industry, city, website, website_domain, contact_name, contact_title, contact_email, contact_whatsapp, contact_phone, social_media, source, source_detail, research_summary, business_summary, opportunity_reason, recommended_solution, pain_signals, evidence, verified, phone_source, phone_source_url, email_source, email_source_url, website_source, website_source_url, social_source, social_source_url, google_maps_url, validation_stage, do_not_contact";

type ValidationRow = {
  id: string;
  business_name: string;
  website: string | null;
  social_media: string | null;
  google_maps_url: string | null;
  contact_email: string | null;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  [key: string]: unknown;
};

export type ProspectValidationResult = {
  id: string;
  businessName: string;
  stage: ValidationStage;
  stageLabel: string;
  score: number;
  checks: ValidationCheck[];
  qualityGate: QualityGateResult | null;
  contactScore: number;
  fitScore: number;
  rejectedReason: string | null;
};

export type ValidationRunResult = {
  scanned: number;
  verified: number;
  salesReady: number;
  rejected: number;
  results: ProspectValidationResult[];
};

/** Blocking checks must pass before a prospect can leave VALIDATING. */
const BLOCKING: Record<ValidationCheckKey, boolean> = {
  business_existence: true,
  google_maps: false,
  contact_source: true,
  website: false,
  social_match: false,
  duplicate: true,
};

const WEIGHT: Record<ValidationCheckKey, number> = {
  business_existence: 20,
  google_maps: 15,
  contact_source: 30,
  website: 15,
  social_match: 10,
  duplicate: 10,
};

function check(key: ValidationCheckKey, state: ValidationCheckState, detail: string): ValidationCheck {
  return { key, label: VALIDATION_CHECK_LABELS[key], state, detail, blocking: BLOCKING[key] };
}

function toUrl(value: unknown): URL | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}

/** Live-checks a URL. Network failures resolve to false, never throw. */
async function isAlive(url: URL): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "KerjakuProspectValidator/1.0" },
    });
    return response.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const SOCIAL_HOSTS = ["instagram.", "linkedin.", "facebook.", "fb.", "tiktok.", "x.com", "twitter."];

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

async function runChecks(
  supabase: Client,
  row: ValidationRow,
): Promise<{ checks: ValidationCheck[]; duplicateOf: string | null }> {
  const checks: ValidationCheck[] = [];

  // 1. Business existence — a name plus at least one locating attribute.
  const identity = [row["industry"], row["city"], row.website, row.google_maps_url].filter(
    (value) => typeof value === "string" && value.trim(),
  ).length;
  const named = row.business_name.trim().length >= 3;
  checks.push(
    named && identity > 0
      ? check("business_existence", "pass", `Nama bisnis dan ${identity} atribut identitas tercatat`)
      : check("business_existence", "fail", "Nama bisnis atau atribut identitas (industri/kota/website) belum ada"),
  );

  // 2. Google Maps availability.
  const maps = toUrl(row.google_maps_url);
  checks.push(
    maps
      ? check("google_maps", "pass", maps.toString())
      : check("google_maps", "warn", "Belum ada Google Maps URL sebagai bukti keberadaan fisik"),
  );

  // 3. Contact source verification (provenance).
  const quality = contactQuality(row as never);
  const unattributed = quality.provenance
    .filter((entry) => entry.value && entry.level === "unknown")
    .map((entry) => entry.label);
  checks.push(
    !quality.hasProvenSource
      ? check("contact_source", "fail", "Tidak ada kanal kontak dengan sumber terbukti (source type + URL bukti)")
      : unattributed.length
        ? check("contact_source", "fail", `Kontak tanpa sumber: ${unattributed.join(", ")}`)
        : check("contact_source", "pass", `Semua kanal beratribusi (contact quality ${quality.score}/100)`),
  );

  // 4. Website availability.
  const site = toUrl(row.website);
  if (!site) checks.push(check("website", "warn", "Prospek tidak memiliki website"));
  else {
    const alive = await isAlive(site);
    checks.push(
      alive
        ? check("website", "pass", `${site.hostname} merespons`)
        : check("website", "fail", `${site.hostname} tidak merespons`),
    );
  }

  // 5. Social media matching — profile URL that plausibly belongs to the business.
  const social = toUrl(row.social_media);
  if (!social) {
    checks.push(
      (row.social_media ?? "").trim()
        ? check("social_match", "fail", "Social media bukan URL profil yang valid")
        : check("social_match", "warn", "Belum ada social media resmi"),
    );
  } else {
    const host = social.hostname.replace(/^www\./, "").toLowerCase();
    const isPlatform = SOCIAL_HOSTS.some((candidate) => host.includes(candidate));
    const handle = social.pathname.replace(/\/+$/, "");
    const nameTokens = tokens(row.business_name);
    const matches =
      nameTokens.length === 0 ||
      nameTokens.some((token) => handle.toLowerCase().replace(/[^a-z0-9]/g, "").includes(token));
    checks.push(
      !isPlatform || handle.length <= 1
        ? check("social_match", "fail", "URL bukan profil bisnis pada platform social yang dikenal")
        : matches
          ? check("social_match", "pass", `Profil ${host}${handle} cocok dengan nama bisnis`)
          : check("social_match", "warn", `Profil ${host}${handle} tidak jelas cocok dengan nama bisnis`),
    );
  }

  // 6. Duplicate detection.
  const duplicate = await findDuplicate(supabase, {
    domain: (row["website_domain"] as string | null) ?? null,
    email: (row.contact_email ?? "").trim().toLowerCase() || null,
    whatsapp: row.contact_whatsapp ?? null,
  });
  const duplicateOf = duplicate && duplicate !== row.id ? duplicate : null;
  checks.push(
    duplicateOf
      ? check("duplicate", "fail", `Duplikat dari prospek ${duplicateOf}`)
      : check("duplicate", "pass", "Tidak ada duplikat berdasarkan domain, email, atau WhatsApp"),
  );

  return { checks, duplicateOf };
}

function scoreChecks(checks: ValidationCheck[]): number {
  const total = checks.reduce((sum, item) => sum + WEIGHT[item.key], 0);
  if (!total) return 0;
  const earned = checks.reduce((sum, item) => {
    const weight = WEIGHT[item.key];
    if (item.state === "pass") return sum + weight;
    if (item.state === "warn") return sum + weight * 0.5;
    return sum;
  }, 0);
  return Math.round((earned / total) * 100);
}

/** AI Quality Gate — the last human-proxy judgement before SALES READY. */
async function runQualityGate(
  row: ValidationRow,
  checks: ValidationCheck[],
  contactScore: number,
): Promise<QualityGateResult> {
  const fallback = (reason: string): QualityGateResult => ({
    passed: contactScore >= 75,
    score: contactScore,
    reasons: [reason],
    risks: [],
    model: null,
    at: new Date().toISOString(),
  });
  if (!isAiConfigured()) return fallback("AI gateway tidak aktif — memakai penilaian deterministik");

  const prompt = `Kamu QA sales KERJAKU. Nilai apakah prospek ini layak masuk Daily Sales Queue.
Tolak jika data terlihat mengarang, kontak tidak dapat dibuktikan, atau bisnis tidak jelas nyata.

Prospek:
- Bisnis: ${row.business_name}
- Industri: ${String(row["industry"] ?? "-")} | Kota: ${String(row["city"] ?? "-")}
- Website: ${String(row.website ?? "-")} | Maps: ${String(row.google_maps_url ?? "-")}
- Kontak: ${[row["contact_name"], row.contact_email, row.contact_whatsapp, row.contact_phone].filter(Boolean).join(" | ") || "-"}
- Contact quality: ${contactScore}/100
- Opportunity reason: ${String(row["opportunity_reason"] ?? "-")}
- Riset: ${String(row["research_summary"] ?? "-")}

Hasil validasi:
${checks.map((item) => `- ${item.label}: ${item.state.toUpperCase()} — ${item.detail}`).join("\n")}

Balas HANYA JSON: {"passed":true|false,"score":0-100,"reasons":["..."],"risks":["..."]}`;

  try {
    const { text } = await generateText({
      model: createAiModel("ORDER_BRIEF"),
      prompt,
      temperature: 0.2,
    });
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return fallback("AI tidak mengembalikan JSON valid");
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const list = (value: unknown) =>
      Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean).slice(0, 8) : [];
    return {
      passed: Boolean(parsed["passed"]) && contactScore >= 60,
      score: Math.max(0, Math.min(100, Number(parsed["score"] ?? 0))),
      reasons: list(parsed["reasons"]),
      risks: list(parsed["risks"]),
      model: "ai-gateway",
      at: new Date().toISOString(),
    };
  } catch (error) {
    return fallback(error instanceof Error ? error.message : "AI quality gate gagal");
  }
}

async function validateRow(
  supabase: Client,
  row: ValidationRow,
  config: Awaited<ReturnType<typeof fetchIcpConfig>>,
  actor: { userId: string; email?: string | null },
): Promise<ProspectValidationResult> {
  // Mark the row as in-flight so the UI never shows a stale "raw".
  await supabase
    .from("prospects")
    .update({ validation_stage: "validating" } as never)
    .eq("id", row.id);

  const { checks, duplicateOf } = await runChecks(supabase, row);
  const score = scoreChecks(checks);
  const quality = contactQuality(row as never);
  const scored = scoreProspect(row as never, config);

  const blockingFailures = checks.filter((item) => item.blocking && item.state === "fail");
  const hardReject = duplicateOf || checks.some((item) => item.key === "business_existence" && item.state === "fail");

  let stage: ValidationStage = "validating";
  let rejectedReason: string | null = null;
  let gate: QualityGateResult | null = null;

  if (hardReject) {
    stage = "rejected";
    rejectedReason = duplicateOf
      ? "Duplikat dari prospek lain"
      : "Keberadaan bisnis tidak dapat dipastikan";
  } else if (blockingFailures.length) {
    stage = "validating";
    rejectedReason = null;
  } else {
    stage = "verified";
    gate = await runQualityGate(row, checks, quality.score);
    if (gate.passed && quality.status === "sales_ready") stage = "sales_ready";
  }

  const notes = blockingFailures.length
    ? blockingFailures.map((item) => `${item.label}: ${item.detail}`).join(" | ")
    : checks
        .filter((item) => item.state === "warn")
        .map((item) => `${item.label}: ${item.detail}`)
        .join(" | ") || null;

  const update: Record<string, unknown> = {
    validation_stage: stage,
    validation_checks: checks,
    validation_score: score,
    validation_notes: notes,
    validated_at: new Date().toISOString(),
    quality_gate: gate ?? {},
    quality_gate_passed: Boolean(gate?.passed) && stage === "sales_ready",
    rejected_reason: rejectedReason,
    duplicate_of: duplicateOf,
    fit_score: scored.total,
    fit_tier: scored.tier,
    fit_breakdown: scored.factors,
  };

  const { error } = await supabase
    .from("prospects")
    .update(update as never)
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  await logProspectActivity(supabase, {
    prospectId: row.id,
    action: "research",
    label: `Validasi — ${VALIDATION_STAGE_LABELS[stage]} (skor ${score}/100)`,
    content: [
      ...checks.map((item) => `${item.label}: ${item.state.toUpperCase()} — ${item.detail}`),
      gate ? `Quality gate: ${gate.passed ? "LULUS" : "TIDAK LULUS"} (${gate.score}/100)` : null,
      gate?.reasons.length ? `Alasan: ${gate.reasons.join("; ")}` : null,
      gate?.risks.length ? `Risiko: ${gate.risks.join("; ")}` : null,
      rejectedReason ? `Ditolak: ${rejectedReason}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    meta: {
      kind: "validation",
      stage,
      validation_score: score,
      contact_score: quality.score,
      quality_gate_passed: Boolean(gate?.passed),
    },
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return {
    id: row.id,
    businessName: row.business_name,
    stage,
    stageLabel: VALIDATION_STAGE_LABELS[stage],
    score,
    checks,
    qualityGate: gate,
    contactScore: quality.score,
    fitScore: scored.total,
    rejectedReason,
  };
}

/** Validates one prospect (`ids`) or a batch of pending rows (`scope: "all"`). */
export async function validateProspects(
  supabase: Client,
  input: { ids?: string[]; scope?: "one" | "all"; limit?: number },
  actor: { userId: string; email?: string | null },
): Promise<ValidationRunResult> {
  const config = await fetchIcpConfig(supabase);

  let query = supabase
    .from("prospects")
    .select(VALIDATION_COLUMNS)
    .order("created_at", { ascending: true });
  if (input.ids?.length) query = query.in("id", input.ids);
  else {
    query = query
      .in("validation_stage", ["raw", "validating", "verified"])
      .limit(Math.min(input.limit ?? 40, 100));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as ValidationRow[];

  const results: ProspectValidationResult[] = [];
  const BATCH = 4;
  for (let index = 0; index < rows.length; index += BATCH) {
    const batch = rows.slice(index, index + BATCH);
    const settled = await Promise.all(
      batch.map((row) =>
        validateRow(supabase, row, config, actor).catch(
          (batchError): ProspectValidationResult => ({
            id: row.id,
            businessName: row.business_name,
            stage: "validating",
            stageLabel: VALIDATION_STAGE_LABELS.validating,
            score: 0,
            checks: [],
            qualityGate: null,
            contactScore: 0,
            fitScore: 0,
            rejectedReason: batchError instanceof Error ? batchError.message : "Validasi gagal",
          }),
        ),
      ),
    );
    results.push(...settled);
  }

  return {
    scanned: results.length,
    verified: results.filter((result) => result.stage === "verified").length,
    salesReady: results.filter((result) => result.stage === "sales_ready").length,
    rejected: results.filter((result) => result.stage === "rejected").length,
    results,
  };
}
