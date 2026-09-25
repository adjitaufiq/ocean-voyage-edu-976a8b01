/**
 * AI Business Assistant — server-only context, memory, and persistence layer.
 *
 * Every function receives an authenticated Supabase client so RLS applies and
 * the assistant can only ever read business data the caller is allowed to see.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  MEMORY_CATEGORIES,
  MEMORY_PROVENANCE_LABELS,
  MEMORY_TRUST_RANK,
  isMemoryCategory,
  isMemoryProvenance,
  type AssistantMemory,
  type MemoryCategory,
  type MemoryProvenance,
} from "@/lib/assistant/memory";

type Client = SupabaseClient<Database>;

const money = (amount: number, currency = "IDR") =>
  `${currency} ${new Intl.NumberFormat("id-ID").format(Math.round(amount))}`;

/* --------------------------------- Memory -------------------------------- */

export async function listMemories(
  supabase: Client,
  category?: MemoryCategory,
): Promise<AssistantMemory[]> {
  let query = supabase
    .from("assistant_memories")
    .select(
      "id, category, title, content, importance, provenance, source_thread_id, created_at, updated_at",
    )
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw new Error("Tidak dapat memuat memory assistant.");
  return (data ?? []).map((row) => ({
    ...row,
    category: isMemoryCategory(row.category) ? row.category : "business",
    // Anything without an explicit trusted provenance is treated as AI output.
    provenance: isMemoryProvenance(row.provenance) ? row.provenance : "assistant_recommendation",
  })) as AssistantMemory[];
}

export async function saveMemory(
  supabase: Client,
  input: {
    id?: string;
    category: MemoryCategory;
    title: string;
    content: string;
    importance?: number;
    provenance?: MemoryProvenance;
    sourceThreadId?: string | null;
  },
  userId: string,
) {
  const payload = {
    category: input.category,
    title: input.title.slice(0, 200),
    content: input.content.slice(0, 4000),
    importance: Math.min(5, Math.max(1, input.importance ?? 3)),
    provenance: input.provenance ?? "assistant_recommendation",
    source_thread_id: input.sourceThreadId ?? null,
    created_by: userId,
  };
  if (input.id) {
    const { error } = await supabase
      .from("assistant_memories")
      .update(payload)
      .eq("id", input.id);
    if (error) throw new Error("Gagal memperbarui memory.");
    return { id: input.id };
  }
  const { data, error } = await supabase
    .from("assistant_memories")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error("Gagal menyimpan memory.");
  return { id: data.id };
}

export async function deleteMemory(supabase: Client, id: string) {
  const { error } = await supabase.from("assistant_memories").delete().eq("id", id);
  if (error) throw new Error("Gagal menghapus memory.");
  return { ok: true };
}

export async function clearMemories(supabase: Client, category?: MemoryCategory) {
  let query = supabase.from("assistant_memories").delete();
  query = category ? query.eq("category", category) : query.not("id", "is", null);
  const { error } = await query;
  if (error) throw new Error("Gagal menghapus memory.");
  return { ok: true };
}

/* --------------------------------- Threads -------------------------------- */

export async function listThreads(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("assistant_threads")
    .select("id, title, last_message_at, created_at")
    .eq("created_by", userId)
    .order("last_message_at", { ascending: false })
    .limit(60);
  if (error) throw new Error("Tidak dapat memuat percakapan.");
  return data ?? [];
}

export async function createThread(supabase: Client, userId: string, title?: string) {
  const { data, error } = await supabase
    .from("assistant_threads")
    .insert({ created_by: userId, title: title?.slice(0, 120) || "Percakapan baru" })
    .select("id, title, last_message_at, created_at")
    .single();
  if (error) throw new Error("Gagal membuat percakapan baru.");
  return data;
}

export async function renameThread(supabase: Client, id: string, title: string) {
  const { error } = await supabase
    .from("assistant_threads")
    .update({ title: title.slice(0, 120) || "Percakapan baru" })
    .eq("id", id);
  if (error) throw new Error("Gagal mengganti judul percakapan.");
  return { ok: true };
}

export async function deleteThread(supabase: Client, id: string) {
  const { error } = await supabase.from("assistant_threads").delete().eq("id", id);
  if (error) throw new Error("Gagal menghapus percakapan.");
  return { ok: true };
}

