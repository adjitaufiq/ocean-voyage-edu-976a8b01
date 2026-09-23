/**
 * Consultative outreach draft (Phase 4).
 *
 * The draft is built from the Consultant Analysis, never from a fresh
 * diagnosis: facts are stated as facts, hypotheses are asked as questions,
 * and no customer problem is ever claimed as confirmed.
 */
import type { SalesContextSnapshot } from "@/lib/admin/consultant-engine";

export type ConsultantDraft = {
  opening: string;
  observation: string;
  question: string;
  value: string;
  cta: string;
};

function firstSentences(items: string[], max: number): string[] {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, max);
}

export function buildConsultantDraft(
  businessName: string,
  snapshot: Pick<
    SalesContextSnapshot,
    "verifiedFacts" | "validationQuestions" | "recommendedSolution" | "salesAngle"
  >,
): ConsultantDraft {
  const facts = firstSentences(snapshot.verifiedFacts, 2);
  const questions = firstSentences(snapshot.validationQuestions, 2);
  const features = firstSentences(snapshot.recommendedSolution.features, 3);

  const opening =
    `Halo ${businessName}, saya dari KERJAKU. ` +
    (snapshot.salesAngle.openingHook?.trim() ||
      "Saya sedang melihat beberapa bisnis di sekitar Anda dan profil Anda menarik perhatian saya.");

  const observation = facts.length
    ? `Dari data publik yang bisa saya lihat: ${facts.join("; ")}.`
    : "Saya baru melihat profil publik bisnis Anda, jadi gambaran saya masih terbatas.";

  const question = questions.length
    ? `Supaya saya tidak berasumsi, boleh saya tanya: ${questions.join(" ")}`
    : "Boleh saya tanya sedikit soal cara Anda menangani pesanan dan pertanyaan pelanggan sekarang?";

  const value = features.length
    ? `Kalau memang relevan, biasanya kami bantu lewat ${snapshot.recommendedSolution.package} — misalnya ${features.join(", ")}.`
    : `Kalau memang relevan, biasanya kami bantu lewat ${snapshot.recommendedSolution.package}.`;

  return {
    opening,
    observation,
    question,
    value,
    cta: "Kalau berkenan, saya kirim contohnya dulu. Tidak perlu memutuskan apa pun hari ini.",
  };
}

export function consultantDraftText(draft: ConsultantDraft): string {
  return [draft.opening, draft.observation, draft.question, draft.value, draft.cta]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}
