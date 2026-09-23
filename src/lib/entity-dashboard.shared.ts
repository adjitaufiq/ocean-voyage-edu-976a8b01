/** Funnel vocabulary shared by server functions and the dashboard UI. */
export const FUNNEL_STAGES = [
  "found",
  "enriched",
  "verified",
  "qualified",
  "analyzed",
  "sales_prepared",
  "ready_outreach",
  "contacted",
  "meeting",
  "deal",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  found: "Ditemukan",
  enriched: "Data diperkaya",
  verified: "Terverifikasi",
  qualified: "Sesuai target",
  analyzed: "Dianalisis konsultan",
  sales_prepared: "Materi penjualan siap",
  ready_outreach: "Siap dihubungi",
  contacted: "Sudah dihubungi",
  meeting: "Meeting",
  deal: "Deal",
};

export const SOURCE_FILTERS = [
  { value: "prospect_candidate", label: "Discovery / Google Maps" },
  { value: "prospect", label: "Prospek CRM" },
  { value: "consultation", label: "Konsultasi" },
  { value: "ai_conversation", label: "Percakapan AI" },
] as const;
