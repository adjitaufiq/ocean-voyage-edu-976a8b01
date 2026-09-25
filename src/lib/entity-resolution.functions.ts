/**
 * Entity Resolution server functions (Phase 2).
 * Read + backfill only; nothing here deletes or merges legacy data.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LEGACY_TYPES = ["prospect_candidate", "prospect", "consultation", "ai_conversation"] as const;

export const runEntityBackfillFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        dryRun: z.boolean().optional(),
        limit: z.number().int().min(1).max(2000).optional(),
        sources: z.array(z.enum(LEGACY_TYPES)).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { backfillEntities } = await import("./entity-resolution.server");
    await assertLeadWork(context.supabase, context.userId);
    return backfillEntities(context.supabase, data);
  });

export const listUnifiedEntitiesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ limit: z.number().int().min(1).max(500).optional(), search: z.string().max(120).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { listUnifiedEntities } = await import("./entity-resolution.server");
    await assertLeadWork(context.supabase, context.userId);
    return listUnifiedEntities(context.supabase, data);
  });

export const listEntityReviewQueueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().int().min(1).max(300).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { listMatchReviewQueue } = await import("./entity-resolution.server");
    await assertLeadWork(context.supabase, context.userId);
    return listMatchReviewQueue(context.supabase, data.limit ?? 100);
  });

export const resolveEntityReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["link", "reject"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { resolveReviewItem } = await import("./entity-resolution.server");
    await assertLeadWork(context.supabase, context.userId);
    return resolveReviewItem(context.supabase, { ...data, actorId: context.userId });
  });
