import { createFileRoute } from "@tanstack/react-router";

/**
 * Autonomous sales pipeline cycle for scheduled callers (pg_cron / external
 * scheduler). Bounded per run, single-flight, authenticated with CRON_SECRET.
 */
export const Route = createFileRoute("/api/public/hooks/sales-pipeline")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyOpsRequest } = await import("@/lib/security/ops-auth.server");
        const auth = verifyOpsRequest(request);
        if (!auth.ok) return auth.response;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runSalesPipelineCycle } = await import("@/lib/sales-pipeline.server");
        const result = await runSalesPipelineCycle(supabaseAdmin);
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
