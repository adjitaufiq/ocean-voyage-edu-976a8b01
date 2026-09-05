import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MEMORY_CATEGORIES, MEMORY_PROVENANCES } from "@/lib/assistant/memory";

const idInput = z.object({ id: z.string().uuid() });

export const listAssistantThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertWorkspace } = await import("./admin.server");
    await assertWorkspace(context.supabase, context.userId);
    const { listThreads } = await import("./assistant.server");
    return listThreads(context.supabase, context.userId);
  });

export const createAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ title: z.string().max(120).optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    await assertWorkspace(context.supabase, context.userId);
    const { createThread } = await import("./assistant.server");
    return createThread(context.supabase, context.userId, data.title);
  });

export const renameAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), title: z.string().max(120) }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    await assertWorkspace(context.supabase, context.userId);
    const { renameThread } = await import("./assistant.server");
    return renameThread(context.supabase, data.id, data.title);
  });

export const deleteAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    await assertWorkspace(context.supabase, context.userId);
    const { deleteThread } = await import("./assistant.server");
    return deleteThread(context.supabase, data.id);
  });

export const clearAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    await assertWorkspace(context.supabase, context.userId);
    const { clearThreadMessages } = await import("./assistant.server");
    return clearThreadMessages(context.supabase, data.id);
  });

export const getAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    await assertWorkspace(context.supabase, context.userId);
    const { loadThreadMessages } = await import("./assistant.server");
    const { data: thread } = await context.supabase
      .from("assistant_threads")
      .select("id, title, last_message_at, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!thread) return { thread: null, messages: [] };
    return { thread, messages: await loadThreadMessages(context.supabase, data.id) };
  });

export const listAssistantMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertWorkspace } = await import("./admin.server");
    const role = await assertWorkspace(context.supabase, context.userId);
    const { listMemories } = await import("./assistant.server");
    return { role, memories: await listMemories(context.supabase) };
  });

export const saveAssistantMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        category: z.enum(MEMORY_CATEGORIES),
        title: z.string().min(2).max(200),
        content: z.string().min(2).max(4000),
        importance: z.number().int().min(1).max(5).optional(),
        provenance: z.enum(MEMORY_PROVENANCES).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    await assertLeadWork(context.supabase, context.userId);
    const { saveMemory } = await import("./assistant.server");
    // A human typing into the memory form is an owner-confirmed fact by default.
    return saveMemory(
      context.supabase,
      { ...data, provenance: data.provenance ?? "user_confirmed_fact" },
      context.userId,
    );
  });

export const deleteAssistantMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertManage } = await import("./admin.server");
    await assertManage(context.supabase, context.userId);
    const { deleteMemory } = await import("./assistant.server");
    return deleteMemory(context.supabase, data.id);
  });

export const clearAssistantMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ category: z.enum(MEMORY_CATEGORIES).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertManage } = await import("./admin.server");
    await assertManage(context.supabase, context.userId);
    const { clearMemories } = await import("./assistant.server");
    return clearMemories(context.supabase, data.category);
  });

/* ---------------------- Pending sensitive AI actions ---------------------- */

export const listAssistantPendingActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertWorkspace } = await import("./admin.server");
    await assertWorkspace(context.supabase, context.userId);
    const { listPendingActions } = await import("./assistant-actions.server");
    const rows = await listPendingActions(context.supabase, context.userId);
    // Only confirmation-relevant fields cross the boundary; payload stays server-side.
    return rows.map((row) => ({
      id: row.id,
      action_type: row.action_type,
      summary: row.summary,
      origin: row.origin,
      expires_at: row.expires_at,
      created_at: row.created_at,
    }));
  });

export const confirmAssistantAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    const role = await assertWorkspace(context.supabase, context.userId);
    const { confirmPendingAction } = await import("./assistant-actions.server");
    return confirmPendingAction(context.supabase, {
      id: data.id,
      userId: context.userId,
      role,
      userEmail: (context.claims as { email?: string } | null)?.email ?? null,
    });
  });

export const cancelAssistantAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    await assertWorkspace(context.supabase, context.userId);
    const { cancelPendingAction } = await import("./assistant-actions.server");
    return cancelPendingAction(context.supabase, data.id, context.userId);
  });
