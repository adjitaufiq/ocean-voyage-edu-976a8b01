import { z } from "zod";

import { attributionSchema } from "./acquisition-schema";

/** Shared (client-safe) validation schema for the consultation form. */
export const consultationFormSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().trim().email("Email tidak valid").max(255),
  whatsapp: z
    .string()
    .trim()
    .min(8, "Nomor WhatsApp tidak valid")
    .max(25)
    .regex(/^[0-9+\-\s()]+$/, "Nomor WhatsApp hanya boleh angka"),
  projectType: z.string().trim().min(1, "Pilih jenis project").max(80),
  requirement: z.string().trim().min(10, "Ceritakan kebutuhan minimal 10 karakter").max(2000),
  budget: z.string().trim().min(1, "Pilih estimasi budget").max(80),
  timeline: z.string().trim().min(1, "Pilih target waktu").max(80),
  businessName: z.string().trim().max(120).optional().or(z.literal("")),
  features: z.string().trim().max(1000).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ConsultationForm = z.infer<typeof consultationFormSchema>;

/** Hidden lead-intelligence payload attached to a submission (best-effort). */
export const leadTrackingSchema = z.object({
  utmSource: z.string().max(120).default(""),
  utmMedium: z.string().max(120).default(""),
  utmCampaign: z.string().max(120).default(""),
  referrer: z.string().max(500).default(""),
  landingPage: z.string().max(300).default(""),
  visitedPages: z.array(z.string().max(300)).max(60).default([]),
  visitorSource: z.string().max(120).default("direct"),
  selectedPackage: z.string().max(120).default(""),
  viewedProducts: z.array(z.string().max(120)).max(30).default([]),
  clickedCtas: z.array(z.string().max(160)).max(30).default([]),
  journey: z
    .array(z.object({ step: z.string().max(160), at: z.string().max(40) }))
    .max(60)
    .default([]),
  visitDurationSeconds: z.number().int().min(0).max(86400).default(0),
  deviceType: z.enum(["mobile", "tablet", "desktop", "unknown"]).default("unknown"),
  leadScore: z.number().int().min(0).max(1000).default(0),
  leadTemperature: z.enum(["Cold Lead", "Warm Lead", "Hot Lead"]).default("Cold Lead"),
});

export type LeadTrackingPayload = z.infer<typeof leadTrackingSchema>;

/** AI consultant outcome attached to a submission (best-effort). */
export const aiConsultationSchema = z.object({
  businessCategory: z.string().max(120).default(""),
  problems: z.array(z.string().max(160)).max(20).default([]),
  requirements: z.array(z.string().max(160)).max(20).default([]),
  packageName: z.string().max(160).default(""),
  complexity: z.enum(["Low", "Medium", "High"]).default("Low"),
  score: z.number().int().min(0).max(100).default(0),
  qualification: z.enum(["Cold Lead", "Warm Lead", "Hot Lead"]).default("Cold Lead"),
  summary: z.string().max(4000).default(""),
  conversation: z
    .array(z.object({ q: z.string().max(300), a: z.string().max(600) }))
    .max(20)
    .default([]),
  budget: z.string().max(120).optional(),
  timeline: z.string().max(120).optional(),
  users: z.string().max(120).optional(),
});

export type AiConsultationPayload = z.infer<typeof aiConsultationSchema>;

/** Full submission payload: visible form fields + hidden tracking. */
export const consultationSubmissionSchema = z.object({
  form: consultationFormSchema,
  tracking: leadTrackingSchema.optional(),
  ai: aiConsultationSchema.optional(),
  leadSource: z.enum(["ai_consultant", "manual_form"]).default("manual_form"),
  /** Acquisition attribution (first/last touch). Additive and optional. */
  attribution: attributionSchema.optional(),
  /** Hidden honeypot — must stay empty for real visitors. */
  honeypot: z.string().max(200).optional().default(""),
  /** Milliseconds between form render and submit (bot heuristic). */
  elapsedMs: z.number().int().min(0).max(86_400_000).optional().default(0),
});

export type ConsultationSubmission = z.infer<typeof consultationSubmissionSchema>;

