/**
 * Telegram channel for the AI Business Assistant.
 *
 * This is NOT a separate chatbot: it reuses the exact same core
 * (memory layer + Business OS snapshot + system prompt + assistant_threads /
 * assistant_messages / assistant_memories tables) as /admin/assistant.
 * Telegram is only another interface on top of that engine.
 */
import { createHash, timingSafeEqual } from "crypto";
import { generateText } from "ai";

import { createAiModel, isAiConfigured } from "@/lib/ai-gateway.server";
import { isMemoryCategory } from "@/lib/assistant/memory";
import {
  appendMessage,
  buildBusinessSnapshot,
  buildMemoryContext,
  buildSystemPrompt,
  clearThreadMessages,
  loadThreadMessages,
  renameThread,
  saveMemory,
} from "@/lib/assistant.server";
import { escapeHtml, markdownToTelegramHtml, sendTelegramMessage } from "@/lib/telegram.server";

const THREAD_PREFIX = "Telegram";

export function telegramWebhookSecret(): string | null {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return null;
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

export function verifyWebhookSecret(received: string): boolean {
  const expected = telegramWebhookSecret();
  if (!expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only chat IDs listed in TELEGRAM_CHAT_ID (comma separated) may talk to the assistant. */
export function isAuthorizedChat(chatId: number | string): boolean {
  const allowed = (process.env["TELEGRAM_CHAT_ID"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(String(chatId));
}

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Workspace identity the Telegram conversation acts as (owner, else admin). */
async function resolveWorkspaceUser(supabase: AdminClient): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["owner", "admin"])
    .order("role", { ascending: true })
    .limit(50);
  const rows = data ?? [];
  const owner = rows.find((row) => row.role === "owner");
  return (owner ?? rows[0])?.user_id ?? null;
}

/** One persistent conversation thread per Telegram chat, reused across messages. */
async function getOrCreateThread(supabase: AdminClient, chatId: string, userId: string) {
  const title = `${THREAD_PREFIX} · ${chatId}`;
  const { data: existing } = await supabase
    .from("assistant_threads")
    .select("id, title")
    .eq("created_by", userId)
    .eq("title", title)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("assistant_threads")
    .insert({ created_by: userId, title })
    .select("id, title")
    .single();
  if (error) throw new Error("Gagal membuat percakapan Telegram.");
  return data;
}

async function extractMemories(
  supabase: AdminClient,
  model: ReturnType<typeof createAiModel>,
  input: { question: string; answer: string; threadId: string; userId: string },
) {
  try {
    const { text } = await generateText({
      model,
      system:
        "Ekstrak informasi jangka panjang dari percakapan berikut untuk disimpan sebagai memory asisten bisnis. " +
        'Balas HANYA JSON: {"memories":[{"category":"business|sales|project|operational","provenance":"user_confirmed_fact|user_preference|assistant_recommendation|hypothesis","title":"...","content":"...","importance":1-5}]}. ' +
        "provenance WAJIB: user_confirmed_fact hanya bila owner menyatakan fakta itu sendiri; user_preference untuk preferensi; assistant_recommendation untuk saran asisten; hypothesis untuk dugaan. Kesimpulan AI DILARANG ditandai sebagai fakta. " +
        "Kategori: business = info perusahaan, layanan, paket, strategi harga, keputusan bisnis. sales = lead penting, diskusi pelanggan, strategi sales. project = diskusi project, preferensi klien, keputusan, kendala. operational = workflow tim, aturan automation, rekomendasi yang diberikan. " +
        'Simpan maksimal 3 memory, hanya yang benar-benar layak diingat lama. Jika tidak ada, balas {"memories":[]}.',
      prompt: `PERTANYAAN USER:\n${input.question}\n\nJAWABAN ASISTEN:\n${input.answer}`,
    });
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
      memories?: Array<{
        category?: string;
        provenance?: string;
        title?: string;
        content?: string;
        importance?: number;
      }>;
    };
    for (const item of (parsed.memories ?? []).slice(0, 3)) {
      if (!item.title || !item.content || !isMemoryCategory(item.category)) continue;
      await saveMemory(
        supabase,
        {
          category: item.category,
          title: item.title,
          content: item.content,
          importance: item.importance,
          // AI extraction can never mint a database-level fact.
          provenance: clampAiProvenance(item.provenance),
          sourceThreadId: input.threadId,
        },
        input.userId,
      );
    }
  } catch (error) {
    console.error("[telegram-assistant] memory extraction", error);
  }
}

const WELCOME = [
  "🤖 <b>KERJAKU AI EXECUTIVE ASSISTANT</b>",
  "",
  "Tanyakan apa saja soal bisnis kamu, contoh:",
  "• berapa lead masuk hari ini?",
  "• project mana yang terlambat?",
  "• siapa yang harus saya follow up?",
  "",
  "<b>Command:</b>",
  "/today — prioritas & jadwal hari ini",
  "/brief — kirim Daily Brief sekarang",
  "/add [task] — tambah personal task",
  "/tasks — lihat personal task",
  "/done [nomor] — tandai task selesai",
  "/idea — ide bisnis / marketing / development",
  "/review — daily review",
  "/reset — mulai percakapan baru",
  "",
  "Daily Brief otomatis terkirim setiap hari pukul 08:30 WIB.",
].join("\n");

/** Telegram-only assistant commands. Returns true when the update was handled. */
async function handleCommand(
  supabase: AdminClient,
  chatId: number,
  text: string,
): Promise<boolean> {
  const [rawCommand, ...rest] = text.split(/\s+/);
  const command = (rawCommand ?? "").split("@")[0]!.toLowerCase();
  const argument = rest.join(" ").trim();

  const daily = await import("@/lib/assistant-daily.server");

  switch (command) {
    case "/today": {
      await sendTelegramMessage(await daily.generateTodayFocus(supabase), String(chatId));
      return true;
    }
    case "/brief": {
      const result = await daily.sendDailyBrief("manual");
      if (!result.ok) {
        await sendTelegramMessage(
          `⚠️ Daily Brief gagal dikirim. ${escapeHtml(result.errors.join("; "))}`,
          String(chatId),
        );
      }
      return true;
    }
    case "/add": {
      if (!argument) {
        await sendTelegramMessage("Format: <code>/add Perbaiki email CRM</code>", String(chatId));
        return true;
      }
      const task = await daily.addOwnerTask(supabase, { title: argument, chatId: String(chatId) });
      await sendTelegramMessage(
        task ? `✅ Task ditambahkan: <b>${escapeHtml(task.title)}</b>` : "⚠️ Gagal menyimpan task.",
        String(chatId),
      );
      return true;
    }
    case "/tasks": {
      const open = await daily.listOwnerTasks(supabase, "open");
      const body = open.length
        ? open.map((t, i) => `${i + 1}. ${escapeHtml(t.title)}`).join("\n")
        : "(Tidak ada task terbuka.)";
      await sendTelegramMessage(`📝 <b>PERSONAL TASK</b>\n\n${body}`, String(chatId));
      return true;
    }
    case "/done": {
      if (!argument) {
        await sendTelegramMessage("Format: <code>/done 1</code>", String(chatId));
        return true;
      }
      const done = await daily.completeOwnerTask(supabase, argument);
      await sendTelegramMessage(
        done ? `✔️ Selesai: <b>${escapeHtml(done.title)}</b>` : "⚠️ Task tidak ditemukan.",
        String(chatId),
      );
      return true;
    }
    case "/idea": {
      await sendTelegramMessage(await daily.generateIdeas(supabase, argument), String(chatId));
      return true;
    }
    case "/review": {
      await sendTelegramMessage(await daily.generateDailyReview(supabase), String(chatId));
      return true;
    }
    default:
      return false;
  }
}

/** Processes one Telegram update end-to-end. Never throws. */
export async function handleTelegramUpdate(update: unknown): Promise<void> {
  const message =
    (update as { message?: unknown; edited_message?: unknown }).message ??
    (update as { edited_message?: unknown }).edited_message;
  const parsed = message as
    | { chat?: { id?: number }; text?: string; from?: { first_name?: string } }
    | undefined;
  const chatId = parsed?.chat?.id;
  const text = parsed?.text?.trim();
  if (!chatId || !text) return;

  if (!isAuthorizedChat(chatId)) {
    console.warn("[telegram-assistant] unauthorized chat");
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  try {
    const userId = await resolveWorkspaceUser(supabaseAdmin);
    if (!userId) {
      await sendTelegramMessage("⚠️ Belum ada akun owner/admin workspace yang terhubung.");
      return;
    }

    const thread = await getOrCreateThread(supabaseAdmin, String(chatId), userId);

    if (text === "/start") {
      await sendTelegramMessage(WELCOME, String(chatId));
      return;
    }
    if (text === "/reset") {
      await clearThreadMessages(supabaseAdmin, thread.id);
      await renameThread(supabaseAdmin, thread.id, `${THREAD_PREFIX} · ${chatId}`);
      await sendTelegramMessage(
        "🧹 Riwayat percakapan Telegram dibersihkan. Memory bisnis tetap tersimpan.",
        String(chatId),
      );
      return;
    }
    if (text.startsWith("/") && (await handleCommand(supabaseAdmin, chatId, text))) {
      return;
    }

    if (!isAiConfigured()) {
      await sendTelegramMessage("⚠️ AI belum dikonfigurasi.");
      return;
    }

    const [memoryContext, businessSnapshot, history] = await Promise.all([
      buildMemoryContext(supabaseAdmin, thread.id),
      buildBusinessSnapshot(supabaseAdmin),
      loadThreadMessages(supabaseAdmin, thread.id),
    ]);

    const { ASSISTANT_ACTION_GUIDE, buildAssistantTools } =
      await import("@/lib/assistant-tools.server");
    const { stepCountIs } = await import("ai");

    const system = [
      buildSystemPrompt(memoryContext, businessSnapshot),
      "",
      ASSISTANT_ACTION_GUIDE,
      "",
      "KANAL SAAT INI: Telegram. Jawab maksimal ~1200 karakter, gunakan bullet pendek, tanpa tabel, tanpa markdown heading.",
    ].join("\n");

    const model = createAiModel("TELEGRAM");
    const { text: answer } = await generateText({
      model,
      system,
      tools: buildAssistantTools({
        supabase: supabaseAdmin,
        userId,
        role: "owner",
        threadId,
        origin: "telegram",
      }),
      stopWhen: stepCountIs(50),
      messages: [
        ...history.slice(-16).map((row) => ({
          role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: row.content,
        })),
        { role: "user" as const, content: text },
      ],
    });

    const reply = answer.trim() || "Maaf, saya belum bisa menjawab itu.";

    await appendMessage(supabaseAdmin, {
      threadId: thread.id,
      role: "user",
      content: text,
      userId,
    });
    await appendMessage(supabaseAdmin, {
      threadId: thread.id,
      role: "assistant",
      content: reply,
      userId,
    });

    await sendTelegramMessage(toTelegramHtml(reply), String(chatId));
    await extractMemories(supabaseAdmin, model, {
      question: text,
      answer: reply,
      threadId: thread.id,
      userId,
    });
  } catch (error) {
    console.error("[telegram-assistant] failed", error);
    await sendTelegramMessage(
      "⚠️ Terjadi kendala saat memproses pertanyaan. Coba lagi sebentar lagi.",
    );
  }
}

/** Converts the assistant's light markdown into Telegram-safe HTML. */
export const toTelegramHtml = markdownToTelegramHtml;
