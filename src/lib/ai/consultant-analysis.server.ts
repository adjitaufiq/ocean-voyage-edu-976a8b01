// Server-only: shared "TEAM KERJAKU CONSULTANT" analysis layer.
//
// Both entry points (AI Consultant chatbot and the manual consultation form)
// call `analyzeConsultation()` so the Order Brief always carries reasoning —
// problems, goals, core solution, optional recommendations, package rationale —
// instead of a raw copy of whatever the customer typed.
//
// Best-effort by design: if the AI gateway is unavailable or returns garbage,
// a deterministic heuristic fallback keeps the brief usable.

import { generateText } from "ai";

import { createAiModel, isAiConfigured } from "@/lib/ai-gateway.server";
import { PACKAGE_LIBRARY } from "@/lib/ai-consultant";

export type ConsultantAnalysisInput = {
  business: string;
  projectType?: string | null;
  /** Free-text story of the need (form requirement / chat summary). */
  requirement?: string | null;
  /** Features the customer explicitly asked for. */
  requestedFeatures?: string[];
  /** Problems already detected upstream (chatbot). */
  problems?: string[];
  budget?: string | null;
  timeline?: string | null;
  usersScale?: string | null;
  notes?: string | null;
  packageHint?: string | null;
  source: "manual" | "ai";
};

export type ConsultantAnalysis = {
  /** Customer pain points, phrased as business conditions. */
  problems: string[];
  /** Business goals behind the request. */
  goals: string[];
  /** Core solution: features that directly answer the stated problems. */
  coreFeatures: string[];
  /** Growth opportunities — never presented as required scope. */
  optionalRecommendations: string[];
  packageName: string;
  packageReason: string;
  /** Short consultant narrative (2-4 sentences, Bahasa Indonesia). */
  summary: string;
  /** true when the AI layer produced the analysis. */
  aiGenerated: boolean;
};

const PACKAGE_NAMES = Object.values(PACKAGE_LIBRARY).map((p) => p.name);

function clean(list: unknown, max: number): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const value = raw.replace(/^[-*\d.)\s]+/, "").trim().slice(0, 160);
    const key = value.toLowerCase();
    if (value.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

function splitList(value: string | null | undefined): string[] {
  return clean(
    (value ?? "").split(/\r?\n|[;•]|,(?![^()]*\))/g),
    12,
  );
}

