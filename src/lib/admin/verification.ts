/**
 * Human verification gate + outreach helpers — client-safe.
 *
 * AI prepares everything; a person confirms the facts before any message is
 * sent. Ready Outreach is only "verified" once every checklist item is ticked.
 */

export const VERIFICATION_ITEMS = [
  "name_matches_source",
  "location_matches",
  "rating_matches",
  "website_check_valid",
  "whatsapp_valid",
  "opportunity_reasonable",
  "message_reviewed",
] as const;
export type VerificationItem = (typeof VERIFICATION_ITEMS)[number];

export const VERIFICATION_ITEM_LABELS: Record<VerificationItem, string> = {
  name_matches_source: "Nama bisnis sesuai sumber",
  location_matches: "Lokasi sesuai",
  rating_matches: "Rating/review sesuai",
  website_check_valid: "Cek website valid",
  whatsapp_valid: "Nomor WhatsApp valid",
  opportunity_reasonable: "Peluang AI masuk akal",
  message_reviewed: "Draf pesan sudah sesuai",
};

export type VerificationChecklist = Partial<Record<VerificationItem, boolean>>;

export function normalizeChecklist(raw: unknown): VerificationChecklist {
  const source = (raw ?? {}) as Record<string, unknown>;
  const result: VerificationChecklist = {};
  for (const item of VERIFICATION_ITEMS) {
    if (source[item] === true) result[item] = true;
  }
  return result;
}

export function checklistMissing(raw: unknown): VerificationItem[] {
  const checklist = normalizeChecklist(raw);
  return VERIFICATION_ITEMS.filter((item) => checklist[item] !== true);
}

export function checklistComplete(raw: unknown): boolean {
  return checklistMissing(raw).length === 0;
}

export const VERIFICATION_STATES = ["pending_verification", "verified_ready_outreach"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const VERIFICATION_STATE_LABELS: Record<VerificationState, string> = {
  pending_verification: "Pending Verification",
  verified_ready_outreach: "Verified Ready Outreach",
};

export function verificationState(raw: unknown): VerificationState {
  return checklistComplete(raw) ? "verified_ready_outreach" : "pending_verification";
}

/* ------------------------------ CRM stages ------------------------------- */

export const CONTACT_STAGES = [
  "contacted",
  "replied",
  "demo_scheduled",
  "interested",
  "deal",
  "lost",
] as const;
export type ContactStage = (typeof CONTACT_STAGES)[number];

export const CONTACT_STAGE_LABELS: Record<ContactStage, string> = {
  contacted: "Dihubungi",
  replied: "Dibalas",
  demo_scheduled: "Demo dijadwalkan",
  interested: "Tertarik",
  deal: "Deal",
  lost: "Gagal",
};

export function contactStageClass(stage: ContactStage): string {
  switch (stage) {
    case "deal":
      return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
    case "lost":
      return "border-rose-400/40 bg-rose-400/10 text-rose-200";
    case "interested":
    case "demo_scheduled":
      return "border-primary/40 bg-primary/10 text-primary";
    default:
      return "border-border/50 bg-muted/20 text-muted-foreground";
  }
}

/* --------------------------- WhatsApp helpers ---------------------------- */

/** Indonesian numbers only; returns null when the number is unusable. */
export function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  let normalized = digits.startsWith("+") ? digits.slice(1) : digits;
  if (normalized.startsWith("0")) normalized = `62${normalized.slice(1)}`;
  if (normalized.startsWith("8")) normalized = `62${normalized}`;
  if (!normalized.startsWith("62")) return null;
  return normalized.length >= 10 && normalized.length <= 15 ? normalized : null;
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const number = whatsappNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message.slice(0, 1500))}`;
}

export function composeOutreachMessage(draft: Record<string, string> | null | undefined): string {
  const message = draft ?? {};
  return [
    message["opening_message"],
    message["reason_contacting"],
    message["value_proposition"],
    message["call_to_action"],
  ]
    .filter(Boolean)
    .join("\n\n");
}

/* ---------------- Evidence-backed checklist (client-safe) ---------------- */

/** Which evidence row backs each checklist item. */
const CHECKLIST_EVIDENCE_FIELD: Record<VerificationItem, string | null> = {
  name_matches_source: "Nama bisnis",
  location_matches: "Lokasi",
  rating_matches: "Rating & ulasan",
  website_check_valid: "Website",
  whatsapp_valid: "Nomor telepon / WhatsApp",
  opportunity_reasonable: null,
  message_reviewed: null,
};

export type ChecklistEvidenceRow = {
  item: VerificationItem;
  label: string;
  checked: boolean;
  claim: string;
  source: string;
  sourceUrl: string | null;
  confidence: number | null;
};

/**
 * Pairs every checklist item with the AI claim, its source and confidence, so
 * a human never confirms an item without seeing what backs it.
 */
export function checklistWithEvidence(
  checklistRaw: unknown,
  evidence: {
    field: string;
    data: string;
    source: string;
    source_url: string | null;
    confidence: number;
  }[],
  fallback?: { opportunity?: string | null; message?: string | null },
): ChecklistEvidenceRow[] {
  const checklist = normalizeChecklist(checklistRaw);
  const byField = new Map(evidence.map((row) => [row.field, row]));

  return VERIFICATION_ITEMS.map((item) => {
    const field = CHECKLIST_EVIDENCE_FIELD[item];
    const row = field ? byField.get(field) : undefined;
    if (row) {
      return {
        item,
        label: VERIFICATION_ITEM_LABELS[item],
        checked: checklist[item] === true,
        claim: row.data,
        source: row.source,
        sourceUrl: row.source_url,
        confidence: row.confidence,
      };
    }
    const claim =
      item === "opportunity_reasonable"
        ? (fallback?.opportunity ?? "Belum ada ringkasan peluang.")
        : (fallback?.message ?? "Belum ada draf pesan.");
    return {
      item,
      label: VERIFICATION_ITEM_LABELS[item],
      checked: checklist[item] === true,
      claim,
      source: "Analisis AI KERJAKU",
      sourceUrl: null,
      confidence: null,
    };
  });
}
