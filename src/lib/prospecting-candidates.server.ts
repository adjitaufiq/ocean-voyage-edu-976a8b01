/**
 * Candidate layer — server-only (V4 sales intelligence pipeline).
 *
 * AI Discovery Agent responsibility: propose candidate businesses and explain
 * WHY they might fit. It is structurally prevented from producing contact
 * facts — the parser uses a strict whitelist, so any phone/email/website/URL
 * the model invents is dropped before it ever reaches the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";

import type { Database } from "@/integrations/supabase/types";
import { createAiModel, isAiConfigured } from "@/lib/ai/router";
import {
  campaignPrimarySolution,
  campaignSolutionList,
  type CampaignRow,
} from "@/lib/admin/prospecting";
import {
  canTransition,
  candidateIcpReason,
  candidateIcpScore,
  ICP_REVIEW_THRESHOLD,
  normalizeBusinessKey,
  type ActorKind,
  type CandidateEventRow,
  type CandidateRow,
  type CandidateStatus,
} from "@/lib/admin/prospect-candidates";
import { fetchIcpConfig } from "@/lib/prospecting.server";

type Client = SupabaseClient<Database>;

const CANDIDATE_COLUMNS =
  "id, campaign_id, business_name, industry, city, country, why_match_icp, potential_problem_hypothesis, buying_signal_hypothesis, suggested_solution, discovery_reason, discovery_method, discovery_query, discovery_source, candidate_status, duplicate_status, duplicate_of, icp_score, trust_score, rejected_reason, promoted_prospect_id, icp_reason, approved_by_email, approved_at, approval_note, review_requested_at, created_at";

function asRow(row: Record<string, unknown>): CandidateRow {
  return {
    id: String(row["id"]),
    campaign_id: (row["campaign_id"] as string | null) ?? null,
    business_name: String(row["business_name"]),
    industry: (row["industry"] as string | null) ?? null,
    city: (row["city"] as string | null) ?? null,
    country: String(row["country"] ?? "Indonesia"),
    why_match_icp: (row["why_match_icp"] as string | null) ?? null,
    potential_problem_hypothesis: (row["potential_problem_hypothesis"] as string | null) ?? null,
    buying_signal_hypothesis: (row["buying_signal_hypothesis"] as string | null) ?? null,
    suggested_solution: (row["suggested_solution"] as string | null) ?? null,
    discovery_reason: (row["discovery_reason"] as string | null) ?? null,
    discovery_method: (row["discovery_method"] as CandidateRow["discovery_method"]) ?? "manual",
    discovery_query: (row["discovery_query"] as string | null) ?? null,
    discovery_source: (row["discovery_source"] as string | null) ?? null,
    candidate_status: (row["candidate_status"] as CandidateStatus) ?? "discovered",
    duplicate_status: (row["duplicate_status"] as CandidateRow["duplicate_status"]) ?? "unchecked",
    duplicate_of: (row["duplicate_of"] as string | null) ?? null,
    icp_score: Number(row["icp_score"] ?? 0),
    trust_score: Number(row["trust_score"] ?? 0),
    rejected_reason: (row["rejected_reason"] as string | null) ?? null,
    promoted_prospect_id: (row["promoted_prospect_id"] as string | null) ?? null,
    icp_reason: (row["icp_reason"] as string | null) ?? null,
    approved_by_email: (row["approved_by_email"] as string | null) ?? null,
    approved_at: (row["approved_at"] as string | null) ?? null,
    approval_note: (row["approval_note"] as string | null) ?? null,
    review_requested_at: (row["review_requested_at"] as string | null) ?? null,
    created_at: String(row["created_at"]),
  };
}

export type CandidateFilter = {
  status?: string;
  campaignId?: string;
  search?: string;
  limit?: number;
};

export async function fetchCandidates(
  supabase: Client,
  filter: CandidateFilter = {},
): Promise<CandidateRow[]> {
  let query = supabase
    .from("prospect_candidates")
    .select(CANDIDATE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(Math.min(500, filter.limit ?? 100));

  if (filter.status && filter.status !== "all") query = query.eq("candidate_status", filter.status);
  if (filter.campaignId) query = query.eq("campaign_id", filter.campaignId);
  if (filter.search?.trim()) query = query.ilike("business_name", `%${filter.search.trim()}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => asRow(row as Record<string, unknown>));
}

export type CandidateSummary = {
  discovered: number;
  enriching: number;
  verified: number;
  pending_review: number;
  approved: number;
  rejected: number;
  promoted: number;
};

export async function buildCandidateSummary(supabase: Client): Promise<CandidateSummary> {
  const { data, error } = await supabase
    .from("prospect_candidates")
    .select("candidate_status")
    .limit(5000);
  if (error) throw new Error(error.message);
  const summary: CandidateSummary = {
    discovered: 0,
    enriching: 0,
    verified: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    promoted: 0,
  };
  for (const row of data ?? []) {
    const status = String((row as { candidate_status: string }).candidate_status);
    if (status in summary) summary[status as keyof CandidateSummary] += 1;
  }
  return summary;
}

/* --------------------------- AI Discovery Agent --------------------------- */

