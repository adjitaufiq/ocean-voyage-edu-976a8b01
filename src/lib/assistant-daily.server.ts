/**
 * Telegram-only "KERJAKU AI Executive Assistant" daily brief.
 *
 * Reuses the exact same AI core as /admin/assistant (business snapshot +
 * memory layer + Lovable AI Gateway). No web UI, no CRM/consultant changes.
 */
import { generateText } from "ai";

import { createAiModel, isAiConfigured } from "@/lib/ai-gateway.server";
import { buildBusinessSnapshot, buildMemoryContext } from "@/lib/assistant.server";
import { escapeHtml, markdownToTelegramHtml, sendTelegramMessage } from "@/lib/telegram.server";

export const BRIEF_TIMEZONE = "Asia/Jakarta";
export const BRIEF_SEND_TIME_WIB = "08:30";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/* ------------------------------- time helpers ------------------------------ */

/** Current wall-clock parts in Asia/Jakarta, independent of the server timezone. */
export function jakartaNow(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRIEF_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    isoDate: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    time: `${parts["hour"]}:${parts["minute"]}`,
  };
}

export function jakartaDateLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: BRIEF_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/* ------------------------------ authorization ------------------------------ */

export function authorizedChatIds(): string[] {
  return (process.env["TELEGRAM_CHAT_ID"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/* -------------------------------- owner tasks ------------------------------ */

export type OwnerTask = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
};

export async function listOwnerTasks(
  supabase: AdminClient,
  status: "open" | "done" | "all" = "open",
): Promise<OwnerTask[]> {
  let query = supabase
    .from("assistant_owner_tasks")
    .select("id, title, detail, status, due_date, created_at")
    .order("created_at", { ascending: true })
    .limit(50);
  if (status !== "all") query = query.eq("status", status);
  const { data } = await query;
  return (data ?? []) as OwnerTask[];
}

export async function addOwnerTask(
  supabase: AdminClient,
  input: { title: string; chatId: string; dueDate?: string | null },
): Promise<OwnerTask | null> {
  const { data, error } = await supabase
    .from("assistant_owner_tasks")
    .insert({
      title: input.title.slice(0, 300),
      chat_id: input.chatId,
      due_date: input.dueDate ?? null,
      source: "telegram",
    })
    .select("id, title, detail, status, due_date, created_at")
    .single();
  if (error) {
    console.error("[daily-brief] addOwnerTask", error.message);
    return null;
  }
  return data as OwnerTask;
}

/** Completes a task by 1-based index in the open list, or by fuzzy title match. */
export async function completeOwnerTask(
  supabase: AdminClient,
  reference: string,
): Promise<OwnerTask | null> {
  const open = await listOwnerTasks(supabase, "open");
  if (open.length === 0) return null;

  const index = Number.parseInt(reference.trim(), 10);
  const target = Number.isFinite(index)
    ? open[index - 1]
    : open.find((task) => task.title.toLowerCase().includes(reference.trim().toLowerCase()));
  if (!target) return null;

  await supabase
    .from("assistant_owner_tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", target.id);
  return target;
}

/* --------------------------------- context --------------------------------- */

async function buildContext(supabase: AdminClient) {
  const { buildAcquisitionSummary } = await import("@/lib/acquisition.server");
  const [snapshot, memory, tasks, acquisition] = await Promise.all([
    buildBusinessSnapshot(supabase),
    buildMemoryContext(supabase, "daily-brief"),
    listOwnerTasks(supabase, "open"),
    buildAcquisitionSummary(supabase, 7).catch(() => null),
  ]);

  const taskBlock =
    tasks.length > 0
      ? tasks
          .map((t, i) => `${i + 1}. ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`)
          .join("\n")
      : "(Tidak ada personal task terbuka.)";

  return [
    "=== MEMORY JANGKA PANJANG ===",
    memory,
    "",
    "=== DATA BUSINESS OS (real-time) ===",
    snapshot,
    "",
    "=== AKUISISI ORGANIK ===",
    acquisition ??
      "(Data akuisisi belum cukup. JANGAN membuat bagian akuisisi atau menyebut tren traffic apa pun.)",
    "",
    "=== PERSONAL TASK OWNER (dari Telegram /add) ===",
    taskBlock,
  ].join("\n");
}

function model() {
  if (!isAiConfigured()) return null;
  return createAiModel("DAILY_BRIEF");
}

const BASE_PERSONA = [
  "Kamu adalah KERJAKU AI EXECUTIVE ASSISTANT untuk owner (Adji Taufiq).",
  "Peranmu: executive assistant, personal scheduler, business advisor, productivity assistant.",
  "Kamu BUKAN dashboard. Jangan sekadar menyalin isi database — tentukan prioritas dan jelaskan alasannya.",
  "",
  "URUTAN PRIORITAS: 1) Peluang revenue 2) Urgensi klien 3) Risiko deadline 4) Progress project aktif 5) Task penting yang belum selesai 6) Peluang pertumbuhan bisnis.",
  "Selalu jawab pertanyaan: 'apa yang harus owner kerjakan pertama hari ini dan kenapa?'",
  "Jangan mengarang angka, nama, atau status. Sebut nama lead/klien/project nyata dari data.",
  "Jika tidak ada tugas mendesak, JANGAN kirim laporan kosong — beri saran aktivitas produktif (konten, branding, developer, marketing).",
  "",
  'Format jawaban: teks polos dengan **tebal** untuk judul bagian dan bullet "- ". DILARANG memakai tag HTML, tabel, heading #, atau code block. Maksimal ~2800 karakter.',
].join("\n");

/* ------------------------------ brief generator ---------------------------- */

export async function generateDailyBrief(supabase: AdminClient): Promise<string> {
  const aiModel = model();
  const context = await buildContext(supabase);
  const dateLabel = jakartaDateLabel();

  const header = [
    "🤖 <b>KERJAKU DAILY ASSISTANT</b>",
    `📅 ${escapeHtml(dateLabel)}`,
    `⏰ ${BRIEF_SEND_TIME_WIB} WIB`,
    "",
    "<b>GOOD MORNING</b> 👋",
    "",
  ].join("\n");

  if (!aiModel) {
    return `${header}⚠️ AI belum dikonfigurasi, daily brief tidak bisa dibuat.`;
  }

  const { text } = await generateText({
    model: aiModel,
    system: [
      BASE_PERSONA,
      "",
      "Susun DAILY BRIEF dengan struktur persis berikut (tanpa mengulang header tanggal):",
      "🎯 **TODAY'S PRIORITY**",
      "",
      "🔥 **PRIORITY 1 — MOST IMPORTANT**",
      "Task: ...",
      "Alasan: ...",
      "Dampak: ...",
      "",
      "💻 **DEVELOPMENT** — prioritas teknis: task development aktif, bug, perbaikan sistem/produk.",
      "",
      "📢 **BUSINESS** — follow up lead, komunikasi klien, aktivitas sales, aktivitas marketing.",
      "",
      "⏰ **RECOMMENDED SCHEDULE** — blok 08:30-10:30, 10:30-12:00, 13:00-15:00, 15:00-16:00, 20:00 review. Isi tiap blok dengan pekerjaan nyata.",
      "",
      "💡 **AI SUGGESTION** — saran produktif bila tidak ada yang mendesak (Content / Branding / Developer / Marketing).",
      "",
      "📌 **REMINDER** — pengingat dari CRM, leads, projects, proposals, invoice, dan task.",
    ].join("\n"),
    prompt: `Tanggal hari ini: ${dateLabel} (WIB).\n\n${context}`,
  });

  return `${header}${markdownToTelegramHtml(text.trim())}`;
}

export async function generateTodayFocus(supabase: AdminClient): Promise<string> {
  const aiModel = model();
  if (!aiModel) return "⚠️ AI belum dikonfigurasi.";
  const context = await buildContext(supabase);
  const { text } = await generateText({
    model: aiModel,
    system: `${BASE_PERSONA}\n\nBerikan prioritas hari ini + jadwal kerja singkat (blok waktu WIB). Maksimal ~1500 karakter.`,
    prompt: `Tanggal: ${jakartaDateLabel()} (WIB), sekarang pukul ${jakartaNow().time} WIB.\n\n${context}`,
  });
  return `🎯 <b>TODAY'S PRIORITY</b>\n\n${markdownToTelegramHtml(text.trim())}`;
}

export async function generateIdeas(supabase: AdminClient, topic?: string): Promise<string> {
  const aiModel = model();
  if (!aiModel) return "⚠️ AI belum dikonfigurasi.";
  const context = await buildContext(supabase);
  const { text } = await generateText({
    model: aiModel,
    system: `${BASE_PERSONA}\n\nBerikan 5-7 ide konkret dan bisa langsung dieksekusi (bisnis, marketing, konten, atau development) yang relevan dengan kondisi bisnis saat ini. Setiap ide 1-2 kalimat + kenapa layak dikerjakan.`,
    prompt: `${topic ? `Fokus ide: ${topic}\n\n` : ""}${context}`,
  });
  return `💡 <b>IDEAS</b>\n\n${markdownToTelegramHtml(text.trim())}`;
}

export async function generateDailyReview(supabase: AdminClient): Promise<string> {
  const aiModel = model();
  if (!aiModel) return "⚠️ AI belum dikonfigurasi.";
  const [context, done] = await Promise.all([
    buildContext(supabase),
    listOwnerTasks(supabase, "done"),
  ]);
  const { text } = await generateText({
    model: aiModel,
    system: `${BASE_PERSONA}\n\nBuat DAILY REVIEW: apa yang bergerak hari ini, apa yang tertinggal, risiko besok, dan 3 prioritas untuk besok.`,
    prompt: `Tanggal: ${jakartaDateLabel()} (WIB).\n\nTASK SELESAI:\n${
      done.length ? done.map((t) => `- ${t.title}`).join("\n") : "(belum ada)"
    }\n\n${context}`,
  });
  return `🌙 <b>DAILY REVIEW</b>\n\n${markdownToTelegramHtml(text.trim())}`;
}

/* -------------------------------- delivery --------------------------------- */

export type BriefDeliveryResult = {
  ok: boolean;
  delivered: number;
  failed: number;
  timezone: string;
  scheduledFor: string;
  sentAt: string;
  errors: string[];
};

/** Generates and sends today's brief to every authorized chat, logging each send. */
export async function sendDailyBrief(
  triggerSource: "cron" | "manual" = "cron",
): Promise<BriefDeliveryResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const chats = authorizedChatIds();
  const { isoDate } = jakartaNow();
  const scheduledFor = `${isoDate}T${BRIEF_SEND_TIME_WIB}:00+07:00`;
  const errors: string[] = [];
  let delivered = 0;

  if (chats.length === 0) {
    return {
      ok: false,
      delivered: 0,
      failed: 0,
      timezone: BRIEF_TIMEZONE,
      scheduledFor,
      sentAt: new Date().toISOString(),
      errors: ["TELEGRAM_CHAT_ID belum dikonfigurasi"],
    };
  }

  let message: string;
  try {
    message = await generateDailyBrief(supabaseAdmin);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[daily-brief] generation failed", detail);
    for (const chatId of chats) {
      await supabaseAdmin.from("assistant_daily_briefs").insert({
        brief_date: isoDate,
        chat_id: chatId,
        message: "",
        status: "failed",
        error: detail,
        timezone: BRIEF_TIMEZONE,
        scheduled_for: scheduledFor,
        trigger_source: triggerSource,
      });
    }
    return {
      ok: false,
      delivered: 0,
      failed: chats.length,
      timezone: BRIEF_TIMEZONE,
      scheduledFor,
      sentAt: new Date().toISOString(),
      errors: [detail],
    };
  }

  for (const chatId of chats) {
    const result = await sendTelegramMessage(message, chatId);
    const sentAt = new Date().toISOString();
    if (result.ok) delivered += 1;
    else errors.push(`${chatId}: ${result.error}`);

    await supabaseAdmin.from("assistant_daily_briefs").insert({
      brief_date: isoDate,
      chat_id: chatId,
      message,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
      timezone: BRIEF_TIMEZONE,
      scheduled_for: scheduledFor,
      sent_at: sentAt,
      trigger_source: triggerSource,
    });

    console.log(
      `[daily-brief] chat=${chatId} tz=${BRIEF_TIMEZONE} scheduled=${scheduledFor} sent=${sentAt} status=${
        result.ok ? "sent" : "failed"
      }`,
    );
  }

  return {
    ok: delivered > 0,
    delivered,
    failed: chats.length - delivered,
    timezone: BRIEF_TIMEZONE,
    scheduledFor,
    sentAt: new Date().toISOString(),
    errors,
  };
}
