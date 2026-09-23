/**
 * Unified business dashboard server functions (Phase 5).
 * Read-only: nothing here writes, merges, or moves legacy data.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FUNNEL_STAGES } from "@/lib/entity-dashboard.shared";

const filterSchema = z.object({
  search: z.string().max(120).optional(),
  industry: z.string().max(80).optional(),
  stage: z.enum(FUNNEL_STAGES).optional(),
  source: z
    .enum(["prospect_candidate", "prospect", "consultation", "ai_conversation"])
    .optional(),
  analysis: z.enum(["with", "without"]).optional(),
  sales: z.enum(["prepared", "not_prepared", "ready"]).optional(),
  contact: z.enum(["contacted", "not_contacted"]).optional(),
  duplicatesOnly: z.boolean().optional(),
});

export const entityFunnelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filterSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { buildEntityFunnel } = await import("./entity-dashboard.server");
    await assertLeadWork(context.supabase, context.userId);
    return buildEntityFunnel(context.supabase, data);
  });

export const listEntityPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    filterSchema
      .extend({
        page: z.number().int().min(1).max(500).optional(),
        pageSize: z.number().int().min(5).max(100).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { listEntities } = await import("./entity-dashboard.server");
    await assertLeadWork(context.supabase, context.userId);
    return listEntities(context.supabase, data);
  });

export const entityDetailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { getEntityDetail } = await import("./entity-dashboard.server");
    await assertLeadWork(context.supabase, context.userId);
    return getEntityDetail(context.supabase, data.id);
  });
