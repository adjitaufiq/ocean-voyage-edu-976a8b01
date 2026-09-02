/**
 * Authenticated outbound prospecting actions.
 * AI suggests and prepares; a human always verifies and sends outreach.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OUTREACH_CHANNELS, PROSPECT_STATUSES } from "@/lib/admin/prospecting";

function actorEmail(claims: unknown): string | null {
  return claims && typeof claims === "object"
    ? ((claims as { email?: string }).email ?? null)
    : null;
}

const prospectFields = {
  businessName: z.string().min(2).max(200),
  industry: z.string().max(120).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  website: z.string().max(400).nullable().optional(),
  contactName: z.string().max(150).nullable().optional(),
  contactTitle: z.string().max(150).nullable().optional(),
  contactEmail: z.string().max(200).nullable().optional(),
  contactWhatsapp: z.string().max(60).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
  socialMedia: z.string().max(400).nullable().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  source: z.string().max(80).nullable().optional(),
  sourceDetail: z.string().max(300).nullable().optional(),
  researchSummary: z.string().max(4000).nullable().optional(),
  businessSummary: z.string().max(2000).nullable().optional(),
  opportunityReason: z.string().max(2000).nullable().optional(),
  recommendedSolution: z.string().max(1000).nullable().optional(),
  salesApproach: z.string().max(2000).nullable().optional(),
  evidence: z.array(z.string().max(500)).max(20).optional(),
  painSignals: z.array(z.string().max(200)).max(20).optional(),
  notes: z.string().max(4000).nullable().optional(),
  ownerName: z.string().max(120).nullable().optional(),
  verified: z.boolean().optional(),
};

export const getProspects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.string().max(40).optional(),
        tier: z.string().max(20).optional(),
        search: z.string().max(120).optional(),
        campaignId: z.string().uuid().optional(),
        actionableOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    const { fetchProspects, buildProspectingSummary, fetchIcpConfig } =
      await import("./prospecting.server");
    await assertWorkspace(context.supabase, context.userId);
    const [prospects, summary, icp] = await Promise.all([
      fetchProspects(context.supabase, data),
      buildProspectingSummary(context.supabase, 30),
      fetchIcpConfig(context.supabase),
    ]);
    return { prospects, summary, icp };
  });

export const getProspectDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    const { fetchProspect } = await import("./prospecting.server");
    await assertWorkspace(context.supabase, context.userId);
    return fetchProspect(context.supabase, data.id);
  });

export const getCampaignsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertWorkspace } = await import("./admin.server");
    const { fetchCampaigns } = await import("./prospecting-campaigns.server");
    await assertWorkspace(context.supabase, context.userId);
    return fetchCampaigns(context.supabase);
  });

export const createProspectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object(prospectFields).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { createProspect } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    return createProspect(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const updateProspectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(PROSPECT_STATUSES).optional(),
        ...prospectFields,
        businessName: prospectFields.businessName.optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { updateProspect } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    const { id, ...patch } = data;
    return updateProspect(context.supabase, id, patch, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const rescoreProspectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { rescoreProspect } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    return rescoreProspect(context.supabase, data.id, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const saveOutreachDraftFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        channel: z.enum(OUTREACH_CHANNELS),
        subject: z.string().max(200).nullable().optional(),
        draft: z.string().min(10).max(8000),
        approve: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { saveOutreachDraft } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    return saveOutreachDraft(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const recordOutreachFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        event: z.enum(["sent", "reply", "no_reply"]),
        note: z.string().max(2000).nullable().optional(),
        followUpInDays: z.number().int().min(0).max(90).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { recordOutreach } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    return recordOutreach(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const setDoNotContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        enabled: z.boolean(),
        reason: z.string().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { setDoNotContact } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    return setDoNotContact(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const convertProspectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        projectType: z.string().max(120).optional(),
        requirement: z.string().max(4000).optional(),
        budget: z.string().max(120).optional(),
        timeline: z.string().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { convertProspectToLead } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    return convertProspectToLead(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const saveCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(150),
        industry: z.string().min(2).max(120),
        location: z.string().min(2).max(120),
        keywords: z.array(z.string().max(60)).max(20),
        solution: z.string().min(2).max(150),
        dailyTarget: z.number().int().min(1).max(50),
        status: z.string().max(20).optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { saveCampaign } = await import("./prospecting-campaigns.server");
    await assertLeadWork(context.supabase, context.userId);
    return saveCampaign(context.supabase, data, context.userId);
  });

export const deleteCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertManage } = await import("./admin.server");
    const { deleteCampaign } = await import("./prospecting-campaigns.server");
    await assertManage(context.supabase, context.userId);
    return deleteCampaign(context.supabase, data.id);
  });

export const discoverProspectsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ campaignId: z.string().uuid(), count: z.number().int().min(1).max(20).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { discoverProspects } = await import("./prospecting-campaigns.server");
    await assertLeadWork(context.supabase, context.userId);
    return discoverProspects(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const generateIntelligenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { generateProspectIntelligence } = await import("./prospecting-campaigns.server");
    await assertLeadWork(context.supabase, context.userId);
    return generateProspectIntelligence(context.supabase, data.id, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const generateOutreachFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), channel: z.enum(OUTREACH_CHANNELS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { generateOutreachMessage } = await import("./prospecting-campaigns.server");
    await assertLeadWork(context.supabase, context.userId);
    return generateOutreachMessage(context.supabase, data);
  });

export const setPipelineStageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(PROSPECT_STATUSES) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { updateProspect } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    return updateProspect(
      context.supabase,
      data.id,
      { status: data.status },
      { userId: context.userId, email: actorEmail(context.claims) },
    );
  });

export const setFollowUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), date: z.string().datetime().nullable() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { setProspectFollowUp } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    return setProspectFollowUp(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const addNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { addProspectNote } = await import("./prospecting.server");
    await assertLeadWork(context.supabase, context.userId);
    return addProspectNote(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const saveIcpConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        industries: z.array(z.string().max(60)).max(40),
        cities: z.array(z.string().max(60)).max(40),
        painKeywords: z.array(z.string().max(60)).max(60),
        excludeKeywords: z.array(z.string().max(60)).max(60),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertManage } = await import("./admin.server");
    const { fetchIcpConfig, saveIcpConfig } = await import("./prospecting.server");
    await assertManage(context.supabase, context.userId);
    const current = await fetchIcpConfig(context.supabase);
    return saveIcpConfig(context.supabase, { ...current, ...data }, context.userId);
  });
