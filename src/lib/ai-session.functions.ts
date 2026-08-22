import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public, read-only check of a browser AI Consultant session.
 * Returns booleans only — no lead or conversation content is exposed.
 */
export const getAiSessionState = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("ai_conversations")
      .select("id, status, lead_id, summary, package_name, updated_at")
      .eq("session_id", data.sessionId)
      .maybeSingle();

    if (!row) return { exists: false, resumable: false, updatedAt: null as string | null };

    const resumable =
      row.status === "qualified_lead" && Boolean(row.lead_id) && Boolean(row.summary);

    return { exists: true, resumable, updatedAt: row.updated_at as string | null };
  });
