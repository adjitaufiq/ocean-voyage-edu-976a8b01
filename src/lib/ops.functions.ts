import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Copies the server-only CRON_SECRET into the database vault so scheduled jobs
 * can authenticate against the ops hooks. The value never leaves the server and
 * is never returned to the client.
 */
export const syncOpsCronSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertManage } = await import("./admin.server");
    await assertManage(context.supabase, context.userId);

    const secret = process.env["CRON_SECRET"];
    if (!secret || secret.length < 16) {
      return { ok: false as const, message: "Kunci scheduler belum tersedia di server." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("set_ops_cron_secret", { _value: secret });
    if (error) {
      console.error("[ops] sync cron secret failed", error.message);
      return { ok: false as const, message: "Kunci scheduler gagal disinkronkan." };
    }
    return { ok: true as const, message: "Kunci scheduler tersinkron. Jadwal otomatis aman." };
  });
