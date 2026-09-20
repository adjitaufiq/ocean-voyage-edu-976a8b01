/**
 * Authenticated outbound prospecting actions.
 * AI suggests and prepares; a human always verifies and sends outreach.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AUDIT_VERDICTS, OUTREACH_CHANNELS, PROSPECT_STATUSES } from "@/lib/admin/prospecting";

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
  potentialNeed: z.string().max(1000).nullable().optional(),
  businessProblem: z.string().max(1000).nullable().optional(),
  buyingSignal: z.string().max(1000).nullable().optional(),
  decisionMaker: z.string().max(300).nullable().optional(),
  evidence: z.array(z.string().max(500)).max(20).optional(),
  painSignals: z.array(z.string().max(200)).max(20).optional(),
  notes: z.string().max(4000).nullable().optional(),
  ownerName: z.string().max(120).nullable().optional(),
  verified: z.boolean().optional(),
  phoneSource: z.string().max(60).nullable().optional(),
  phoneSourceUrl: z.string().max(600).nullable().optional(),
  emailSource: z.string().max(60).nullable().optional(),
  emailSourceUrl: z.string().max(600).nullable().optional(),
  websiteSource: z.string().max(60).nullable().optional(),
  websiteSourceUrl: z.string().max(600).nullable().optional(),
  socialSource: z.string().max(60).nullable().optional(),
  socialSourceUrl: z.string().max(600).nullable().optional(),
  googleMapsUrl: z.string().max(600).nullable().optional(),
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
        solution: z.string().max(150).optional(),
        solutions: z.array(z.string().max(150)).max(20).optional(),
        customSolutions: z.array(z.string().max(150)).max(20).optional(),
        primarySolution: z.string().max(150).nullable().optional(),
        dailyTarget: z.number().int().min(1).max(500),
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

/** Data Reverification: refresh contact provenance + scores for one or all prospects. */
export const reverifyProspectsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        scope: z.enum(["one", "all"]).default("one"),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { reverifyProspects } = await import("./prospecting-reverify.server");
    await assertLeadWork(context.supabase, context.userId);
    return reverifyProspects(
      context.supabase,
      data.scope === "all" ? { scope: "all", limit: data.limit } : { ids: data.id ? [data.id] : [] },
      { userId: context.userId, email: actorEmail(context.claims) },
    );
  });

/** Validation ladder: run the six checks + AI quality gate. */
export const validateProspectsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        scope: z.enum(["one", "all"]).default("one"),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { validateProspects } = await import("./prospecting-validation.server");
    await assertLeadWork(context.supabase, context.userId);
    return validateProspects(
      context.supabase,
      data.scope === "all" ? { scope: "all", limit: data.limit } : { ids: data.id ? [data.id] : [] },
      { userId: context.userId, email: actorEmail(context.claims) },
    );
  });

export const listAuditsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        campaignId: z.string().uuid().nullable().optional(),
        pendingOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertWorkspace } = await import("./admin.server");
    const { fetchAudits } = await import("./prospecting-audit.server");
    await assertWorkspace(context.supabase, context.userId);
    return fetchAudits(context.supabase, data);
  });

export const sampleAuditFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        campaignId: z.string().uuid().nullable().optional(),
        size: z.number().int().min(1).max(50).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { sampleAudits } = await import("./prospecting-audit.server");
    await assertLeadWork(context.supabase, context.userId);
    return sampleAudits(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const submitAuditFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        verdict: z.enum(AUDIT_VERDICTS),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertManage } = await import("./admin.server");
    const { submitAuditVerdict } = await import("./prospecting-audit.server");
    await assertManage(context.supabase, context.userId);
    return submitAuditVerdict(context.supabase, data, {
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

/* ------------------------ Candidate layer (V4) ---------------------------- */

export const getCandidatesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.string().max(40).optional(),
        campaignId: z.string().uuid().optional(),
        search: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { fetchCandidates, buildCandidateSummary } = await import(
      "./prospecting-candidates.server"
    );
    await assertLeadWork(context.supabase, context.userId);
    const [candidates, summary] = await Promise.all([
      fetchCandidates(context.supabase, data),
      buildCandidateSummary(context.supabase),
    ]);
    return { candidates, summary };
  });

