import { describe, expect, it } from "vitest";

import {
  buildConsultantAnalysis,
  buildSalesContextSnapshot,
  type ConsultantEngineInput,
} from "@/lib/admin/consultant-engine";
import { buildConsultantDraft, consultantDraftText } from "@/lib/admin/consultant-outreach";

const INDUSTRIES: Array<[string, string]> = [
  ["Salon Melati", "salon kecantikan"],
  ["Klinik Sehat Utama", "klinik gigi"],
  ["Bengkel Jaya Motor", "bengkel mobil"],
  ["Studio Kreatif Agency", "agensi digital"],
  ["Pesta Rasa Organizer", "event organizer"],
  ["Toko Anugerah", "toko retail"],
  ["Laundry Bersih Cepat", "laundry kiloan"],
  ["Bimbel Cendekia", "bimbingan belajar"],
  ["Interior Rumah Kita", "jasa interior"],
  ["Servis AC Sejuk", "jasa servis AC"],
];

function draftFor(name: string, category: string): string {
  const input: ConsultantEngineInput = {
    businessName: name,
    category,
    city: "Bandung",
    website: null,
    phone: "081234567890",
    rating: 4.6,
    reviewCount: 180,
  };
  const snapshot = buildSalesContextSnapshot(buildConsultantAnalysis(input));
  return consultantDraftText(buildConsultantDraft(name, snapshot));
}

describe("consultative outreach draft", () => {
  it.each(INDUSTRIES)("builds a grounded draft for %s", (name, category) => {
    const text = draftFor(name, category);
    expect(text).toContain(name);
    // A hypothesis is asked, never asserted as the customer's problem.
    expect(text.toLowerCase()).not.toContain("masalah anda adalah");
    expect(text.toLowerCase()).not.toContain("anda pasti");
    expect(text).toMatch(/\?/);
    // No hardcoded F&B vocabulary leaking into other industries.
    if (!/resto|kafe|kuliner/i.test(category)) {
      expect(text.toLowerCase()).not.toContain("menu digital");
    }
  });

  it("falls back to safe wording without facts or questions", () => {
    const draft = buildConsultantDraft("Bisnis Tanpa Data", {
      verifiedFacts: [],
      validationQuestions: [],
      recommendedSolution: { package: "Landing Page", features: [] },
      salesAngle: { headline: "", talkingPoints: [], openingHook: "" },
    });
    const text = consultantDraftText(draft);
    expect(text).toContain("Bisnis Tanpa Data");
    expect(text).toContain("Landing Page");
    expect(text).toMatch(/\?/);
  });
});
