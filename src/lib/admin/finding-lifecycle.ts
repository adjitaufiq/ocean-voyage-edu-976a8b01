/**
 * FINDING LIFECYCLE — client-safe, deterministik (Phase 6).
 *
 * Temuan bisnis tidak pernah ditimpa. Ketika customer menjawab dan membantah
 * dugaan lama, dugaan itu ditandai ditolak (rejected) atau digantikan
 * (superseded), lalu temuan baru ditambahkan sebagai baris tersendiri.
 * Riwayat lengkap tetap tersimpan.
 */
import type { DetectedFinding } from "@/lib/admin/response-analysis";

export type ExistingFinding = {
  id: string;
  topicKey: string | null;
  kind: "fact" | "hypothesis";
  statement: string;
  validationStatus: "unvalidated" | "confirmed" | "rejected" | "superseded";
};

export type FindingInsert = {
  topicKey: string;
  kind: "fact" | "hypothesis";
  statement: string;
  confidence: number;
  validationStatus: "unvalidated" | "confirmed";
};

export type LifecyclePlan = {
  /** Dugaan lama yang dibantah customer. */
  reject: { id: string; reason: string }[];
  /** Fakta lama yang digantikan fakta baru pada topik sama. */
  supersede: { id: string; reason: string }[];
  insert: FindingInsert[];
  /** Alasan analisis perlu diperbarui; null bila tidak ada perubahan berarti. */
  staleReason: string | null;
};

const ACTIVE = new Set(["unvalidated", "confirmed"]);

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Susun rencana perubahan temuan tanpa menghapus satu baris pun. */
export function planFindingLifecycle(
  existing: ExistingFinding[],
  detected: DetectedFinding[],
): LifecyclePlan {
  const reject: LifecyclePlan["reject"] = [];
  const supersede: LifecyclePlan["supersede"] = [];
  const insert: FindingInsert[] = [];
  const changed: string[] = [];

  for (const found of detected) {
    const related = existing.filter(
      (row) => row.topicKey === found.topicKey && ACTIVE.has(row.validationStatus),
    );
    const duplicate = related.find(
      (row) => same(row.statement, found.statement) && row.validationStatus === "confirmed",
    );
    if (duplicate) continue;

    for (const row of related) {
      if (same(row.statement, found.statement)) {
        // Dugaan lama yang sekarang dikonfirmasi customer.
        if (row.kind === "hypothesis" && found.kind === "fact") {
          supersede.push({ id: row.id, reason: `Dikonfirmasi customer: ${found.statement}` });
        }
        continue;
      }
      if (row.kind === "hypothesis") {
        reject.push({ id: row.id, reason: `Dibantah respons customer: ${found.statement}` });
      } else if (found.kind === "fact") {
        supersede.push({ id: row.id, reason: `Digantikan fakta baru: ${found.statement}` });
      }
    }

    insert.push({
      topicKey: found.topicKey,
      kind: found.kind,
      statement: found.statement,
      confidence: found.confidence,
      validationStatus: found.kind === "fact" ? "confirmed" : "unvalidated",
    });
    if (found.kind === "fact") changed.push(found.statement);
  }

  const staleReason =
    changed.length || reject.length
      ? `Informasi baru dari customer: ${[...changed, ...reject.map((r) => r.reason)]
          .slice(0, 3)
          .join("; ")}`
      : null;

  return { reject, supersede, insert, staleReason };
}
