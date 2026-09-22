/**
 * CONSULTANT ↔ CHATBOT ADAPTER — READ ONLY (Phase 3).
 *
 * Adapter ini HANYA membaca ringkasan percakapan yang sudah tersimpan pada
 * ai_conversations untuk dipakai sebagai input analisis. Adapter tidak boleh:
 *   - mengubah prompt, alur, atau gaya jawaban chatbot;
 *   - menulis/memperbarui baris ai_conversations atau conversation_requirements;
 *   - mengendalikan chatbot dengan cara apa pun.
 * Chatbot existing tetap berjalan 100% seperti sebelumnya.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type ConversationSummary = {
  conversationId: string;
  summary: string | null;
  problems: string[];
  features: string[];
  usersScale: string | null;
  budget: string | null;
  businessCategory: string | null;
  contactName: string | null;
  whatsapp: string | null;
  email: string | null;
};

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : item && typeof item === "object" && "label" in (item as Record<string, unknown>)
            ? String((item as Record<string, unknown>)["label"] ?? "")
            : "",
      )
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/** READ ONLY: ambil ringkasan percakapan untuk keperluan analisis. */
export async function readConversationSummaries(
  supabase: Client,
  conversationIds: string[],
): Promise<ConversationSummary[]> {
  if (!conversationIds.length) return [];
  const { data, error } = await supabase
    .from("ai_conversations")
    .select(
      "id, summary, problems, features, users_scale, budget, business_category, contact_name, contact_whatsapp, contact_email",
    )
    .in("id", conversationIds);
  if (error) throw new Error(`Gagal membaca ringkasan percakapan: ${error.message}`);
  return (data ?? []).map((row) => ({
    conversationId: row.id,
    summary: row.summary,
    problems: toStringList(row.problems),
    features: toStringList(row.features),
    usersScale: row.users_scale,
    budget: row.budget,
    businessCategory: row.business_category,
    contactName: row.contact_name,
    whatsapp: row.contact_whatsapp,
    email: row.contact_email,
  }));
}
