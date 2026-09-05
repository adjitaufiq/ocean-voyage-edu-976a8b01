/**
 * Deterministic, server-enforced confirmation for sensitive AI writes.
 *
 * The model can only ever PROPOSE an action. The proposal is persisted as a
 * pending action (single-use, scoped to one authenticated user, expiring), and
 * the write executes only when that exact user explicitly confirms that exact
 * pending action through the app. Model-supplied booleans never authorize a
 * write.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { canManageBusiness, canWorkLeads, type WorkspaceRole } from "@/lib/admin/roles";

type Client = SupabaseClient<Database>;

export const ACTION_TYPES = [
  "create_followup_task",
  "create_project_task",
  "update_lead_status",
  "save_sales_activity",
] as const;
export type AssistantActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<AssistantActionType, string> = {
  create_followup_task: "Buat task follow-up",
  create_project_task: "Buat task project",
  update_lead_status: "Ubah status lead",
  save_sales_activity: "Simpan aktivitas sales",
};

export const PENDING_ACTION_TTL_MS = 30 * 60 * 1000;

export type PendingAction = {
  id: string;
  action_type: string;
  summary: string;
  payload: Record<string, unknown>;
  status: string;
  origin: string;
  expires_at: string;
  created_at: string;
  result: string | null;
};

const SELECT = "id, action_type, summary, payload, status, origin, expires_at, created_at, result";

/** Stable hash of the exact proposed payload, so a mutated payload can never be confirmed. */
export async function hashPayload(payload: unknown): Promise<string> {
  const canonical = JSON.stringify(payload, Object.keys(payload as object).sort());
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createPendingAction(
  supabase: Client,
  input: {
    actionType: AssistantActionType;
    summary: string;
    payload: Record<string, unknown>;
    userId: string;
    threadId?: string | null;
    origin?: "web" | "telegram";
  },
): Promise<{ id: string; expiresAt: string } | { error: string }> {
  const payloadHash = await hashPayload(input.payload);
  const expiresAt = new Date(Date.now() + PENDING_ACTION_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("assistant_pending_actions")
    .insert({
      action_type: input.actionType,
      summary: input.summary.slice(0, 500),
      payload: input.payload as never,
      payload_hash: payloadHash,
      thread_id: input.threadId ?? null,
      origin: input.origin ?? "web",
      requested_by: input.userId,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();
  if (error || !data) return { error: "Tidak dapat menyiapkan aksi ini untuk konfirmasi." };
  return { id: data.id, expiresAt: data.expires_at };
}

export async function listPendingActions(supabase: Client, userId: string): Promise<PendingAction[]> {
  const { data } = await supabase
    .from("assistant_pending_actions")
    .select(SELECT)
    .eq("requested_by", userId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as PendingAction[];
}

export async function cancelPendingAction(supabase: Client, id: string, userId: string) {
  const { data } = await supabase
    .from("assistant_pending_actions")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("requested_by", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!data) return { ok: false as const, message: "Aksi ini sudah tidak menunggu konfirmasi." };
  return { ok: true as const, message: "Aksi dibatalkan." };
}

type ExecResult = { ok: boolean; message: string };

async function execute(
  supabase: Client,
  actionType: string,
  payload: Record<string, unknown>,
  ctx: { userId: string; userEmail?: string | null },
): Promise<ExecResult> {
  const str = (key: string) => {
    const value = payload[key];
    return typeof value === "string" && value.trim() ? value : null;
  };

  switch (actionType) {
    case "create_followup_task": {
      const title = str("title");
      if (!title) return { ok: false, message: "Data aksi tidak lengkap." };
      const dueInDays = Number(payload["dueInDays"] ?? 1);
      const { error } = await supabase.from("automation_tasks").insert({
        rule_key: "assistant_manual",
        kind: str("kind") ?? "follow_up",
        title: title.slice(0, 200),
        detail: str("detail")?.slice(0, 2000) ?? null,
        status: "pending",
        priority: str("priority") ?? "normal",
        due_at: new Date(
          Date.now() + Math.max(0, Number.isFinite(dueInDays) ? dueInDays : 1) * 86_400_000,
        ).toISOString(),
        assignee: str("assignee"),
        lead_id: str("leadId"),
        meta: { source: "assistant", created_by: ctx.userId } as never,
      });
      if (error) return { ok: false, message: "Task tidak dapat disimpan." };
      return { ok: true, message: "Task follow-up tersimpan di Business OS." };
    }
    case "create_project_task": {
      const projectId = str("projectId");
      const title = str("title");
      if (!projectId || !title) return { ok: false, message: "Data aksi tidak lengkap." };
      const { error } = await supabase.from("project_tasks").insert({
        project_id: projectId,
        title: title.slice(0, 200),
        description: str("description"),
        assignee: str("assignee"),
        priority: str("priority") ?? "normal",
        status: "todo",
        due_date: str("dueDate"),
        created_by: ctx.userId,
      });
      if (error) return { ok: false, message: "Task project tidak dapat disimpan." };
      return { ok: true, message: "Task project dibuat." };
    }
    case "update_lead_status": {
      const leadId = str("leadId");
      const status = str("status");
      if (!leadId || !status) return { ok: false, message: "Data aksi tidak lengkap." };
      const note = str("note");
      const { error } = await supabase
        .from("consultations")
        .update({
          status,
          status_updated_at: new Date().toISOString(),
          ...(note ? { admin_notes: note } : {}),
        })
        .eq("id", leadId);
      if (error) return { ok: false, message: "Status lead tidak dapat diubah." };
      return { ok: true, message: `Status lead diubah ke ${status}.` };
    }
    case "save_sales_activity": {
      const leadId = str("leadId");
      const content = str("content");
      const action = str("action");
      if (!leadId || !content || !action) return { ok: false, message: "Data aksi tidak lengkap." };
      const { error } = await supabase.from("lead_ai_activities").insert({
        lead_id: leadId,
        action,
        label: str("label"),
        content: content.slice(0, 8000),
        meta: { source: "assistant" } as never,
        created_by: ctx.userId,
        created_by_email: ctx.userEmail ?? null,
      });
      if (error) return { ok: false, message: "Aktivitas tidak dapat disimpan." };
      return { ok: true, message: "Tersimpan di riwayat sales lead." };
    }
    default:
      return { ok: false, message: "Jenis aksi ini tidak didukung." };
  }
}

/**
 * Confirms and executes one pending action. Single-use: the row is claimed with
 * a conditional update, so a replayed confirmation can never execute twice.
 */
export async function confirmPendingAction(
  supabase: Client,
  input: { id: string; userId: string; role: WorkspaceRole | null; userEmail?: string | null },
): Promise<{ ok: boolean; message: string }> {
  if (!canWorkLeads(input.role)) {
    return { ok: false, message: "Anda tidak memiliki izin untuk tindakan ini." };
  }

  const { data: row } = await supabase
    .from("assistant_pending_actions")
    .select("id, action_type, payload, payload_hash, status, expires_at, requested_by")
    .eq("id", input.id)
    .maybeSingle();

  if (!row || row.requested_by !== input.userId) {
    return { ok: false, message: "Aksi tidak ditemukan." };
  }
  if (row.status === "executed") return { ok: false, message: "Aksi ini sudah dijalankan." };
  if (row.status !== "pending") return { ok: false, message: "Aksi ini sudah tidak berlaku." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from("assistant_pending_actions").update({ status: "expired" }).eq("id", row.id);
    return { ok: false, message: "Konfirmasi sudah kedaluwarsa. Silakan ulangi tindakan." };
  }

  const payload = (row.payload ?? {}) as Record<string, unknown>;
  if ((await hashPayload(payload)) !== row.payload_hash) {
    await supabase.from("assistant_pending_actions").update({ status: "cancelled" }).eq("id", row.id);
    return { ok: false, message: "Detail aksi berubah. Silakan ulangi tindakan." };
  }
  if (row.action_type === "update_lead_status" && !canManageBusiness(input.role) && !canWorkLeads(input.role)) {
    return { ok: false, message: "Anda tidak memiliki izin untuk tindakan ini." };
  }

  // Claim the action first — this is the single-use / anti-replay boundary.
  const { data: claimed } = await supabase
    .from("assistant_pending_actions")
    .update({ status: "confirmed", confirmed_by: input.userId, confirmed_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, message: "Aksi ini sudah dijalankan." };

  const result = await execute(supabase, row.action_type, payload, {
    userId: input.userId,
    userEmail: input.userEmail ?? null,
  });

  await supabase
    .from("assistant_pending_actions")
    .update({
      status: result.ok ? "executed" : "failed",
      executed_at: new Date().toISOString(),
      result: result.message.slice(0, 500),
    })
    .eq("id", row.id);

  return result;
}
