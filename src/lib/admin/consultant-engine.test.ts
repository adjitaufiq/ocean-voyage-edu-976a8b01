import { describe, expect, it } from "vitest";

import {
  analysisToOrderBrief,
  buildConsultantAnalysis,
  buildSalesContextSnapshot,
  hashInput,
  type ConsultantEngineInput,
} from "./consultant-engine";

function input(partial: Partial<ConsultantEngineInput> & { businessName: string }): ConsultantEngineInput {
  return {
    city: "Bandung",
    googleMapsUrl: "https://maps.google.com/?cid=1",
    placeId: "place-1",
    rating: 4.6,
    reviewCount: 120,
    ...partial,
  };
}

const SCENARIOS: { label: string; input: ConsultantEngineInput }[] = [
  { label: "salon", input: input({ businessName: "Salon Cantika", category: "salon kecantikan" }) },
  { label: "klinik", input: input({ businessName: "Klinik Sehat Utama", category: "klinik kesehatan" }) },
  { label: "bengkel", input: input({ businessName: "Bengkel Jaya Motor", category: "bengkel mobil" }) },
  { label: "agency", input: input({ businessName: "Studio Kreatif Nusa", category: "digital agency" }) },
  { label: "event organizer", input: input({ businessName: "Acara Prima", category: "event organizer wedding" }) },
  { label: "retail", input: input({ businessName: "Toko Berkah", category: "toko retail sembako" }) },
  { label: "laundry", input: input({ businessName: "Laundry Kilat", category: "laundry kiloan" }) },
  { label: "education", input: input({ businessName: "Bimbel Cerdas", category: "bimbingan belajar" }) },
  { label: "interior", input: input({ businessName: "Karya Interior", category: "furniture interior custom" }) },
  { label: "service business", input: input({ businessName: "Teknik Dingin", category: "jasa service AC" }) },
];

describe("consultant engine — fakta vs hipotesis", () => {
  it("menandai website tidak ditemukan sebagai fakta, bukan kebutuhan", () => {
    const analysis = buildConsultantAnalysis(input({ businessName: "Salon Cantika", category: "salon" }));
    const fact = analysis.observedFacts.find((f) => f.key === "website_missing");
    expect(fact).toBeTruthy();
    expect(analysis.confirmedProblems).toHaveLength(0);
    expect(analysis.problemHypotheses.length).toBeGreaterThan(0);
    for (const hypothesis of analysis.problemHypotheses) {
      expect(hypothesis.needsValidation).toBe(true);
      expect(hypothesis.basis.length).toBeGreaterThan(0);
    }
  });

  it("mencatat website ditemukan sebagai fakta dengan sumber", () => {
    const analysis = buildConsultantAnalysis(
      input({ businessName: "Karya Interior", category: "interior", website: "https://karyainterior.id" }),
    );
    const fact = analysis.observedFacts.find((f) => f.key === "website_found");
    expect(fact?.sourceUrl).toBe("https://karyainterior.id");
    expect(analysis.observedFacts.some((f) => f.key === "website_missing")).toBe(false);
  });

  it("masalah yang customer sebut menjadi confirmed problem, bukan dugaan", () => {
    const analysis = buildConsultantAnalysis(
      input({
        businessName: "Laundry Kilat",
        category: "laundry kiloan",
        statedProblems: ["Pencatatan order masih manual dan nota sering hilang"],
        statedGoals: ["Ingin status pengerjaan bisa dipantau"],
      }),
    );
    expect(analysis.confirmedProblems).toHaveLength(1);
    expect(analysis.confirmedProblems[0]!.source).toBe("customer");
    expect(analysis.coreFeatures.length).toBeGreaterThan(0);
    expect(analysis.problemEvidence[0]!.evidence[0]).toContain("customer");
  });

  it("setiap dugaan punya bukti pendukung pada problem evidence", () => {
    const analysis = buildConsultantAnalysis(input({ businessName: "Bengkel Jaya Motor", category: "bengkel" }));
    for (const row of analysis.problemEvidence) {
      expect(row.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe("consultant engine — lintas industri", () => {
  it("tidak hardcode F&B dan tidak memakai kosakata yang sama untuk semua bisnis", () => {
    const akas = new Set<string>();
    for (const scenario of SCENARIOS) {
      const analysis = buildConsultantAnalysis(scenario.input);
      expect(analysis.businessProfile.summary.toLowerCase()).not.toContain("restoran");
      expect(analysis.businessProfile.summary.toLowerCase()).not.toContain("menu");
      akas.add(analysis.industryContext.aka);
    }
    expect(akas.size).toBeGreaterThan(3);
  });

  it("rekomendasi fitur tidak selalu identik antar industri", () => {
    const signatures = new Set<string>();
    for (const scenario of SCENARIOS) {
      const analysis = buildConsultantAnalysis(scenario.input);
      signatures.add(analysis.coreFeatures.map((f) => f.id).sort().join(","));
    }
    expect(signatures.size).toBeGreaterThan(1);
  });

  it("paket mengikuti SOP: bisnis kecil tanpa struktur tidak pernah enterprise", () => {
    for (const scenario of SCENARIOS) {
      const analysis = buildConsultantAnalysis(scenario.input);
      expect(analysis.recommendedPackage.level).not.toBe("enterprise");
      expect(analysis.recommendedPackage.name).toBeTruthy();
    }
  });

  it("selalu menghasilkan pertanyaan validasi dan panduan keberatan", () => {
    for (const scenario of SCENARIOS) {
      const analysis = buildConsultantAnalysis(scenario.input);
      expect(analysis.validationQuestions.length).toBeGreaterThan(0);
      expect(analysis.objectionGuidance.length).toBeGreaterThan(2);
      expect(analysis.confidenceScore).toBeGreaterThan(0);
      expect(analysis.confidenceScore).toBeLessThanOrEqual(100);
    }
  });
});

describe("consultant engine — versioning & adapter", () => {
  it("input sama menghasilkan hash sama, input berubah menghasilkan hash berbeda", () => {
    const base = input({ businessName: "Klinik Sehat Utama", category: "klinik" });
    expect(hashInput(base)).toBe(hashInput({ ...base }));
    expect(hashInput(base)).not.toBe(hashInput({ ...base, website: "https://kliniksehat.id" }));
  });

  it("sales context snapshot memuat fakta, dugaan, dan angle", () => {
    const analysis = buildConsultantAnalysis(input({ businessName: "Bimbel Cerdas", category: "bimbingan belajar" }));
    const snapshot = buildSalesContextSnapshot(analysis);
    expect(snapshot.verifiedFacts.length).toBeGreaterThan(0);
    expect(snapshot.problemHypotheses.length).toBeGreaterThan(0);
    expect(snapshot.salesAngle.openingHook).toContain("Halo");
    expect(snapshot.recommendedSolution.package).toBeTruthy();
  });

  it("order brief adapter memisahkan dugaan dari masalah customer", () => {
    const analysis = buildConsultantAnalysis(
      input({
        businessName: "Acara Prima",
        category: "event organizer",
        statedProblems: ["Jadwal pekerjaan sering bentrok"],
      }),
    );
    const brief = analysisToOrderBrief(analysis, { whatsapp: "628123456789" });
    expect(brief.problems[0]).toBe("Jadwal pekerjaan sering bentrok");
    expect(brief.problems.slice(1).every((p) => p.startsWith("Dugaan (perlu validasi):"))).toBe(true);
    expect(brief.recommendation).toBe(analysis.recommendedPackage.name);
    expect(brief.features.length).toBeGreaterThan(0);
  });
});
