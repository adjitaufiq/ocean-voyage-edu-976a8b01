import { createFileRoute } from "@tanstack/react-router";

/**
 * Telegram connectivity diagnostic. Operational-only: it can trigger an outbound
 * Telegram message, so it requires the dedicated server-only CRON_SECRET. Ordinary
 * public visitors can never reach the send path.
 */
export const Route = createFileRoute("/api/public/telegram/test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { verifyOpsRequest } = await import("@/lib/security/ops-auth.server");
        const auth = verifyOpsRequest(request);
        if (!auth.ok) return auth.response;

        const { rateLimit } = await import("@/lib/rate-limit.server");
        const limited = rateLimit({ key: "telegram-test", limit: 3, windowMs: 60_000 });
        if (!limited.ok) {
          return Response.json(
            { ok: false, error: "Permintaan terlalu sering. Coba lagi sebentar." },
            { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
          );
        }

        const { sendTelegramMessage, TEST_MESSAGE } = await import("@/lib/telegram.server");
        const result = await sendTelegramMessage(TEST_MESSAGE);
        if (result.ok) {
          return Response.json({ ok: true, status: "Connected Successfully" }, { status: 200 });
        }
        return Response.json(
          {
            ok: false,
            error: "Telegram tidak dapat dihubungi. Pastikan bot sudah dimulai dan chat ID benar.",
          },
          { status: 502 },
        );
      },
    },
  },
});
