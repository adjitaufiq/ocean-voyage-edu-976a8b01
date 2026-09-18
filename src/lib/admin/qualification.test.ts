import { describe, expect, it } from "vitest";

import {
  analyzeDigitalGap,
  qualifyCandidate,
  validateCandidate,
  type QualificationInput,
} from "@/lib/admin/qualification";

const base: QualificationInput = {
  businessName: "Cafe ABC",
  category: "Kafe",
  address: "Jl. Merdeka 10",
  city: "Bandung",
  province: "Jawa Barat",
  country: "Indonesia",
  phone: "0812345678",
  website: null,
  websiteStatus: "missing",
  rating: 4.6,
  reviewCount: 520,
  placeId: "place-1",
  googleMapsUrl: "https://maps.google.com/?cid=1",
  permanentlyClosed: false,
};

describe("business validation", () => {
  it("validates a complete Indonesian business", () => {
    const result = validateCandidate(base);
    expect(result.status).toBe("validated");
    expect(result.checks).toHaveLength(7);
  });

  it("rejects a permanently closed business", () => {
    const result = validateCandidate({ ...base, permanentlyClosed: true });
    expect(result.status).toBe("rejected");
    expect(result.reason).toContain("tutup permanen");
  });

  it("rejects a foreign phone number", () => {
    const result = validateCandidate({ ...base, phone: "+61 2 8123 4567" });
    expect(result.status).toBe("rejected");
  });

  it("rejects a candidate already flagged duplicate", () => {
    expect(validateCandidate({ ...base, duplicateStatus: "duplicate" }).status).toBe("rejected");
  });

  it("only blocks on category when the campaign sets targets", () => {
    expect(validateCandidate({ ...base, targetCategories: ["bengkel"] }).status).toBe("rejected");
    expect(validateCandidate({ ...base, targetCategories: [] }).status).toBe("validated");
  });
});

describe("digital gap", () => {
  it("flags a missing website as an opportunity", () => {
    const gap = analyzeDigitalGap(base);
    expect(gap.website_gap).toContain("Belum memiliki website");
    expect(gap.business_opportunity).toContain("QResto");
  });

  it("flags a weak website", () => {
    const gap = analyzeDigitalGap({
      ...base,
      website: "https://linktr.ee/cafeabc",
      websiteStatus: "present",
    });
    expect(gap.website_gap).toContain("belum optimal");
  });
});

describe("qualification", () => {
  it("marks a busy website-less business as a hot lead", () => {
    const result = qualifyCandidate(base);
    expect(result.label).toBe("HOT LEAD");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.salesPriority).toBe("high");
    expect(result.leadReason).toContain("ulasan");
    expect(result.painSignal).toContain("marketplace");
  });

  it("zeroes the score for a rejected candidate", () => {
    const result = qualifyCandidate({ ...base, permanentlyClosed: true });
    expect(result.score).toBe(0);
    expect(result.label).toBe("COLD LEAD");
  });
});
