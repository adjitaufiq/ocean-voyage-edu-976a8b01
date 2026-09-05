/** Client-safe model for the AI Business Assistant memory layer. */

export const MEMORY_CATEGORIES = ["business", "sales", "project", "operational"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  business: "Business Memory",
  sales: "Sales Memory",
  project: "Project Memory",
  operational: "Operational Memory",
};

export const MEMORY_CATEGORY_HINTS: Record<MemoryCategory, string> = {
  business: "Profil perusahaan, layanan, paket, strategi harga, keputusan bisnis.",
  sales: "Lead penting, diskusi pelanggan, strategi sales.",
  project: "Diskusi project, preferensi klien, keputusan, kendala.",
  operational: "Workflow tim, aturan automation, rekomendasi sebelumnya.",
};

export function isMemoryCategory(value: unknown): value is MemoryCategory {
  return typeof value === "string" && (MEMORY_CATEGORIES as readonly string[]).includes(value);
}

/* ------------------------------ Provenance ------------------------------- */

/**
 * Where a memory came from. Trust is ordered: system/database truth outranks
 * user-confirmed facts, which outrank AI recommendations and hypotheses.
 */
export const MEMORY_PROVENANCES = [
  "database_fact",
  "user_confirmed_fact",
  "user_preference",
  "assistant_recommendation",
  "hypothesis",
] as const;
export type MemoryProvenance = (typeof MEMORY_PROVENANCES)[number];

/** Provenances an AI extraction pipeline may ever assign. Facts require a trusted source. */
export const AI_ASSIGNABLE_PROVENANCES = [
  "user_confirmed_fact",
  "user_preference",
  "assistant_recommendation",
  "hypothesis",
] as const;

export const MEMORY_PROVENANCE_LABELS: Record<MemoryProvenance, string> = {
  database_fact: "Fakta sistem",
  user_confirmed_fact: "Dikonfirmasi owner",
  user_preference: "Preferensi owner",
  assistant_recommendation: "Rekomendasi AI",
  hypothesis: "Dugaan AI",
};

export const MEMORY_TRUST_RANK: Record<MemoryProvenance, number> = {
  database_fact: 5,
  user_confirmed_fact: 4,
  user_preference: 3,
  assistant_recommendation: 2,
  hypothesis: 1,
};

export function isMemoryProvenance(value: unknown): value is MemoryProvenance {
  return typeof value === "string" && (MEMORY_PROVENANCES as readonly string[]).includes(value);
}

/** Never lets AI output claim database-level truth; unknown values fall back to hypothesis. */
export function clampAiProvenance(value: unknown): MemoryProvenance {
  return (AI_ASSIGNABLE_PROVENANCES as readonly string[]).includes(String(value))
    ? (value as MemoryProvenance)
    : "hypothesis";
}

export function isTrustedFact(provenance: MemoryProvenance): boolean {
  return MEMORY_TRUST_RANK[provenance] >= 3;
}

export function memoryProvenanceClass(provenance: MemoryProvenance): string {
  return isTrustedFact(provenance)
    ? "border-primary/40 bg-primary/10 text-primary"
    : "border-border/60 bg-muted/40 text-muted-foreground";
}

export type AssistantMemory = {
  id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  importance: number;
  provenance: MemoryProvenance;
  source_thread_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AssistantThread = {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
};

export type AssistantStoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export function memoryCategoryClass(category: MemoryCategory): string {
  switch (category) {
    case "business":
      return "border-primary/40 bg-primary/15 text-primary";
    case "sales":
      return "border-accent/40 bg-accent/20 text-accent-foreground";
    case "project":
      return "border-border/60 bg-secondary/40 text-secondary-foreground";
    default:
      return "border-border/60 bg-muted/40 text-muted-foreground";
  }
}
