import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled discovery worker. Authenticated with the server-only CRON_SECRET,
 * bounded per run, and idempotent: tasks are leased before processing so a
 * second concurrent call exits instead of duplicating work.
 */
export const Route = createFileRoute("/api/public/hooks/discovery-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyOpsRequest } = await import("@/lib/security/ops-auth.server");
        const auth = verifyOpsRequest(request);
        if (!auth.ok) return auth.response;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runDiscoveryBatch, retryFailedDiscoveryTasks } = await import(
          "@/lib/prospecting-discovery.server"
        );

        await retryFailedDiscoveryTasks(supabaseAdmin);
        const result = await runDiscoveryBatch(supabaseAdmin, { limit: 3 });
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