function heuristicPackage(input: ConsultantAnalysisInput): { name: string; reason: string } {
  if (input.packageHint && PACKAGE_NAMES.includes(input.packageHint)) {
    return { name: input.packageHint, reason: "Mengikuti paket yang dipilih customer di halaman layanan." };
  }
  const text = [
    input.requirement,
    input.notes,
    input.projectType,
    (input.requestedFeatures ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  const heavy = /(erp|multi.?cabang|multi.?lokasi|integrasi|api|enterprise|ratusan|hris)/.test(text);
  const workflow = /(dashboard|database|laporan|otomat|admin|inventor|stok|crm|booking|kasir|pos)/.test(text);
  const business = /(katalog|profil|company|layanan|produk|lead|form)/.test(text);

  if (heavy) {
    return {
      name: "Enterprise Digital Transformation",
      reason: "Kebutuhan menyentuh integrasi sistem dan skala organisasi besar.",
    };
  }
  if (workflow) {
    return {
      name: "Digital Workflow Solution",
      reason: "Fokus utamanya merapikan operasional harian lewat dashboard dan data terpusat.",
    };
  }
  if (business) {
    return {
      name: "Professional System",
      reason: "Kebutuhan berpusat pada kredibilitas bisnis dan penangkapan lead.",
    };
  }
  return {
    name: "Basic System",
    reason: "Kebutuhan awal masih pada kehadiran digital dasar yang cepat online.",
  };
}

function heuristicAnalysis(input: ConsultantAnalysisInput): ConsultantAnalysis {
  const problems = clean([...(input.problems ?? []), ...splitList(input.requirement)], 6);
  const core = clean([...(input.requestedFeatures ?? [])], 8);
  const pkg = heuristicPackage(input);
  const optional: string[] = [];
  const text = `${input.requirement ?? ""} ${core.join(" ")}`.toLowerCase();
  if (!/whatsapp/.test(text)) optional.push("Tombol CTA WhatsApp langsung ke admin");
  if (!/(cms|kelola konten|update sendiri)/.test(text)) optional.push("CMS ringan agar konten bisa diupdate sendiri");
  if (!/(analytic|analitik|laporan)/.test(text)) optional.push("Analytics & laporan performa sederhana");

  return {
    problems: problems.length ? problems : ["Kebutuhan belum terdokumentasi rinci, perlu sesi klarifikasi."],
    goals: [`Membantu ${input.business} berjalan lebih rapi dan mudah diakses customer.`],
    coreFeatures: core,
    optionalRecommendations: optional.slice(0, 3),
    packageName: pkg.name,
    packageReason: pkg.reason,
    summary: (input.requirement ?? "").trim().slice(0, 600),
    aiGenerated: false,
  };
}

function buildPrompt(input: ConsultantAnalysisInput): string {
  return [
    "Kamu adalah TEAM KERJAKU CONSULTANT. Analisis kebutuhan customer di bawah ini.",
    "Aturan:",
    "- Bedakan CUSTOMER NEED (core solution) vs REKOMENDASI KERJAKU (potential feature).",
    "- Core solution hanya fitur yang benar-benar menjawab masalah yang disebut customer.",
    "- Rekomendasi maksimal 3, tidak boleh duplikat dengan core solution.",
    "- Jangan menyebut harga atau angka investasi.",
    "- Bahasa Indonesia profesional, ringkas, tanpa jargon berlebihan.",
    `- Paket hanya boleh salah satu dari: ${PACKAGE_NAMES.join(" | ")}.`,
    "",
    "DATA CUSTOMER:",
    `Bisnis: ${input.business}`,
    `Jenis project: ${input.projectType ?? "-"}`,
    `Cerita kebutuhan: ${input.requirement ?? "-"}`,
    `Fitur diminta: ${(input.requestedFeatures ?? []).join(", ") || "-"}`,
    `Masalah terdeteksi: ${(input.problems ?? []).join(", ") || "-"}`,
    `Budget: ${input.budget ?? "-"}`,
    `Timeline: ${input.timeline ?? "-"}`,
    `Skala user: ${input.usersScale ?? "-"}`,
    `Catatan: ${input.notes ?? "-"}`,
    "",
    "Balas HANYA JSON valid dengan bentuk:",
    '{"problems":[],"goals":[],"coreFeatures":[],"optionalRecommendations":[],"packageName":"","packageReason":"","summary":""}',
  ].join("\n");
}

function parseJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Shared consultant reasoning used by BOTH the chatbot and the manual form.
 * Never throws — always returns a usable analysis.
 */
export async function analyzeConsultation(
  input: ConsultantAnalysisInput,
): Promise<ConsultantAnalysis> {
  const fallback = heuristicAnalysis(input);
  if (!isAiConfigured()) return fallback;

  try {
    const { text } = await generateText({
      model: createAiModel("ORDER_BRIEF"),
      prompt: buildPrompt(input),
      temperature: 0.3,
    });
    const parsed = parseJson(text);
    if (!parsed) return fallback;

    const coreFeatures = clean(parsed["coreFeatures"], 10);
    const coreKeys = new Set(coreFeatures.map((f) => f.toLowerCase()));
    const optional = clean(parsed["optionalRecommendations"], 6)
      .filter((f) => !coreKeys.has(f.toLowerCase()))
      .slice(0, 3);

    const packageName =
      typeof parsed["packageName"] === "string" && PACKAGE_NAMES.includes(parsed["packageName"])
        ? (parsed["packageName"] as string)
        : fallback.packageName;

    return {
      problems: clean(parsed["problems"], 8).length ? clean(parsed["problems"], 8) : fallback.problems,
      goals: clean(parsed["goals"], 5).length ? clean(parsed["goals"], 5) : fallback.goals,
      coreFeatures: coreFeatures.length ? coreFeatures : fallback.coreFeatures,
      optionalRecommendations: optional.length ? optional : fallback.optionalRecommendations,
      packageName,
      packageReason:
        typeof parsed["packageReason"] === "string" && parsed["packageReason"].trim()
          ? parsed["packageReason"].trim().slice(0, 400)
          : fallback.packageReason,
      summary:
        typeof parsed["summary"] === "string" && parsed["summary"].trim()
          ? parsed["summary"].trim().slice(0, 1200)
          : fallback.summary,
      aiGenerated: true,
    };
  } catch (error) {
    console.error("[consultant-analysis] failed", (error as Error).message);
    return fallback;
  }
}

/** Render the analysis as the consultant narrative stored on the Order Brief. */
export function analysisToSummary(analysis: ConsultantAnalysis): string {
  const block = (title: string, items: string[]) =>
    items.length ? `${title}:\n${items.map((i) => `- ${i}`).join("\n")}` : "";
  return [
    analysis.summary,
    block("Masalah utama", analysis.problems),
    block("Tujuan bisnis", analysis.goals),
    block("Core solution", analysis.coreFeatures),
    block("Rekomendasi KERJAKU (opsional)", analysis.optionalRecommendations),
    analysis.packageReason ? `Alasan paket ${analysis.packageName}: ${analysis.packageReason}` : "",
  ]
    .filter((part) => part && part.trim())
    .join("\n\n")
    .slice(0, 4000);
}
