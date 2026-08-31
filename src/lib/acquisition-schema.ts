import { z } from "zod";

/** Channels recognised by the acquisition engine. */
export const acquisitionChannels = [
  "Google Organic",
  "Bing Organic",
  "ChatGPT",
  "Other AI Referral",
  "Direct",
  "Social",
  "Referral",
  "Campaign",
  "Unknown",
] as const;

export const touchPointSchema = z.object({
  channel: z.enum(acquisitionChannels).default("Unknown"),
  source: z.string().max(160).default(""),
  medium: z.string().max(120).default(""),
  campaign: z.string().max(160).default(""),
  content: z.string().max(160).default(""),
  term: z.string().max(160).default(""),
  referrer: z.string().max(500).default(""),
  page: z.string().max(300).default(""),
  at: z.string().max(40).default(""),
});

export const attributionSchema = z.object({
  visitorId: z.string().max(64).default(""),
  firstTouch: touchPointSchema,
  lastTouch: touchPointSchema,
  firstContentPath: z.string().max(300).default(""),
  firstContentTitle: z.string().max(200).default(""),
});

export type AttributionInput = z.infer<typeof attributionSchema>;

/** Funnel events persisted first-party for business reporting. */
export const acquisitionEvents = [
  "landing_view",
  "project_view",
  "live_demo_click",
  "ai_consultant_open",
  "ai_consultant_started",
  "ai_consultant_completed",
  "lead_contact_submitted",
  "qualified_lead_created",
  "proposal_created",
  "proposal_sent",
  "invoice_created",
  "deal_won",
] as const;

export type AcquisitionEventName = (typeof acquisitionEvents)[number];

export const acquisitionEventSchema = z.object({
  event: z.enum(acquisitionEvents),
  path: z.string().max(300).default(""),
  label: z.string().max(200).default(""),
  sessionId: z.string().max(64).default(""),
  deviceType: z.enum(["mobile", "tablet", "desktop", "unknown"]).default("unknown"),
  attribution: attributionSchema,
});

export type AcquisitionEventInput = z.infer<typeof acquisitionEventSchema>;
