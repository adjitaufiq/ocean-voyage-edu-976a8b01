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

/* ---------------------------- Phase 2B controls --------------------------- */

const REPAIR_SOURCE_ENUM = ["prospect_candidate", "prospect", "consultation", "ai_conversation", "client"] as const;

export const listEntityReviewFilteredFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        filter: z.enum(["open", "suggested", "review_required", "decided"]).optional(),
        limit: z.number().int().min(1).max(300).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { listMatchReviewQueue } = await import("./entity-resolution.server");
    await assertLeadWork(context.supabase, context.userId);
    return listMatchReviewQueue(context.supabase, data.limit ?? 100, data.filter ?? "open");
  });

export const undoEntityReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { undoReviewDecision } = await import("./entity-resolution.server");
    await assertLeadWork(context.supabase, context.userId);
    return undoReviewDecision(context.supabase, { id: data.id, actorId: context.userId });
  });

export const entityReviewAuditFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { auditReviewQueue } = await import("./entity-resolution.server");
    await assertLeadWork(context.supabase, context.userId);
    return auditReviewQueue(context.supabase);
  });

export const entityRepairStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { getRepairStatus } = await import("./entity-repair.server");
    await assertLeadWork(context.supabase, context.userId);
    return getRepairStatus(context.supabase);
  });

export const entityRepairActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("start"), source: z.enum(REPAIR_SOURCE_ENUM), dryRun: z.boolean(), pageSize: z.number().int().min(1).max(500).optional() }),
        z.object({ action: z.literal("step"), runId: z.string().uuid() }),
        z.object({ action: z.literal("pause"), runId: z.string().uuid() }),
        z.object({ action: z.literal("resume"), runId: z.string().uuid() }),
        z.object({ action: z.literal("retry"), source: z.enum(REPAIR_SOURCE_ENUM) }),
      ])
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const repair = await import("./entity-repair.server");
    await assertLeadWork(context.supabase, context.userId);
    const c = context.supabase;
    switch (data.action) {
      case "start":
        return { ok: true, result: await repair.startRepairJob(c, { source: data.source, dryRun: data.dryRun, pageSize: data.pageSize, actorId: context.userId }) };
      case "step":
        return { ok: true, result: await repair.runRepairStep(c, { runId: data.runId, actorId: context.userId }) };
      case "pause":
        return { ok: true, result: await repair.pauseRepairJob(c, data.runId) };
      case "resume":
        return { ok: true, result: await repair.resumeRepairJob(c, data.runId) };
      case "retry":
        return { ok: true, result: await repair.retryFailedResolutions(c, { source: data.source }) };
    }
  });
