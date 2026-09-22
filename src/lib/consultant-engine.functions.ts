/**
 * Consultant Engine server functions (Phase 3).
 * Analysis layer saja — tidak menyentuh chatbot, pipeline, maupun CRM lama.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateBusinessAnalysisFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ entityId: z.string().uuid(), force: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { generateAnalysis } = await import("./consultant-engine.service");
    await assertLeadWork(context.supabase, context.userId);
    return generateAnalysis(context.supabase, data);
  });

export const generateBusinessAnalysesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).optional(),
        force: z.boolean().optional(),
        entityIds: z.array(z.string().uuid()).max(200).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { generateAnalysesForEntities } = await import("./consultant-engine.service");
    await assertLeadWork(context.supabase, context.userId);
    const result = await generateAnalysesForEntities(context.supabase, data);
    return { ...result, results: result.results.slice(0, 50) };
  });

export const getBusinessAnalysisFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ entityId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { getCurrentAnalysis } = await import("./consultant-engine.service");
    await assertLeadWork(context.supabase, context.userId);
    return getCurrentAnalysis(context.supabase, data.entityId);
  });

export const getSalesContextSnapshotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ entityId: z.string().uuid(), generateIfMissing: z.boolean().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { getSalesContextSnapshot } = await import("./consultant-engine.service");
    await assertLeadWork(context.supabase, context.userId);
    return getSalesContextSnapshot(context.supabase, data.entityId, {
      generateIfMissing: data.generateIfMissing,
    });
  });

export const getAnalysisOrderBriefFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        entityId: z.string().uuid(),
        customerName: z.string().max(160).optional(),
        whatsapp: z.string().max(40).optional(),
        email: z.string().max(160).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { getOrderBriefFromAnalysis } = await import("./consultant-engine.service");
    await assertLeadWork(context.supabase, context.userId);
    return getOrderBriefFromAnalysis(context.supabase, data.entityId, {
      customerName: data.customerName ?? null,
      whatsapp: data.whatsapp ?? null,
      email: data.email ?? null,
    });
  });
