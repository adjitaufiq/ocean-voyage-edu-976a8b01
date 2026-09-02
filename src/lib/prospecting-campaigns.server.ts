/**
 * Prospect campaigns + AI prospecting agent — server-only.
 *
 * The AI proposes candidate businesses and the reasoning behind them; it never
 * sends anything. Every generated prospect is stored with its claimed source
 * and `verified = false` so a human must confirm the data before outreach.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";

import type { Database } from "@/integrations/supabase/types";
import { createAiModel, isAiConfigured } from "@/lib/ai/router";
import { PROSPECT_SOURCES, type CampaignRow } from "@/lib/admin/prospecting";
import { createProspect, logProspectActivity } from "@/lib/prospecting.server";

type Client = SupabaseClient<Database>;

const CAMPAIGN_COLUMNS =
  "id, name, industry, location, keywords, solution, daily_target, status, notes, last_run_at, total_discovered, created_at";

function toKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return [];
}

function rowToCampaign(row: Record<string, unknown>): CampaignRow {
  return {
    id: String(row["id"]),
    name: String(row["name"]),
    industry: String(row["industry"]),
    location: String(row["location"]),
    keywords: toKeywords(row["keywords"]),
    solution: String(row["solution"]),
    daily_target: Number(row["daily_target"] ?? 10),
    status: String(row["status"] ?? "active"),
    notes: (row["notes"] as string | null) ?? null,
    last_run_at: (row["last_run_at"] as string | null) ?? null,
    total_discovered: Number(row["total_discovered"] ?? 0),
    created_at: String(row["created_at"]),
  };
}

/* ------------------------------- Campaign CRUD ---------------------------- */

export async function fetchCampaigns(supabase: Client): Promise<CampaignRow[]> {
  const { data, error } = await supabase
    .from("prospect_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToCampaign(row as Record<string, unknown>));
}

export type CampaignInput = {
  id?: string;
  name: string;
  industry: string;
  location: string;
  keywords: string[];
  solution: string;
  dailyTarget: number;
  status?: string;
  notes?: string | null;
};

export async function saveCampaign(
  supabase: Client,
  input: CampaignInput,
  userId: string,
): Promise<{ id: string }> {
  const payload = {
    name: input.name.trim().slice(0, 150),
    industry: input.industry.trim().slice(0, 120),
    location: input.location.trim().slice(0, 120),
    keywords: input.keywords
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20) as never,
    solution: input.solution.trim().slice(0, 150),
    daily_target: Math.max(1, Math.min(50, input.dailyTarget)),
    status: input.status ?? "active",
    notes: input.notes?.slice(0, 2000) ?? null,
  };

  if (input.id) {
    const { error } = await supabase
      .from("prospect_campaigns")
      .update(payload as never)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from("prospect_campaigns")
    .insert({ ...payload, created_by: userId } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id };
}

export async function deleteCampaign(supabase: Client, id: string): Promise<{ ok: true }> {
  const { error } = await supabase.from("prospect_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------ AI discovery ------------------------------ */

type Candidate = {
  businessName: string;
  industry?: string;
  city?: string;
  website?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  socialMedia?: string;
  contactPerson?: string;
  source?: string;
  sourceDetail?: string;
  businessSummary?: string;
  potentialNeed?: string;
  opportunityReason?: string;
  recommendedSolution?: string;
  salesApproach?: string;
  painSignals?: string[];
  evidence?: string[];
};

function parseJsonArray(text: string): Candidate[] {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Candidate =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as Candidate).businessName === "string",
    );
  } catch {
    return [];
  }
}

function normalizeSource(value: string | undefined): string {
  const raw = (value ?? "").toLowerCase().replace(/\s+/g, "_");
  return (PROSPECT_SOURCES as readonly string[]).includes(raw) ? raw : "google_search";
}

function buildDiscoveryPrompt(campaign: CampaignRow, count: number, exclude: string[]): string {
  return `Kamu adalah AI Sales Prospecting Agent untuk KERJAKU (software house Indonesia: website, aplikasi custom, dashboard bisnis, otomasi AI).

Tugas: usulkan ${count} kandidat bisnis nyata yang layak dihubungi.

Parameter kampanye:
- Industri target: ${campaign.industry}
- Lokasi: ${campaign.location}
- Kata kunci: ${campaign.keywords.join(", ") || "-"}
- Solusi yang ditawarkan: ${campaign.solution}

Jangan ulang bisnis berikut: ${exclude.slice(0, 40).join("; ") || "-"}

Aturan:
- Utamakan bisnis yang punya jejak kontak publik (website, telepon, WhatsApp, email, atau Instagram bisnis).
- Isi hanya data yang kamu yakini; kalau tidak tahu, kosongkan field-nya (jangan mengarang nomor atau email).
- Setiap kandidat WAJIB punya "source" salah satu dari: google_business, google_search, company_website, instagram, linkedin, business_directory, industry_listing.
- "sourceDetail" berisi petunjuk pencarian konkret (contoh: kata kunci Google Maps yang dipakai).
- Analisis harus spesifik untuk bisnis tersebut, bukan kalimat generik.

Balas HANYA array JSON dengan bentuk:
[{"businessName":"","industry":"","city":"","website":"","phone":"","whatsapp":"","email":"","socialMedia":"","contactPerson":"","source":"","sourceDetail":"","businessSummary":"","potentialNeed":"","opportunityReason":"","recommendedSolution":"","salesApproach":"","painSignals":[""],"evidence":[""]}]`;
}

