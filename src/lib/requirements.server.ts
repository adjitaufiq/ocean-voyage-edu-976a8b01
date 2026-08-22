// Requirement Preview + versioning for AI Consultant conversations.
// Version 1 is generated automatically when a conversation becomes a qualified
// lead; every later edit creates a NEW version so the original stays intact.

export type RequirementPayload = {
  business: string;
  project: string;
  features: string[];
  problems: string[];
  packageName: string | null;
  timeline: string | null;
  budget: string | null;
  usersScale: string | null;
  intent: string;
  score: number;
  contactName: string | null;
  contactEmail: string | null;
  contactWhatsapp: string | null;
  summary: string | null;
  changeNote?: string | null;
  source?: "ai" | "manual";
};

export type RequirementVersion = RequirementPayload & {
  id: string;
  conversation_id: string;
  lead_id: string | null;
  version: number;
  final_prompt: string | null;
  created_at: string;
};

export function intentLabel(score: number, intent: string) {
  if (score >= 70 || intent === "high") return "Hot Lead";
  if (score >= 40 || intent === "medium") return "Warm Lead";
  return "Cold Lead";
}

/** Human-readable Requirement Preview used by admin + Telegram. */
export function formatRequirementPreview(input: RequirementPayload): string {
  const list = (items: string[]) =>
    items.length ? items.map((item) => `- ${item}`).join("\n") : "-";
  return [
    "📋 Preview Requirement",
    "",
    `Business:\n${input.business || "-"}`,
    "",
    `Project:\n${input.project || "-"}`,
    "",
    `Features:\n${list(input.features)}`,
    "",
    `Package:\n${input.packageName || "-"}`,
    "",
    `Timeline:\n${input.timeline || "-"}`,
    "",
    `Intent:\n${intentLabel(input.score, input.intent)}`,
  ].join("\n");
}

/** Development prompt generated from the latest requirement version. */
export function buildFinalPrompt(input: RequirementPayload, version: number): string {
  const bullets = (items: string[]) =>
    items.length ? items.map((item) => `- ${item}`).join("\n") : "- (belum ada)";
  return [
    `# Development Requirement — v${version}`,
    "",
    `## Bisnis`,
    input.business || "-",
    "",
    `## Jenis Project`,
    input.project || "-",
    "",
    `## Masalah yang Diselesaikan`,
    bullets(input.problems),
    "",
    `## Fitur yang Dibutuhkan`,
    bullets(input.features),
    "",
    `## Paket Solusi`,
    input.packageName || "-",
    "",
    `## Skala Pengguna`,
    input.usersScale || "-",
    "",
    `## Timeline`,
    input.timeline || "-",
    "",
    `## Budget`,
    input.budget || "-",
    "",
    `## Ringkasan`,
    input.summary || "-",
    "",
    `## Instruksi Build`,
    "Bangun sistem sesuai kebutuhan di atas dengan arsitektur modular, dashboard admin,",
    "dan alur yang siap dipakai user akhir. Prioritaskan fitur inti terlebih dahulu.",
  ].join("\n");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Telegram message built from the Requirement Preview (not raw chat). */
export function formatRequirementTelegram(input: RequirementPayload, version: number): string {
  const list = (items: string[]) =>
    items.length ? items.map((item) => `- ${escapeHtml(item)}`).join("\n") : "-";
  const contact =
    [input.contactName, input.contactWhatsapp, input.contactEmail]
      .filter((value) => value && value.trim())
      .map((value) => escapeHtml(String(value)))
      .join(" · ") || "-";
  return [
    `🤖 <b>QUALIFIED LEAD AI CONSULTANT</b> (v${version})`,
    "",
    `<b>Business:</b>\n${escapeHtml(input.business || "-")}`,
    "",
    `<b>Project:</b>\n${escapeHtml(input.project || "-")}`,
    "",
    `<b>Features:</b>\n${list(input.features)}`,
    "",
    `<b>Package:</b>\n${escapeHtml(input.packageName || "-")}`,
    "",
    `<b>Timeline:</b>\n${escapeHtml(input.timeline || "-")}`,
    "",
    `<b>WhatsApp / Kontak:</b>\n${contact}`,
    "",
    `<b>Intent:</b>\n${escapeHtml(intentLabel(input.score, input.intent))}`,
  ].join("\n");
}

/** Append a new requirement version for a conversation (never overwrites). */
export async function saveRequirementVersion(
  conversationId: string,
  leadId: string | null,
  payload: RequirementPayload,
  createdBy?: string | null,
): Promise<{ version: number; finalPrompt: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: last, error: readError } = await supabaseAdmin
    .from("conversation_requirements")
    .select("version, final_prompt, source")
    .eq("conversation_id", conversationId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) {
    console.error("[requirements] read failed", readError.message);
    return null;
  }

  const version = (last?.version ?? 0) + 1;
  const finalPrompt = buildFinalPrompt(payload, version);

  const row = {
    lead_id: leadId,
    business: payload.business,
    project: payload.project,
    features: payload.features,
    problems: payload.problems,
    package_name: payload.packageName,
    timeline: payload.timeline,
    budget: payload.budget,
    users_scale: payload.usersScale,
    intent: payload.intent,
    score: payload.score,
    contact_name: payload.contactName,
    contact_email: payload.contactEmail,
    contact_whatsapp: payload.contactWhatsapp,
    summary: payload.summary,
    change_note: payload.changeNote ?? null,
    final_prompt: finalPrompt,
    source: payload.source ?? "ai",
    created_by: createdBy ?? null,
  });
  if (error) {
    console.error("[requirements] insert failed", error.message);
    return null;
  }
  return { version, finalPrompt };
}
