/**
 * Action tools for the Business Operating Assistant — server-only.
 *
 * Same AI core, same Business OS, same permissions: every tool runs through the
 * caller's Supabase client (RLS applies) and refuses to write unless the model
 * passes `confirmed: true`, which it may only do after the user says yes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { canWorkLeads, type WorkspaceRole } from "@/lib/admin/roles";

type Client = SupabaseClient<Database>;

const NEEDS_CONFIRM = {
  status: "needs_confirmation" as const,
  message:
    "Belum dieksekusi. Tampilkan ringkasan aksi ini ke user dan minta konfirmasi eksplisit dulu, lalu panggil ulang tool dengan confirmed: true.",
};

const FORBIDDEN = {
  status: "forbidden" as const,
  message: "Role kamu tidak punya izin untuk mengubah data ini.",
};

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

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
}) {
  const { supabase, userId, role, userEmail } = options;
  const mayWrite = canWorkLeads(role);

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

    find_lead: tool({
      description:
        "Cari lead/prospek berdasarkan nama, perusahaan, atau email untuk mendapatkan lead_id sebelum aksi lain.",
      inputSchema: z.object({ query: z.string().describe("Nama, perusahaan, atau email lead") }),
      execute: async ({ query }) => ({ matches: await findLeadRow(supabase, query) }),
    }),


    create_followup_task: tool({
      description:
        "Buat task follow-up / reminder internal di Business OS (muncul di automation tasks). Gunakan untuk 'buatkan task follow up' atau 'ingatkan saya'.",
      inputSchema: z.object({
        title: z.string(),
        detail: z.string().optional(),
        dueInDays: z.number().describe("Jatuh tempo dalam berapa hari dari sekarang, 0 = hari ini"),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        assignee: z.string().optional(),
        leadId: z.string().optional(),
        kind: z.enum(["follow_up", "reminder", "payment_reminder", "proposal_follow_up"]).optional(),
        confirmed: z.boolean().describe("true hanya setelah user menyetujui aksi ini"),
      }),
      execute: async (input) => {
        if (!mayWrite) return FORBIDDEN;
        if (!input.confirmed) return { ...NEEDS_CONFIRM, preview: input };
        const { error } = await supabase.from("automation_tasks").insert({
          rule_key: "assistant_manual",
          kind: input.kind ?? "follow_up",
          title: input.title.slice(0, 200),
          detail: input.detail?.slice(0, 2000) ?? null,
          status: "pending",
          priority: input.priority ?? "normal",
          due_at: isoInDays(Math.max(0, input.dueInDays)),
          assignee: input.assignee ?? null,
          lead_id: input.leadId ?? null,
          meta: { source: "assistant", created_by: userId } as never,
        });
        if (error) return { status: "error" as const, message: error.message };
        return { status: "done" as const, message: "Task tersimpan di Business OS." };
      },
    }),

    create_project_task: tool({
      description: "Buat task operasional pada sebuah project (kanban project delivery).",
      inputSchema: z.object({
        projectId: z.string(),
        title: z.string(),
        description: z.string().optional(),
        assignee: z.string().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        dueDate: z.string().optional().describe("Format YYYY-MM-DD"),
        confirmed: z.boolean(),
      }),
      execute: async (input) => {
        if (!mayWrite) return FORBIDDEN;
        if (!input.confirmed) return { ...NEEDS_CONFIRM, preview: input };
        const { error } = await supabase.from("project_tasks").insert({
          project_id: input.projectId,
          title: input.title.slice(0, 200),
          description: input.description ?? null,
          assignee: input.assignee ?? null,
          priority: input.priority ?? "normal",
          status: "todo",
          due_date: input.dueDate ?? null,
          created_by: userId,
        });
        if (error) return { status: "error" as const, message: error.message };
        return { status: "done" as const, message: "Task project dibuat." };
      },
    }),

    update_lead_status: tool({
      description:
        "Ubah status lead di CRM (misal ke contacted, qualified, nurturing, closed). Selalu konfirmasi dulu.",
      inputSchema: z.object({
        leadId: z.string(),
        status: z.string().describe("Status baru, mis. new, contacted, qualified, nurturing, closed"),
        note: z.string().optional(),
        confirmed: z.boolean(),
      }),
      execute: async (input) => {
        if (!mayWrite) return FORBIDDEN;
        if (!input.confirmed) return { ...NEEDS_CONFIRM, preview: input };
        const { error } = await supabase
          .from("consultations")
          .update({
            status: input.status,
            status_updated_at: new Date().toISOString(),
            ...(input.note ? { admin_notes: input.note } : {}),
          })
          .eq("id", input.leadId);
        if (error) return { status: "error" as const, message: error.message };
        return { status: "done" as const, message: `Status lead diubah ke ${input.status}.` };
      },
    }),

    save_sales_activity: tool({
      description:
        "Simpan catatan sales / draft pesan WhatsApp atau email / rekomendasi perbaikan proposal ke riwayat AI lead, supaya bisa dipakai tim. Gunakan setelah user setuju.",
      inputSchema: z.object({
        leadId: z.string(),
        action: z
          .enum(["note", "whatsapp_draft", "email_draft", "objection", "proposal_improvement"])
          .describe("Jenis aktivitas yang disimpan"),
        label: z.string().optional(),
        content: z.string().describe("Isi catatan atau draft pesan lengkap"),
        confirmed: z.boolean(),
      }),
      execute: async (input) => {
        if (!mayWrite) return FORBIDDEN;
        if (!input.confirmed) return { ...NEEDS_CONFIRM, preview: input };
        const { error } = await supabase.from("lead_ai_activities").insert({
          lead_id: input.leadId,
          action: input.action,
          label: input.label ?? null,
          content: input.content.slice(0, 8000),
          meta: { source: "assistant" } as never,
          created_by: userId,
          created_by_email: userEmail ?? null,
        });
        if (error) return { status: "error" as const, message: error.message };
        return { status: "done" as const, message: "Tersimpan di riwayat sales lead." };
      },
    }),
  };
}

export const ASSISTANT_ACTION_GUIDE = [
  "MODE AKSI (kamu eksekutor, bukan cuma penasihat):",
  "- Kurangi beban keputusan owner. Hal yang tidak mengubah data (draft WhatsApp/email, catatan meeting, urutan langkah) langsung KERJAKAN dan tampilkan hasilnya — jangan bertanya 'mau saya buatkan draft?'.",
  "- Aksi yang mengubah data (buat task, reminder, update status, simpan aktivitas): tulis ringkasan aksi + minta konfirmasi eksplisit sekali, lalu panggil tool dengan confirmed: true. Jangan pernah confirmed: true sebelum user menyetujui di pesan sebelumnya.",
  "- Tawarkan hanya SATU next action yang paling relevan per jawaban. Dilarang menutup setiap jawaban dengan pertanyaan tawaran yang sama berulang-ulang.",
  "- Butuh lead_id? panggil find_lead dulu; jangan menebak id.",
  "- Setelah tool berhasil, konfirmasi singkat apa yang sudah dibuat lalu langsung sebut langkah berikutnya.",
  "- Jika tool menolak karena izin, jelaskan dengan sopan bahwa role user tidak punya akses tulis.",
  "- Jika tidak ada aksi yang perlu, tutup dengan rekomendasi strategis — bukan pertanyaan.",
].join("\n");
