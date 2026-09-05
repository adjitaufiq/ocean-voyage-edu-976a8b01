/**
 * Action tools for the Business Operating Assistant — server-only.
 *
 * Same AI core, same Business OS, same permissions. Sensitive writes are never
 * executed by the model: a write tool only PROPOSES an action, the server
 * persists it as a single-use pending action, and it executes only after the
 * authorized user explicitly confirms that exact action in the app.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { canWorkLeads, type WorkspaceRole } from "@/lib/admin/roles";
import { createPendingAction, type AssistantActionType } from "@/lib/assistant-actions.server";

type Client = SupabaseClient<Database>;

const FORBIDDEN = {
  status: "forbidden" as const,
  message: "Anda tidak memiliki izin untuk tindakan ini.",
};

async function findLeadRow(supabase: Client, query: string) {
  const term = query.replace(/[%,()]/g, " ").trim();
  const { data } = await supabase
    .from("consultations")
    .select("id, name, email, whatsapp, company, status, lead_score, lead_temperature")
    .or(`name.ilike.%${term}%,company.ilike.%${term}%,email.ilike.%${term}%`)
    .order("created_at", { ascending: false })
    .limit(3);
  return data ?? [];
}

export function buildAssistantTools(options: {
  supabase: Client;
  userId: string;
  role: WorkspaceRole | null;
  userEmail?: string | null;
  threadId?: string | null;
  origin?: "web" | "telegram";
}) {
  const { supabase, userId, role, threadId, origin } = options;
  const mayWrite = canWorkLeads(role);

  async function propose(
    actionType: AssistantActionType,
    summary: string,
    payload: Record<string, unknown>,
  ) {
    if (!mayWrite) return FORBIDDEN;
    const created = await createPendingAction(supabase, {
      actionType,
      summary,
      payload,
      userId,
      threadId: threadId ?? null,
      origin: origin ?? "web",
    });
    if ("error" in created) return { status: "error" as const, message: created.error };
    return {
      status: "awaiting_confirmation" as const,
      actionId: created.id,
      summary,
      expiresAt: created.expiresAt,
      message:
        origin === "telegram"
          ? "Aksi ini menunggu konfirmasi. Buka /admin/assistant di dashboard dan tekan Konfirmasi untuk menjalankannya."
          : "Aksi ini belum dijalankan. Tampilkan ringkasannya, lalu minta user menekan tombol Konfirmasi pada kartu aksi.",
    };
  }

  return {
    acquisition_report: tool({
      description:
        "Data akuisisi organik nyata (first-party): dari channel/konten mana visitor, lead, qualified lead, dan deal berasal. Pakai untuk pertanyaan 'lead datang dari mana', 'artikel mana yang menghasilkan lead', 'traffic ChatGPT sudah menghasilkan lead belum'. Read-only.",
      inputSchema: z.object({
        days: z.number().min(1).max(180).optional().describe("Rentang hari, default 30"),
      }),
      execute: async ({ days }) => {
        const { buildAcquisitionSummary } = await import("@/lib/acquisition.server");
        const summary = await buildAcquisitionSummary(supabase, days ?? 30);
        if (!summary)
          return {
            status: "insufficient_data" as const,
            message:
              "Data akuisisi belum cukup untuk disimpulkan. Katakan apa adanya ke user, jangan mengarang angka atau tren.",
          };
        return { status: "ok" as const, summary };
      },
    }),

    outbound_report: tool({
      description:
        "Ringkasan outbound prospecting (pipeline prospek di luar CRM inbound): jumlah prospek, tier ICP, status, reply rate, konversi jadi lead, follow-up jatuh tempo, dan prospek yang menunggu approval. Read-only.",
      inputSchema: z.object({
        days: z.number().min(1).max(180).optional().describe("Rentang hari, default 30"),
      }),
      execute: async ({ days }) => {
        const { buildProspectingSummary } = await import("@/lib/prospecting.server");
        const summary = await buildProspectingSummary(supabase, days ?? 30).catch(() => null);
        if (!summary)
          return {
            status: "insufficient_data" as const,
            message:
              "Belum ada data prospek outbound pada rentang ini. Sampaikan apa adanya, jangan mengarang angka.",
          };
        return { status: "ok" as const, summary };
      },
    }),

    find_prospect: tool({
      description:
        "Cari prospek outbound berdasarkan nama bisnis, kota, atau industri. Read-only, untuk mendapatkan konteks sebelum menyarankan aksi outreach.",
      inputSchema: z.object({
        query: z.string().describe("Nama bisnis, kota, atau industri"),
      }),
      execute: async ({ query }) => {
        const { fetchProspects } = await import("@/lib/prospecting.server");
        const matches = await fetchProspects(supabase, { search: query, limit: 5 }).catch(() => []);
        return { matches };
      },
    }),

    find_lead: tool({
      description:
        "Cari lead/prospek berdasarkan nama, perusahaan, atau email untuk mendapatkan lead_id sebelum aksi lain.",
      inputSchema: z.object({ query: z.string().describe("Nama, perusahaan, atau email lead") }),
      execute: async ({ query }) => ({ matches: await findLeadRow(supabase, query) }),
    }),

    create_followup_task: tool({
      description:
        "USULKAN pembuatan task follow-up / reminder internal di Business OS. Tool ini TIDAK mengeksekusi apa pun: server hanya menyiapkan usulan yang harus dikonfirmasi user lewat tombol konfirmasi.",
      inputSchema: z.object({
        title: z.string(),
        detail: z.string().optional(),
        dueInDays: z.number().describe("Jatuh tempo dalam berapa hari dari sekarang, 0 = hari ini"),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        assignee: z.string().optional(),
        leadId: z.string().optional(),
        kind: z
          .enum(["follow_up", "reminder", "payment_reminder", "proposal_follow_up"])
          .optional(),
      }),
      execute: async (input) =>
        propose("create_followup_task", `Buat task follow-up "${input.title}"`, input),
    }),

    create_project_task: tool({
      description:
        "USULKAN pembuatan task operasional pada sebuah project (kanban project delivery). Tidak dieksekusi sampai user menekan tombol konfirmasi.",
      inputSchema: z.object({
        projectId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        assignee: z.string().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        dueDate: z.string().optional().describe("Format YYYY-MM-DD"),
      }),
      execute: async (input) =>
        propose("create_project_task", `Buat task project "${input.title}"`, input),
    }),

    update_lead_status: tool({
      description:
        "USULKAN perubahan status lead di CRM. Tidak dieksekusi sampai user menekan tombol konfirmasi.",
      inputSchema: z.object({
        leadId: z.string(),
        status: z
          .string()
          .describe("Status baru, mis. new, contacted, qualified, nurturing, closed"),
        note: z.string().optional(),
      }),
      execute: async (input) =>
        propose("update_lead_status", `Ubah status lead menjadi "${input.status}"`, input),
    }),

    save_sales_activity: tool({
      description:
        "USULKAN penyimpanan catatan sales / draft pesan WhatsApp atau email / rekomendasi proposal ke riwayat AI lead. Tidak dieksekusi sampai user menekan tombol konfirmasi.",
      inputSchema: z.object({
        leadId: z.string(),
        action: z
          .enum(["note", "whatsapp_draft", "email_draft", "objection", "proposal_improvement"])
          .describe("Jenis aktivitas yang disimpan"),
        label: z.string().optional(),
        content: z.string().describe("Isi catatan atau draft pesan lengkap"),
      }),
      execute: async (input) =>
        propose("save_sales_activity", `Simpan aktivitas sales (${input.action}) ke lead`, input),
    }),
  };
}

export const ASSISTANT_ACTION_GUIDE = [
  "MODE AKSI (kamu eksekutor, bukan cuma penasihat):",
  "- Kurangi beban keputusan owner. Hal yang tidak mengubah data (draft WhatsApp/email, catatan meeting, urutan langkah) langsung KERJAKAN dan tampilkan hasilnya — jangan bertanya 'mau saya buatkan draft?'.",
  "- Aksi yang mengubah data (buat task, reminder, update status, simpan aktivitas) TIDAK bisa kamu eksekusi sendiri. Panggil tool-nya untuk mengusulkan aksi, lalu tampilkan ringkasan aksi dan minta user menekan tombol Konfirmasi pada kartu aksi.",
  "- Jangan pernah mengklaim aksi sudah dijalankan sebelum server mengonfirmasinya. Status 'awaiting_confirmation' berarti BELUM dijalankan.",
  "- Butuh lead_id? panggil find_lead dulu; jangan menebak id.",
  "- Jika tool menolak karena izin, jelaskan dengan sopan bahwa role user tidak punya akses tulis.",
  "- Tawarkan hanya SATU next action yang paling relevan per jawaban.",
  "- Jika tidak ada aksi yang perlu, tutup dengan rekomendasi strategis — bukan pertanyaan.",
].join("\n");
