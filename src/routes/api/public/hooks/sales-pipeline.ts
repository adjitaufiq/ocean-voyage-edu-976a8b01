import { createFileRoute } from "@tanstack/react-router";

/**
 * Autonomous sales pipeline cycle for scheduled callers (pg_cron / external
 * scheduler). Bounded per run, single-flight, authenticated with CRON_SECRET.
 * An optional JSON body can scope one run to a single campaign.
 */
export const Route = createFileRoute("/api/public/hooks/sales-pipeline")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyOpsRequest } = await import("@/lib/security/ops-auth.server");
        const auth = verifyOpsRequest(request);
        if (!auth.ok) return auth.response;

        let campaignId: string | undefined;
        let discoveryTasks: number | undefined;
        let qualifyLimit: number | undefined;
        let prepLimit: number | undefined;
        try {
          const body = (await request.json()) as Record<string, unknown>;
          if (typeof body?.["campaignId"] === "string") campaignId = body["campaignId"];
          if (typeof body?.["discoveryTasks"] === "number") discoveryTasks = body["discoveryTasks"];
          if (typeof body?.["qualifyLimit"] === "number") qualifyLimit = body["qualifyLimit"];
          if (typeof body?.["prepLimit"] === "number") prepLimit = body["prepLimit"];
        } catch {
          // No body: run the normal full cycle.
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runSalesPipelineCycle } = await import("@/lib/sales-pipeline.server");
        const result = await runSalesPipelineCycle(supabaseAdmin, {
          ...(campaignId ? { campaignId } : {}),
          ...(discoveryTasks ? { discoveryTasks } : {}),
          ...(qualifyLimit ? { qualifyLimit } : {}),
          ...(prepLimit ? { prepLimit } : {}),
        });
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
