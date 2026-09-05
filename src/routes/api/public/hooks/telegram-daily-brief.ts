import { createFileRoute } from "@tanstack/react-router";

/**
 * Telegram daily brief endpoint for scheduled callers (pg_cron at 01:30 UTC = 08:30 WIB)
 * and for authorized manual testing. Authenticated with a dedicated server-only
 * CRON_SECRET. Delivery only ever goes to authorized Telegram chat IDs.
 */
async function run(request: Request, triggerSource: "cron" | "manual") {
  const { verifyOpsRequest } = await import("@/lib/security/ops-auth.server");
  const auth = verifyOpsRequest(request);
  if (!auth.ok) return auth.response;

  const { sendDailyBrief } = await import("@/lib/assistant-daily.server");
  const result = await sendDailyBrief(triggerSource);
  return Response.json({ ...result, trigger: triggerSource }, { status: result.ok ? 200 : 502 });
}

export const Route = createFileRoute("/api/public/hooks/telegram-daily-brief")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request, "cron"),
      // GET is the manual test trigger (sends today's brief immediately).
      GET: async ({ request }) => run(request, "manual"),
    },
  },
});
