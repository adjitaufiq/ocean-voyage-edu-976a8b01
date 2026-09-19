import { describe, expect, it } from "vitest";

import type { QualificationInput } from "@/lib/admin/qualification";
import {
  prepareSales,
  readyOutreachBlockers,
  recommendApproach,
  selectSalesAsset,
} from "@/lib/admin/sales-prep";

const base: QualificationInput = {
  businessName: "Toko Mebel Jaya",
  category: "Furniture store",
  industry: null,
  address: "Jl. Merdeka 10",
  city: "Bandung",
  province: "Jawa Barat",
  country: "ID",
  latitude: -6.9,
  longitude: 107.6,
  phone: "+628123456789",
  website: null,
  websiteStatus: "missing",
  rating: 4.4,
  reviewCount: 32,
  placeId: "place-1",
  googleMapsUrl: "https://maps.google.com/?cid=1",
  permanentlyClosed: false,
  duplicateStatus: null,
  contactData: {},
  targetCategories: [],
  targetCities: [],
};

const input = (patch: Partial<QualificationInput> = {}): QualificationInput => ({
  ...base,
  ...patch,
});

describe("recommendApproach", () => {
  it("routes food businesses to the QResto opportunity", () => {
    const approach = recommendApproach(input({ category: "Restoran Padang" }));
    expect(approach.category).toBe("fnb_opportunity");
    expect(approach.recommendation).toContain("QResto");
  });

  it("routes a business without a website to website + local SEO", () => {
    const approach = recommendApproach(input());
    expect(approach.category).toBe("website_opportunity");
    expect(approach.recommendation).toContain("Website");
  });

  it("routes a growing business with a website to automation", () => {
    const approach = recommendApproach(
      input({ websiteStatus: "present", website: "https://x.id", reviewCount: 400 }),
    );
    expect(approach.category).toBe("automation_opportunity");
  });
});

describe("selectSalesAsset", () => {
  it("matches the asset to the approach", () => {
    const fnb = input({ category: "Cafe Kopi" });
    expect(selectSalesAsset(fnb, recommendApproach(fnb)).key).toBe("qresto_demo");
    expect(selectSalesAsset(base, recommendApproach(base)).key).toBe("website_portfolio");
    const growing = input({ websiteStatus: "present", website: "https://x.id", reviewCount: 400 });
    expect(selectSalesAsset(growing, recommendApproach(growing)).key).toBe("analytics_demo");
  });
});

describe("prepareSales", () => {
  it("builds a brief and outreach draft grounded in stored facts", () => {
    const prep = prepareSales(base);
    expect(prep.brief.business_summary).toContain("Toko Mebel Jaya");
    expect(prep.brief.business_summary).toContain("Bandung");
    expect(prep.brief.recommended_solution).toBe(prep.approach.recommendation);
    expect(prep.outreach.opening_message).toContain("Toko Mebel Jaya");
    expect(prep.outreach.call_to_action).toContain(prep.asset.label.toLowerCase());
    expect(prep.outreach.value_proposition.length).toBeGreaterThan(20);
  });

  it("does not invent a city when none is stored", () => {
    const prep = prepareSales(input({ city: null }));
    expect(prep.outreach.opening_message).not.toContain("undefined");
    expect(prep.brief.business_summary).not.toContain("di null");
  });
});

describe("readyOutreachBlockers", () => {
  it("blocks when validation has not passed", () => {
    const blockers = readyOutreachBlockers({
      validationStatus: "pending",
      contactData: { phone: { value: "+62812", source: "google_maps" } },
    });
    expect(blockers).toHaveLength(1);
  });

  it("blocks when no sourced contact exists", () => {
    const blockers = readyOutreachBlockers({ validationStatus: "validated", contactData: {} });
    expect(blockers.join(" ")).toContain("kontak");
  });

  it("allows a validated lead with a sourced contact", () => {
    expect(
      readyOutreachBlockers({
        validationStatus: "validated",
        contactData: { phone: { value: "+62812", source: "google_maps" } },
      }),
    ).toHaveLength(0);
  });
});

describe("readyOutreachBlockers stage gates", () => {
  const contactData = { phone: { value: "+62812", source: "google_maps" } };

  it("blocks when QC has not approved the candidate", () => {
    const blockers = readyOutreachBlockers({
      validationStatus: "validated",
      qcStatus: "new",
      hasPreparation: true,
      contactData,
    });
    expect(blockers.join(" ")).toContain("QC");
  });

  it("blocks when no active sales preparation exists", () => {
    const blockers = readyOutreachBlockers({
      validationStatus: "validated",
      qcStatus: "approved",
      hasPreparation: false,
      contactData,
    });
    expect(blockers.join(" ")).toContain("persiapan");
  });

  it("allows a QC approved candidate with preparation and sourced contact", () => {
    expect(
      readyOutreachBlockers({
        validationStatus: "validated",
        qcStatus: "approved",
        hasPreparation: true,
        contactData,
      }),
    ).toHaveLength(0);
  });
});