export async function clearThreadMessages(supabase: Client, id: string) {
  const { error } = await supabase.from("assistant_messages").delete().eq("thread_id", id);
  if (error) throw new Error("Gagal menghapus riwayat percakapan.");
  return { ok: true };
}

export async function loadThreadMessages(supabase: Client, threadId: string) {
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id, role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error("Tidak dapat memuat riwayat percakapan.");
  return data ?? [];
}

export async function appendMessage(
  supabase: Client,
  input: { threadId: string; role: "user" | "assistant"; content: string; userId: string },
) {
  const { error } = await supabase.from("assistant_messages").insert({
    thread_id: input.threadId,
    role: input.role,
    content: input.content,
    created_by: input.userId,
  });
  if (error) throw new Error("Gagal menyimpan pesan percakapan.");
  await supabase
    .from("assistant_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", input.threadId);

  // Observability (write-only, never throws): Sales Assistant recommendations.
  if (input.role === "assistant") {
    try {
      const { classifyAssistantReply } = await import("./admin/decision-classify");
      const kinds = classifyAssistantReply(input.content);
      if (kinds.length > 0) {
        const { recordDecisionTraces } = await import("./decision-trace.server");
        await recordDecisionTraces(
          kinds.map((kind) => ({
            module: "sales_assistant",
            decisionType: kind,
            decision: { excerpt: input.content.slice(0, 2000) },
            evidence: { thread_id: input.threadId },
            actorKind: "ai" as const,
            actorId: input.userId,
          })),
        );
      }
    } catch (traceError) {
      console.warn("[decision-trace] assistant skipped", (traceError as Error).message);
    }
  }
}

/* --------------------------- Business OS snapshot -------------------------- */

const DAY = 86_400_000;
const daysBetween = (iso: string | null | undefined, now: number) =>
  iso ? Math.round((now - new Date(iso).getTime()) / DAY) : null;
const daysUntil = (iso: string | null | undefined, now: number) =>
  iso ? Math.round((new Date(iso).getTime() - now) / DAY) : null;