export const discoverCandidatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        campaignId: z.string().uuid(),
        count: z.number().int().min(1).max(25).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { discoverCandidates } = await import("./prospecting-candidates.server");
    await assertLeadWork(context.supabase, context.userId);
    return discoverCandidates(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const requestCandidateReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), reason: z.string().max(500).nullable().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { requestCandidateReview } = await import("./prospecting-candidates.server");
    await assertLeadWork(context.supabase, context.userId);
    return requestCandidateReview(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const approveCandidateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), note: z.string().max(500).nullable().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { approveCandidate } = await import("./prospecting-candidates.server");
    await assertLeadWork(context.supabase, context.userId);
    return approveCandidate(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const getCandidateEventsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { fetchCandidateEvents } = await import("./prospecting-candidates.server");
    await assertLeadWork(context.supabase, context.userId);
    return fetchCandidateEvents(context.supabase, data.id);
  });

export const rejectCandidateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), reason: z.string().max(500).nullable().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { rejectCandidate } = await import("./prospecting-candidates.server");
    await assertLeadWork(context.supabase, context.userId);
    return rejectCandidate(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const restoreCandidateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { restoreCandidate } = await import("./prospecting-candidates.server");
    await assertLeadWork(context.supabase, context.userId);
    return restoreCandidate(context.supabase, data.id, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const createCandidateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        businessName: z.string().min(2).max(200),
        industry: z.string().max(120).nullable().optional(),
        city: z.string().max(120).nullable().optional(),
        campaignId: z.string().uuid().nullable().optional(),
        whyMatchIcp: z.string().max(2000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { createManualCandidate } = await import("./prospecting-candidates.server");
    await assertLeadWork(context.supabase, context.userId);
    return createManualCandidate(context.supabase, data, { userId: context.userId });
  });

/* --------------------- External verification (Apify) ---------------------- */

export const enrichCandidateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { enrichCandidateWithApify } = await import("./prospecting-apify.server");
    await assertLeadWork(context.supabase, context.userId);
    return enrichCandidateWithApify(context.supabase, data.id, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const validateExternalEvidenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { validateExternalEvidence } = await import("./prospecting-apify.server");
    await assertLeadWork(context.supabase, context.userId);
    return validateExternalEvidence(context.supabase, data.id);
  });

export const promoteCandidateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { promoteCandidateToProspect } = await import("./prospecting-apify.server");
    await assertLeadWork(context.supabase, context.userId);
    return promoteCandidateToProspect(context.supabase, data.id, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

/* ------------------------ Trust score + entity resolution ------------------ */

export const recomputeTrustFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ scope: z.enum(["one", "all"]), id: z.string().uuid().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { recomputeTrust } = await import("./prospecting-trust.server");
    await assertLeadWork(context.supabase, context.userId);
    return recomputeTrust(context.supabase, data);
  });

export const runEntityResolutionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { runEntityResolution } = await import("./prospecting-trust.server");
    await assertLeadWork(context.supabase, context.userId);
    return runEntityResolution(context.supabase, { userId: context.userId });
  });

export const getEntityMatchesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z
          .enum(["open", "flagged", "needs_review", "confirmed_duplicate", "not_duplicate", "ignored"])
          .optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { fetchEntityMatches } = await import("./prospecting-trust.server");
    await assertLeadWork(context.supabase, context.userId);
    return fetchEntityMatches(context.supabase, data);
  });

export const reviewEntityMatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["confirmed_duplicate", "not_duplicate", "ignored"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { reviewEntityMatch } = await import("./prospecting-trust.server");
    await assertLeadWork(context.supabase, context.userId);
    return reviewEntityMatch(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

/* ------------------------------------------------------------------ */
/* Discovery engine                                                    */
/* ------------------------------------------------------------------ */

export const planDiscoveryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        campaignId: z.string().uuid(),
        keywords: z.array(z.string().min(1).max(120)).max(40).optional(),
        areas: z.array(z.string().min(1).max(120)).max(40).optional(),
        radiusMeters: z.number().int().min(500).max(50000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { planCampaignDiscovery } = await import("./prospecting-discovery.server");
    await assertLeadWork(context.supabase, context.userId);
    return planCampaignDiscovery(context.supabase, data, { userId: context.userId });
  });

export const runDiscoveryBatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        campaignId: z.string().uuid().optional(),
        taskId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(5).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { runDiscoveryBatch } = await import("./prospecting-discovery.server");
    await assertLeadWork(context.supabase, context.userId);
    return runDiscoveryBatch(context.supabase, data);
  });

