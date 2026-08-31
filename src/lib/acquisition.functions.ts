import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { acquisitionEventSchema } from "./acquisition-schema";

/** Public, anonymous funnel event capture (no PII, no IP). */
export const trackAcquisitionEvent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => acquisitionEventSchema.parse(data))
  .handler(async ({ data }) => {
    const { recordAcquisitionEvent } = await import("./acquisition.server");
    await recordAcquisitionEvent(data);
    return { ok: true as const };
  });

/** Admin acquisition dashboard data. */
export const getAcquisitionIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertWorkspace } = await import("./admin.server");
    const { fetchAcquisitionIntelligence } = await import("./acquisition.server");
    await assertWorkspace(context.supabase, context.userId);
    return fetchAcquisitionIntelligence(context.supabase);
  });
