import { createFileRoute } from "@tanstack/react-router";

/**
 * Automation scan endpoint for scheduled callers (pg_cron / external scheduler).
 * Authenticated with a dedicated server-only CRON_SECRET — never the publishable key.
 */
export const Route = createFileRoute("/api/public/hooks/automation-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyOpsRequest } = await import("@/lib/security/ops-auth.server");
        const auth = verifyOpsRequest(request);
        if (!auth.ok) return auth.response;

        const { scanAutomationDue } = await import("@/lib/automation.server");
        const result = await scanAutomationDue();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