export const retryDiscoveryTasksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        campaignId: z.string().uuid().optional(),
        taskId: z.string().uuid().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { retryFailedDiscoveryTasks } = await import("./prospecting-discovery.server");
    await assertLeadWork(context.supabase, context.userId);
    return retryFailedDiscoveryTasks(context.supabase, data);
  });

export const discoveryOverviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { buildDiscoveryOverview } = await import("./prospecting-discovery.server");
    await assertLeadWork(context.supabase, context.userId);
    return buildDiscoveryOverview(context.supabase);
  });

/* ------------------------------------------------------------------ */
/* Qualification intelligence (Prompt 4.4)                             */
/* ------------------------------------------------------------------ */

export const qualifyCandidatesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        candidateId: z.string().uuid().optional(),
        campaignId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { qualifyCandidates } = await import("./prospecting-qualification.server");
    await assertLeadWork(context.supabase, context.userId);
    return qualifyCandidates(context.supabase, data);
  });

export const setCandidateQcFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "reviewed", "approved", "rejected", "duplicate", "contacted"]),
        reason: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { setCandidateQc } = await import("./prospecting-qualification.server");
    await assertLeadWork(context.supabase, context.userId);
    return setCandidateQc(context.supabase, data, {
      userId: context.userId,
      email: actorEmail(context.claims),
    });
  });

export const qualificationBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        campaignId: z.string().uuid().optional(),
        category: z.string().max(120).optional(),
        city: z.string().max(120).optional(),
        temperature: z.string().max(20).optional(),
        qcStatus: z.string().max(20).optional(),
        minScore: z.number().int().min(0).max(100).optional(),
        digitalGap: z.string().max(200).optional(),
        solution: z.string().max(300).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { buildQualificationBoard } = await import("./prospecting-qualification.server");
    await assertLeadWork(context.supabase, context.userId);
    return buildQualificationBoard(context.supabase, data);
  });

/* ------------------- Prompt 4.5 — Sales Preparation ---------------------- */

/** Manual mode: one candidate (quality control / regeneration). */
export const prepareSalesOneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidateId: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { prepareSalesForCandidate } = await import("./prospecting-salesprep.server");
    await assertLeadWork(context.supabase, context.userId);
    return prepareSalesForCandidate(context.supabase, data.candidateId);
  });

/** Batch mode: one bounded chunk per call, driven by the UI cursor. */
export const prepareSalesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId?: string; limit?: number; offset?: number }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { prepareSalesForCandidates } = await import("./prospecting-salesprep.server");
    await assertLeadWork(context.supabase, context.userId);
    return prepareSalesForCandidates(context.supabase, data);
  });

export const setSalesStageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; stage: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { setSalesStage } = await import("./prospecting-salesprep.server");
    const { SALES_STAGES } = await import("@/lib/admin/sales-prep");
    await assertLeadWork(context.supabase, context.userId);
    const stage = data.stage as (typeof SALES_STAGES)[number];
    if (!SALES_STAGES.includes(stage)) throw new Error("Tahap penjualan tidak dikenal.");
    return setSalesStage(
      context.supabase,
      { id: data.id, stage },
      { userId: context.userId, email: actorEmail(context.claims) },
    );
  });

export const salesPrepBoardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId?: string; stage?: string; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const { assertLeadWork } = await import("./admin.server");
    const { buildSalesPrepBoard } = await import("./prospecting-salesprep.server");
    await assertLeadWork(context.supabase, context.userId);
    return buildSalesPrepBoard(context.supabase, data);
  });