/** Hypothesis-only shape. No contact facts exist in this type by design. */
type AiCandidate = {
  businessName: string;
  industry?: string;
  city?: string;
  country?: string;
  whyMatchIcp?: string;
  potentialProblemHypothesis?: string;
  buyingSignalHypothesis?: string;
  suggestedSolution?: string;
  discoveryReason?: string;
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Strict whitelist parser: only hypothesis fields survive. Any contact-looking
 * field the model returns is discarded, so AI can never author a fact.
 */
export function parseCandidateArray(raw: string): AiCandidate[] {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: AiCandidate[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = text(record["businessName"], 200);
    if (!name || name.length < 2) continue;
    out.push({
      businessName: name,
      industry: text(record["industry"], 120) ?? undefined,
      city: text(record["city"], 120) ?? undefined,
      country: text(record["country"], 80) ?? undefined,
      whyMatchIcp: text(record["whyMatchIcp"], 1000) ?? undefined,
      potentialProblemHypothesis:
        text(record["potentialProblemHypothesis"], 1000) ?? undefined,
      buyingSignalHypothesis: text(record["buyingSignalHypothesis"], 1000) ?? undefined,
      suggestedSolution: text(record["suggestedSolution"], 300) ?? undefined,
      discoveryReason: text(record["discoveryReason"], 1000) ?? undefined,
    });
  }
  return out;
}

function buildCandidatePrompt(campaign: CampaignRow, count: number, exclude: string[]): string {
  return `Kamu adalah AI Discovery Agent untuk KERJAKU (software house Indonesia: website, aplikasi custom, dashboard bisnis, otomasi AI).

Tugas: usulkan ${count} KANDIDAT bisnis yang kemungkinan cocok dengan target pasar berikut.

Parameter kampanye:
- Industri target: ${campaign.industry}
- Lokasi: ${campaign.location}
- Kata kunci: ${campaign.keywords.join(", ") || "-"}
- Solusi utama: ${campaignPrimarySolution(campaign) || campaign.solution}
- Seluruh solusi kampanye: ${campaignSolutionList(campaign).join(", ") || campaign.solution}

Jangan ulang bisnis berikut: ${exclude.slice(0, 60).join("; ") || "-"}

ATURAN MUTLAK — kamu HANYA boleh menghasilkan hipotesis, bukan fakta:
- DILARANG menuliskan nomor telepon, WhatsApp, email, alamat, URL website, URL Google Maps, atau akun media sosial. Data itu akan diambil sistem dari sumber eksternal, bukan darimu.
- DILARANG mengklaim data sudah terverifikasi atau menyebut "sumber terpercaya".
- Kalau kamu tidak yakin sebuah bisnis benar-benar ada, jangan usulkan.
- Nama bisnis harus nama yang lazim dipakai publik sehingga bisa dicari di Google Maps.

Untuk setiap kandidat jelaskan secara spesifik (bukan kalimat generik):
- whyMatchIcp: kenapa profil bisnis ini cocok dengan target pasar kampanye.
- potentialProblemHypothesis: dugaan masalah operasional/digital yang mungkin mereka hadapi.
- buyingSignalHypothesis: dugaan sinyal bahwa mereka siap membeli solusi.
- suggestedSolution: satu solusi dari daftar kampanye yang paling relevan sebagai pembuka.
- discoveryReason: dasar pemikiranmu memilih bisnis ini.

Balas HANYA array JSON dengan bentuk:
[{"businessName":"","industry":"","city":"","country":"Indonesia","whyMatchIcp":"","potentialProblemHypothesis":"","buyingSignalHypothesis":"","suggestedSolution":"","discoveryReason":""}]`;
}

export type CandidateDiscoveryResult = {
  runId: string | null;
  found: number;
  saved: number;
  skipped: number;
  status: "ok" | "ai_unavailable" | "empty";
  candidates: { id: string; name: string }[];
};

export async function discoverCandidates(
  supabase: Client,
  input: { campaignId: string; count?: number },
  actor: { userId: string; email?: string | null },
): Promise<CandidateDiscoveryResult> {
  const { data: campaignRow, error } = await supabase
    .from("prospect_campaigns")
    .select(
      "id, name, industry, location, keywords, solution, solutions, custom_solutions, primary_solution, daily_target, status, notes, last_run_at, total_discovered, created_at",
    )
    .eq("id", input.campaignId)
    .maybeSingle();
  if (error || !campaignRow) throw new Error(error?.message ?? "Kampanye tidak ditemukan.");

  const row = campaignRow as Record<string, unknown>;
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
  const campaign: CampaignRow = {
    id: String(row["id"]),
    name: String(row["name"]),
    industry: String(row["industry"]),
    location: String(row["location"]),
    keywords: list(row["keywords"]),
    solution: String(row["solution"] ?? ""),
    solutions: list(row["solutions"]),
    custom_solutions: list(row["custom_solutions"]),
    primary_solution: (row["primary_solution"] as string | null) ?? null,
    daily_target: Number(row["daily_target"] ?? 10),
    status: String(row["status"] ?? "active"),
    notes: (row["notes"] as string | null) ?? null,
    last_run_at: (row["last_run_at"] as string | null) ?? null,
    total_discovered: Number(row["total_discovered"] ?? 0),
    created_at: String(row["created_at"]),
  };

  const count = Math.max(1, Math.min(25, input.count ?? campaign.daily_target));
  const query = `${campaign.industry} • ${campaign.location} • ${campaign.keywords.join(", ")}`;

  const { data: runRow } = await supabase
    .from("prospect_runs")
    .insert({
      kind: "discovery",
      trigger_source: "manual",
      query,
      status: "running",
      created_by: actor.userId,
      meta: { campaign_id: campaign.id, campaign_name: campaign.name, layer: "candidate" } as never,
    } as never)
    .select("id")
    .single();
  const runId = (runRow as { id: string } | null)?.id ?? null;

  const finish = async (status: string, patch: Record<string, unknown>) => {
    if (!runId) return;
    await supabase
      .from("prospect_runs")
      .update({ status, finished_at: new Date().toISOString(), ...patch } as never)
      .eq("id", runId);
  };

  if (!isAiConfigured()) {
    await finish("failed", { error: "AI gateway belum dikonfigurasi." });
    return { runId, found: 0, saved: 0, skipped: 0, status: "ai_unavailable", candidates: [] };
  }

  const [{ data: existingProspects }, { data: existingCandidates }] = await Promise.all([
    supabase.from("prospects").select("business_name").limit(150),
    supabase.from("prospect_candidates").select("business_name").limit(300),
  ]);
  const exclude = [
    ...(existingProspects ?? []).map((item) => String((item as { business_name: string }).business_name)),
    ...(existingCandidates ?? []).map((item) => String((item as { business_name: string }).business_name)),
  ];
  const excludeKeys = new Set(exclude.map(normalizeBusinessKey));

  let parsed: AiCandidate[] = [];
  try {
    const { text: answer } = await generateText({
      model: createAiModel("ORDER_BRIEF"),
      prompt: buildCandidatePrompt(campaign, count, exclude),
      temperature: 0.6,
    });
    parsed = parseCandidateArray(answer).slice(0, count);
  } catch (aiError) {
    await finish("failed", {
      error: aiError instanceof Error ? aiError.message.slice(0, 400) : "AI gagal.",
      ai_calls: 1,
    });
    throw new Error("Discovery AI gagal. Coba lagi beberapa saat lagi.");
  }

  if (!parsed.length) {
    await finish("done", { found_count: 0, saved_count: 0, skipped_count: 0, ai_calls: 1 });
    return { runId, found: 0, saved: 0, skipped: 0, status: "empty", candidates: [] };
  }

  const icp = await fetchIcpConfig(supabase).catch(() => null);
  const saved: { id: string; name: string }[] = [];
  let skipped = 0;

  for (const item of parsed) {
    const key = normalizeBusinessKey(item.businessName);
    if (!key || excludeKeys.has(key)) {
      skipped += 1;
      continue;
    }
    excludeKeys.add(key);

    const candidateShape = {
      industry: item.industry ?? null,
      city: item.city ?? null,
      why_match_icp: item.whyMatchIcp ?? null,
      potential_problem_hypothesis: item.potentialProblemHypothesis ?? null,
      buying_signal_hypothesis: item.buyingSignalHypothesis ?? null,
      suggested_solution: item.suggestedSolution ?? null,
    };
    const icpScore = candidateIcpScore(candidateShape as never, {
      industries: icp?.industries ?? [],
      cities: icp?.cities ?? [],
      painKeywords: icp?.painKeywords ?? [],
    });

    const icpReason = candidateIcpReason(candidateShape as never, {
      industries: icp?.industries ?? [],
      cities: icp?.cities ?? [],
      painKeywords: icp?.painKeywords ?? [],
    });

    const { data: inserted, error: insertError } = await supabase
      .from("prospect_candidates")
      .insert({
        campaign_id: campaign.id,
        business_name: item.businessName,
        ...candidateShape,
        country: item.country ?? "Indonesia",
        discovery_reason: item.discoveryReason ?? null,
        discovery_method: "ai_discovery",
        discovery_query: query,
        discovery_source: "ai_discovery",
        raw_payload: item as never,
        candidate_status: "discovered",
        icp_score: icpScore,
        icp_reason: icpReason,
        created_by: actor.userId,
      } as never)
      .select("id, business_name")
      .single();

    if (insertError || !inserted) {
      skipped += 1;
      continue;
    }
    saved.push({
      id: (inserted as { id: string }).id,
      name: (inserted as { business_name: string }).business_name,
    });
  }

  await finish("done", {
    found_count: parsed.length,
    saved_count: saved.length,
    skipped_count: skipped,
    ai_calls: 1,
  });

  if (saved.length) {
    await supabase
      .from("prospect_campaigns")
      .update({
        last_run_at: new Date().toISOString(),
        total_discovered: campaign.total_discovered + saved.length,
      } as never)
      .eq("id", campaign.id);
  }

  return {
    runId,
    found: parsed.length,
    saved: saved.length,
    skipped,
    status: "ok",
    candidates: saved,
  };
}

/* ------------------------------ Candidate ops ----------------------------- */

export async function rejectCandidate(
  supabase: Client,
  input: { id: string; reason?: string | null },
): Promise<{ ok: true }> {
  const { error } = await supabase
    .from("prospect_candidates")
    .update({
      candidate_status: "rejected",
      rejected_reason: input.reason?.slice(0, 500) ?? "Ditolak manual",
    } as never)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function restoreCandidate(supabase: Client, id: string): Promise<{ ok: true }> {
  const { error } = await supabase
    .from("prospect_candidates")
    .update({ candidate_status: "discovered", rejected_reason: null } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function createManualCandidate(
  supabase: Client,
  input: {
    businessName: string;
    industry?: string | null;
    city?: string | null;
    campaignId?: string | null;
    whyMatchIcp?: string | null;
  },
  actor: { userId: string },
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("prospect_candidates")
    .insert({
      business_name: input.businessName.trim().slice(0, 200),
      industry: input.industry?.trim() || null,
      city: input.city?.trim() || null,
      campaign_id: input.campaignId ?? null,
      why_match_icp: input.whyMatchIcp?.trim() || null,
      discovery_method: "manual",
      discovery_source: "manual",
      created_by: actor.userId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id };
}