export async function buildBusinessSnapshot(supabase: Client): Promise<string> {
  const nowMs = Date.now();
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const [leads, proposals, invoices, projects, tasks, clients, team] = await Promise.all([
    supabase
      .from("consultations")
      .select(
        "name, company, project_type, requirement, budget, timeline, status, lead_score, lead_temperature, ai_recommended_package, ai_summary, lead_source, created_at, status_updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("proposals")
      .select("title, client_name, status, recommended_package, sent_at, viewed_at, valid_until, updated_at")
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase
      .from("invoices")
      .select("number, client_name, amount, currency, status, due_date, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("client_projects")
      .select("name, status, stage, phase, progress, target_date, updated_at")
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase
      .from("project_tasks")
      .select("title, status, assignee, priority, due_date")
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(25),
    supabase.from("clients").select("name, company, package, status").limit(15),
    supabase
      .from("team_members")
      .select("name, role, active, capacity")
      .eq("active", true)
      .limit(20),
  ]);

  const lines: string[] = [`Tanggal hari ini: ${today}`];

  const leadRows = leads.data ?? [];
  lines.push(
    `\n[LEADS TERBARU] (${leadRows.length})\n` +
      leadRows
        .map((l) => {
          const age = daysBetween(l.created_at, nowMs);
          const idle = daysBetween(l.status_updated_at, nowMs);
          return `- ${l.name} (${l.company ?? "tanpa perusahaan"}) · ${l.project_type} · budget ${l.budget} · timeline ${l.timeline} · status ${l.status} · skor ${l.lead_score} ${l.lead_temperature} · rekomendasi ${l.ai_recommended_package ?? "-"} · sumber ${l.lead_source} · masuk ${age}h lalu · tanpa update ${idle ?? age}h · kebutuhan: ${(l.ai_summary || l.requirement || "-").slice(0, 180)}`;
        })
        .join("\n"),
  );

  const proposalRows = proposals.data ?? [];
  lines.push(
    `\n[PROPOSAL] (${proposalRows.length})\n` +
      proposalRows
        .map((p) => {
          const sent = daysBetween(p.sent_at, nowMs);
          const expiry = daysUntil(p.valid_until, nowMs);
          return `- ${p.title} · ${p.client_name ?? "-"} · ${p.status} · paket ${p.recommended_package ?? "-"}${sent !== null ? ` · dikirim ${sent}h lalu` : " · belum dikirim"}${p.viewed_at ? " · sudah dibuka klien" : " · belum dibuka klien"}${expiry !== null ? ` · berlaku ${expiry}h lagi` : ""}`;
        })
        .join("\n"),
  );

  const invoiceRows = invoices.data ?? [];
  const paid = invoiceRows.filter((i) => i.status === "paid");
  const outstanding = invoiceRows.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  lines.push(
    `\n[INVOICE] dibayar ${paid.length} (${money(paid.reduce((s, i) => s + Number(i.amount ?? 0), 0))}), outstanding ${outstanding.length} (${money(outstanding.reduce((s, i) => s + Number(i.amount ?? 0), 0))})\n` +
      invoiceRows
        .map((i) => {
          const due = daysUntil(i.due_date, nowMs);
          const dueLabel =
            i.status === "paid" || due === null
              ? ""
              : due < 0
                ? ` · TELAT ${Math.abs(due)} hari`
                : ` · jatuh tempo ${due} hari lagi`;
          return `- ${i.number} · ${i.client_name ?? "-"} · ${money(Number(i.amount ?? 0), i.currency ?? "IDR")} · ${i.status}${i.due_date ? ` · due ${i.due_date}` : ""}${dueLabel}`;
        })
        .join("\n"),
  );

  const projectRows = projects.data ?? [];
  lines.push(
    `\n[PROJECT AKTIF] (${projectRows.length})\n` +
      projectRows
        .map((p) => {
          const left = daysUntil(p.target_date, nowMs);
          const idle = daysBetween(p.updated_at, nowMs);
          return `- ${p.name} · stage ${p.stage ?? p.phase} · ${p.status} · progress ${p.progress}%${p.target_date ? ` · target ${p.target_date}${left !== null ? (left < 0 ? ` (LEWAT ${Math.abs(left)} hari)` : ` (${left} hari lagi)`) : ""}` : ""} · terakhir bergerak ${idle}h lalu`;
        })
        .join("\n"),
  );

  const taskRows = tasks.data ?? [];
  lines.push(
    `\n[TASK BELUM SELESAI] (${taskRows.length})\n` +
      taskRows
        .map((t) => {
          const left = daysUntil(t.due_date, nowMs);
          return `- ${t.title} · ${t.assignee?.trim() || "belum ditugaskan"} · ${t.status} · prioritas ${t.priority}${t.due_date ? ` · due ${t.due_date}${left !== null && left < 0 ? ` (TELAT ${Math.abs(left)} hari)` : ""}` : ""}`;
        })
        .join("\n"),
  );

  const clientRows = clients.data ?? [];
  lines.push(
    `\n[CLIENT] (${clientRows.length})\n` +
      clientRows
        .map((c) => `- ${c.name} · ${c.company ?? "-"} · paket ${c.package ?? "-"} · ${c.status}`)
        .join("\n"),
  );

  const teamRows = team.data ?? [];
  lines.push(
    `\n[TIM AKTIF] (${teamRows.length})\n` +
      teamRows.map((t) => `- ${t.name} · ${t.role} · kapasitas ${t.capacity}`).join("\n"),
  );

  /* ------------------------- Derived executive signals ------------------------ */

  const closed = new Set(["closed", "lost", "rejected", "converted", "won"]);
  const hotLeads = leadRows.filter(
    (l) =>
      !closed.has((l.status ?? "").toLowerCase()) &&
      ((l.lead_temperature ?? "").toLowerCase().includes("hot") || (l.lead_score ?? 0) >= 70),
  );
  const coolingLeads = leadRows.filter((l) => {
    const idle = daysBetween(l.status_updated_at ?? l.created_at, nowMs) ?? 0;
    return !closed.has((l.status ?? "").toLowerCase()) && idle >= 5;
  });
  const stalledProposals = proposalRows.filter((p) => {
    const sent = daysBetween(p.sent_at, nowMs);
    return (
      ["sent", "viewed", "negotiation"].includes((p.status ?? "").toLowerCase()) &&
      sent !== null &&
      sent >= 3
    );
  });
  const overdueInvoices = outstanding.filter((i) => (daysUntil(i.due_date, nowMs) ?? 99) < 0);
  const dueSoonInvoices = outstanding.filter((i) => {
    const d = daysUntil(i.due_date, nowMs);
    return d !== null && d >= 0 && d <= 7;
  });
  const lateProjects = projectRows.filter((p) => (daysUntil(p.target_date, nowMs) ?? 99) < 0);
  const stalledProjects = projectRows.filter(
    (p) => (daysBetween(p.updated_at, nowMs) ?? 0) >= 7 && (p.progress ?? 0) < 100,
  );
  const overdueTasks = taskRows.filter((t) => (daysUntil(t.due_date, nowMs) ?? 99) < 0);
  const unassignedTasks = taskRows.filter((t) => !t.assignee?.trim());

  const sum = (rows: Array<{ amount?: number | string | null }>) =>
    rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);

  lines.push(
    "\n[SINYAL EKSEKUTIF — hasil analisis otomatis, gunakan sebagai dasar prioritas]",
    `- Lead panas siap dikontak: ${hotLeads.length}${hotLeads.length ? ` → ${hotLeads.map((l) => `${l.name} (skor ${l.lead_score})`).join(", ")}` : ""}`,
    `- Lead mulai dingin (≥5 hari tanpa update): ${coolingLeads.length}${coolingLeads.length ? ` → ${coolingLeads.map((l) => l.name).join(", ")}` : ""}`,
    `- Proposal menggantung (≥3 hari sejak dikirim, belum closing): ${stalledProposals.length}${stalledProposals.length ? ` → ${stalledProposals.map((p) => `${p.title} (${p.client_name ?? "-"})`).join(", ")}` : ""}`,
    `- Invoice telat bayar: ${overdueInvoices.length} senilai ${money(sum(overdueInvoices))}${overdueInvoices.length ? ` → ${overdueInvoices.map((i) => `${i.number} ${i.client_name ?? "-"}`).join(", ")}` : ""}`,
    `- Invoice jatuh tempo ≤7 hari: ${dueSoonInvoices.length} senilai ${money(sum(dueSoonInvoices))}${dueSoonInvoices.length ? ` → ${dueSoonInvoices.map((i) => `${i.number} ${i.client_name ?? "-"}`).join(", ")}` : ""}`,
    `- Perkiraan kas masuk dari seluruh invoice outstanding: ${money(sum(outstanding))}`,
    `- Project lewat target: ${lateProjects.length}${lateProjects.length ? ` → ${lateProjects.map((p) => p.name).join(", ")}` : ""}`,
    `- Project stagnan ≥7 hari: ${stalledProjects.length}${stalledProjects.length ? ` → ${stalledProjects.map((p) => p.name).join(", ")}` : ""}`,
    `- Task telat: ${overdueTasks.length} · task tanpa PIC: ${unassignedTasks.length}`,
  );

  return lines.join("\n");
}


/* --------------------------- Conversation context -------------------------- */

export async function buildMemoryContext(supabase: Client, threadId: string): Promise<string> {
  const [memories, recentThreads] = await Promise.all([
    listMemories(supabase),
    supabase
      .from("assistant_threads")
      .select("id, title, last_message_at")
      .order("last_message_at", { ascending: false })
      .limit(8),
  ]);

  const blocks: string[] = [
    "\n[ATURAN KEPERCAYAAN MEMORY]\n" +
      "- Snapshot Business OS (data sistem saat ini) SELALU menang atas memory apa pun.\n" +
      "- Memory bertanda 'Rekomendasi AI' atau 'Dugaan AI' BUKAN fakta bisnis. Jangan pernah menyajikannya sebagai data terverifikasi.\n" +
      "- Jika memory bertentangan dengan snapshot sistem, ikuti snapshot dan sebutkan bahwa catatan lama sudah usang.",
  ];
  // Highest-trust memories first, so trusted state outranks inference in context.
  const ordered = [...memories].sort(
    (a, b) => MEMORY_TRUST_RANK[b.provenance] - MEMORY_TRUST_RANK[a.provenance],
  );
  for (const category of MEMORY_CATEGORIES) {
    const rows = ordered.filter((m) => m.category === category);
    if (rows.length === 0) continue;
    blocks.push(
      `\n[${category.toUpperCase()} MEMORY]\n` +
        rows
          .map(
            (m) => `- (${MEMORY_PROVENANCE_LABELS[m.provenance]}) ${m.title}: ${m.content}`,
          )
          .join("\n"),
    );
  }

  const others = (recentThreads.data ?? []).filter((t) => t.id !== threadId);
  if (others.length > 0) {
    blocks.push(
      `\n[PERCAKAPAN SEBELUMNYA]\n` +
        others.map((t) => `- ${t.title} (terakhir ${t.last_message_at.slice(0, 10)})`).join("\n"),
    );
  }

  return blocks.length > 0 ? blocks.join("\n") : "(Belum ada memory tersimpan.)";
}

export function buildSystemPrompt(memoryContext: string, businessSnapshot: string): string {
  return [
    "Kamu adalah Executive Business Assistant / business partner owner KERJAKU (digital solution & business automation agency).",
    "Kamu BUKAN dashboard laporan. Jangan sekadar merangkum isi database. Tugasmu membantu owner memutuskan: apa yang dikerjakan lebih dulu, kenapa itu penting, aksi berikutnya apa, dan bagaimana mengeksekusinya.",
    "",
    "STRUKTUR JAWABAN untuk pertanyaan tentang kondisi bisnis, status, prioritas, atau 'apa yang harus saya lakukan':",
    "1. KONDISI BISNIS — ringkas keadaan sekarang. Pisahkan tegas:",
    "   FAKTA: hanya data nyata dari sistem.",
    "   REKOMENDASI: penilaian bisnismu. Jangan pernah mencampur fakta dan asumsi.",
    "2. FOKUS HARI INI — buka dengan 'Hari ini fokus ke...' lalu blok waktu konkret, contoh:",
    "   09:00 — Follow up AJK (urgensi tinggi: hot lead skor 90)",
    "   10:30 — Follow up Uji AI Flow",
    "   13:00 — Finalisasi proposal Ayo Jos",
    "3. KENAPA INI PENTING — dampak bisnisnya: menjaga cash flow, menaikkan peluang closing, mencegah lead mendingin, mengisi kapasitas project, menurunkan risiko operasional. Bukan sekadar mengulang angka.",
    "4. RENCANA AKSI — Langkah 1, 2, 3, 4 yang konkret dan berurutan.",
    "5. SIAP DIEKSEKUSI — langsung kerjakan bagian yang tidak mengubah data (mis. tulis draft WhatsApp/email atau catatan meeting di jawaban), lalu sebut satu aksi berikutnya yang paling relevan.",
    "",
    "GAYA PROAKTIF:",
    "- Baik: 'Hubungi AJK lebih dulu. Draft WhatsApp-nya sudah saya siapkan di bawah, tinggal review dan kirim.'",
    "- Buruk: 'Mau saya buatkan draft WhatsApp?'",
    "- Dilarang menutup setiap jawaban dengan tawaran template yang sama berulang. Kalau aksi berikutnya sudah jelas, langsung berikan. Kalau butuh akses tulis, minta konfirmasi hanya tepat sebelum eksekusi. Kalau tidak ada aksi, tutup dengan rekomendasi strategis.",
    "",
    "URUTAN PRIORITAS (selalu jelaskan alasan di balik urutannya):",
    "1. Peluang revenue  2. Risiko cash flow  3. Urgensi klien  4. Kapasitas project  5. Efisiensi operasional.",
    "",
    "AKURASI FAKTUAL:",
    "- Jangan pernah mengarang angka, conversion rate, tanggal, aktivitas customer, atau status revenue.",
    "- Selalu sebut nama lead/klien/invoice/project nyata dari data.",
    "- Jika data kurang, katakan: 'Saya belum punya cukup data untuk menghitung ini secara akurat.'",
    "- Gunakan blok SINYAL EKSEKUTIF sebagai dasar prioritas, tapi terjemahkan ke bahasa manusia, jangan salin mentah.",
    "- Gunakan MEMORY dan percakapan sebelumnya supaya user tidak perlu mengulang informasi.",
    "",
    "NADA: Bahasa Indonesia, executive assistant, profesional, strategis, ringkas, proaktif. Markdown singkat, tanpa tabel panjang. Hindari gaya laporan dashboard, saran generik, dan pertanyaan yang tidak perlu.",
    "Untuk pertanyaan spesifik/singkat, jawab langsung ke intinya tanpa memaksakan lima bagian di atas, lalu tutup dengan satu rekomendasi tindakan.",
    "",
    "=== MEMORY JANGKA PANJANG ===",
    memoryContext,
    "",
    "=== DATA BUSINESS OS (real-time, sudah difilter sesuai izin akses user) ===",
    businessSnapshot,
  ].join("\n");
}
