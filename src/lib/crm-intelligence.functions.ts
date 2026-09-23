/**
 * Server functions untuk feedback loop CRM (Phase 6).
 * Tidak membuat pipeline baru — hanya jalur tulis/baca untuk respons customer,
 * temuan bisnis, keberatan, dan analisis ulang.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const channel = z.enum([
  "whatsapp",
  "email",
  "sales_note",
  "consultation_note",
  "crm_note",
  "chatbot",
]);

export const recordCustomerResponseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        entityId: z.string().uuid().optional(),
        candidateId: z.string().uuid().optional(),
        channel,
        content: z.string().min(2).max(4000),
        direction: z.enum(["inbound", "outbound"]).optional(),
      })
      .refine((value) => value.entityId || value.candidateId, {
        message: "Butuh entityId atau candidateId",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { recordCustomerResponse, entityIdForCandidate } = await import("./crm-intelligence.server");
    await assertLeadWork(context.supabase, context.userId);

    const entityId =
      data.entityId ?? (data.candidateId ? await entityIdForCandidate(context.supabase, data.candidateId) : null);
    if (!entityId) throw new Error("Bisnis ini belum tertaut ke identitas bisnis terpadu.");

    return recordCustomerResponse(context.supabase, context.userId, {
      entityId,
      channel: data.channel,
      content: data.content,
      ...(data.direction ? { direction: data.direction } : {}),
      ...(data.candidateId ? { legacyType: "prospect_candidate", legacyId: data.candidateId } : {}),
    });
  });

export const resolveObjectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        objectionId: z.string().uuid(),
        response: z.string().max(2000).optional(),
        resolution: z.enum(["open", "handled", "blocked", "irrelevant"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { resolveObjection } = await import("./crm-intelligence.server");
    await assertLeadWork(context.supabase, context.userId);
    return resolveObjection(context.supabase, {
      objectionId: data.objectionId,
      response: data.response ?? null,
      resolution: data.resolution,
    });
  });

export const reanalyzeStaleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).optional(),
        entityIds: z.array(z.string().uuid()).max(200).optional(),
        candidateId: z.string().uuid().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { reanalyzeStaleEntities, entityIdForCandidate } = await import("./crm-intelligence.server");
    await assertLeadWork(context.supabase, context.userId);

    let entityIds = data.entityIds ?? [];
    if (!entityIds.length && data.candidateId) {
      const id = await entityIdForCandidate(context.supabase, data.candidateId);
      if (!id) throw new Error("Bisnis ini belum tertaut ke identitas bisnis terpadu.");
      entityIds = [id];
    }
    return reanalyzeStaleEntities(context.supabase, {
      ...(data.limit ? { limit: data.limit } : {}),
      ...(entityIds.length ? { entityIds } : {}),
    });
  });

export const getBusinessIntelligenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ entityId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { getBusinessIntelligence } = await import("./crm-intelligence.server");
    await assertLeadWork(context.supabase, context.userId);
    return getBusinessIntelligence(context.supabase, data.entityId);
  });