export type DiscoveryResult = {
  runId: string | null;
  found: number;
  saved: number;
  skipped: number;
  status: "ok" | "ai_unavailable" | "empty";
  prospects: { id: string; name: string }[];
};

export async function discoverProspects(
  supabase: Client,
  input: { campaignId: string; count?: number },
  actor: { userId: string; email?: string | null },
): Promise<DiscoveryResult> {
  const { data: campaignRow, error } = await supabase
    .from("prospect_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", input.campaignId)
    .maybeSingle();
  if (error || !campaignRow) throw new Error(error?.message ?? "Kampanye tidak ditemukan.");
  const campaign = rowToCampaign(campaignRow as Record<string, unknown>);

  const count = Math.max(1, Math.min(20, input.count ?? campaign.daily_target));

  const { data: runRow } = await supabase
    .from("prospect_runs")
    .insert({
      kind: "discovery",
      trigger_source: "manual",
      query: `${campaign.industry} • ${campaign.location} • ${campaign.keywords.join(", ")}`,
      status: "running",
      created_by: actor.userId,
      meta: { campaign_id: campaign.id, campaign_name: campaign.name } as never,
    } as never)
    .select("id")
    .single();
  const runId = (runRow as { id: string } | null)?.id ?? null;

  const finish = async (
    status: string,
    patch: Partial<{
      found_count: number;
      saved_count: number;
      skipped_count: number;
      ai_calls: number;
      error: string;
    }>,
  ) => {
    if (!runId) return;
    await supabase
      .from("prospect_runs")
      .update({ status, finished_at: new Date().toISOString(), ...patch } as never)
      .eq("id", runId);
  };

  if (!isAiConfigured()) {
    await finish("failed", { error: "AI gateway belum dikonfigurasi." });
    return { runId, found: 0, saved: 0, skipped: 0, status: "ai_unavailable", prospects: [] };
  }

  const { data: existing } = await supabase
    .from("prospects")
    .select("business_name")
    .order("created_at", { ascending: false })
    .limit(80);
  const exclude = (existing ?? []).map((row) =>
    String((row as { business_name: string }).business_name),
  );

  let candidates: Candidate[] = [];
  try {
    const { text } = await generateText({
      model: createAiModel("ORDER_BRIEF"),
      prompt: buildDiscoveryPrompt(campaign, count, exclude),
      temperature: 0.6,
    });
    candidates = parseJsonArray(text).slice(0, count);
  } catch (aiError) {
    await finish("failed", {
      error: aiError instanceof Error ? aiError.message.slice(0, 400) : "AI gagal.",
      ai_calls: 1,
    });
    throw new Error("Discovery AI gagal. Coba lagi beberapa saat lagi.");
  }

  if (!candidates.length) {
    await finish("done", { found: 0, saved: 0, skipped: 0, ai_calls: 1 } as never);
    return { runId, found: 0, saved: 0, skipped: 0, status: "empty", prospects: [] };
  }

  let saved = 0;
  let skipped = 0;
  const created: { id: string; name: string }[] = [];

  for (const candidate of candidates) {
    try {
      const result = await createProspect(
        supabase,
        {
          businessName: candidate.businessName,
          industry: candidate.industry ?? campaign.industry,
          city: candidate.city ?? campaign.location,
          website: candidate.website ?? null,
          contactName: candidate.contactPerson ?? null,
          contactEmail: candidate.email ?? null,
          contactWhatsapp: candidate.whatsapp ?? candidate.phone ?? null,
          contactPhone: candidate.phone ?? null,
          socialMedia: candidate.socialMedia ?? null,
          source: normalizeSource(candidate.source),
          sourceDetail: candidate.sourceDetail ?? null,
          discoveryQuery: `${campaign.industry} • ${campaign.location}`,
          researchSummary: candidate.businessSummary ?? null,
          businessSummary: candidate.businessSummary ?? null,
          opportunityReason: candidate.opportunityReason ?? candidate.potentialNeed ?? null,
          recommendedSolution: candidate.recommendedSolution ?? campaign.solution,
          salesApproach: candidate.salesApproach ?? null,
          painSignals: (candidate.painSignals ?? []).filter(Boolean).slice(0, 8),
          evidence: (candidate.evidence ?? []).filter(Boolean).slice(0, 8),
          campaignId: campaign.id,
          verified: false,
        },
        actor,
      );
      if (result.status === "created") {
        saved += 1;
        created.push({ id: result.id, name: candidate.businessName });
        await logProspectActivity(supabase, {
          prospectId: result.id,
          action: "research",
          label: `Ditemukan AI dari kampanye "${campaign.name}"`,
          content: [candidate.businessSummary, candidate.opportunityReason, candidate.salesApproach]
            .filter(Boolean)
            .join("\n\n"),
          meta: {
            campaign_id: campaign.id,
            source: normalizeSource(candidate.source),
            verified: false,
          },
          userId: actor.userId,
          userEmail: actor.email ?? null,
        });
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  await supabase
    .from("prospect_campaigns")
    .update({
      last_run_at: new Date().toISOString(),
      total_discovered: campaign.total_discovered + saved,
    } as never)
    .eq("id", campaign.id);

  await finish("done", {
    found_count: candidates.length,
    saved_count: saved,
    skipped_count: skipped,
    ai_calls: 1,
  });

  return { runId, found: candidates.length, saved, skipped, status: "ok", prospects: created };
}

/* --------------------------- Prospect intelligence ------------------------ */

export async function generateProspectIntelligence(
  supabase: Client,
  id: string,
  actor: { userId: string; email?: string | null },
) {
  const { data, error } = await supabase.from("prospects").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Prospek tidak ditemukan.");
  if (!isAiConfigured()) throw new Error("AI gateway belum dikonfigurasi.");

  const row = data as Record<string, unknown>;
  const prompt = `Kamu analis sales KERJAKU (website, aplikasi custom, dashboard bisnis, otomasi AI).

Data prospek:
- Bisnis: ${String(row["business_name"] ?? "")}
- Industri: ${String(row["industry"] ?? "-")}
- Kota: ${String(row["city"] ?? "-")}
- Website: ${String(row["website"] ?? "-")}
- Kontak: ${[row["contact_name"], row["contact_email"], row["contact_whatsapp"], row["contact_phone"]].filter(Boolean).join(" | ") || "-"}
- Catatan riset: ${String(row["research_summary"] ?? "-")}

Buat analisis spesifik (bukan generik). Balas HANYA JSON:
{"businessSummary":"","potentialNeed":"","opportunityReason":"","recommendedSolution":"","salesApproach":""}`;

  const { text } = await generateText({
    model: createAiModel("ORDER_BRIEF"),
    prompt,
    temperature: 0.4,
  });

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI tidak mengembalikan analisis yang valid.");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, string>;

  const patch = {
    business_summary: (parsed["businessSummary"] ?? "").slice(0, 2000) || null,
    opportunity_reason:
      ((parsed["opportunityReason"] ?? "") || (parsed["potentialNeed"] ?? "")).slice(0, 2000) ||
      null,
    recommended_solution: (parsed["recommendedSolution"] ?? "").slice(0, 1000) || null,
    sales_approach: (parsed["salesApproach"] ?? "").slice(0, 2000) || null,
  };

  const { error: updateError } = await supabase
    .from("prospects")
    .update(patch as never)
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  await logProspectActivity(supabase, {
    prospectId: id,
    action: "research",
    label: "Prospect intelligence dibuat AI",
    content: Object.values(patch).filter(Boolean).join("\n\n"),
    userId: actor.userId,
    userEmail: actor.email ?? null,
  });

  return { ok: true as const, intelligence: patch };
}

/* ---------------------------- Outreach generator -------------------------- */

export async function generateOutreachMessage(
  supabase: Client,
  input: { id: string; channel: string },
): Promise<{ subject: string | null; message: string }> {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Prospek tidak ditemukan.");
  const row = data as Record<string, unknown>;
  if (row["do_not_contact"]) throw new Error("Prospek ditandai DO_NOT_CONTACT.");
  if (!isAiConfigured()) throw new Error("AI gateway belum dikonfigurasi.");

  const prompt = `Tulis pesan outreach pertama dari KERJAKU (software house Indonesia) untuk kanal ${input.channel}.

Prospek:
- Bisnis: ${String(row["business_name"] ?? "")}
- Industri: ${String(row["industry"] ?? "-")}
- Kota: ${String(row["city"] ?? "-")}
- PIC: ${String(row["contact_name"] ?? "-")}
- Ringkasan: ${String(row["business_summary"] ?? row["research_summary"] ?? "-")}
- Peluang: ${String(row["opportunity_reason"] ?? "-")}
- Solusi disarankan: ${String(row["recommended_solution"] ?? "-")}
- Pendekatan: ${String(row["sales_approach"] ?? "-")}

Aturan: bahasa Indonesia profesional dan hangat, maksimal 120 kata, sebut nama bisnis dan konteks industrinya, satu ajakan ringan (bukan hard selling), tanpa klaim angka/hasil yang tidak diketahui, tanpa emoji berlebihan.
${input.channel === "email" ? 'Balas JSON: {"subject":"","message":""}' : 'Balas JSON: {"message":""}'}`;

  const { text } = await generateText({
    model: createAiModel("ORDER_BRIEF"),
    prompt,
    temperature: 0.7,
  });
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
        subject?: string;
        message?: string;
      };
      if (parsed.message?.trim()) {
        return { subject: parsed.subject?.trim() || null, message: parsed.message.trim() };
      }
    } catch {
      /* fall through to raw text */
    }
  }
  return { subject: null, message: cleaned.slice(0, 4000) };
}
