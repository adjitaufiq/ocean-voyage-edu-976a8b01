import { describe, expect, it } from "vitest";

import { classifyReviewRisk, resolveCanonicalChain, summarizeSignals } from "./entity-review";

describe("classifyReviewRisk", () => {
  it("shared contact is always high risk", () => {
    expect(classifyReviewRisk("verified_contact", 90)).toBe("high");
  });
  it("fuzzy depends on score", () => {
    expect(classifyReviewRisk("fuzzy", 75)).toBe("high");
    expect(classifyReviewRisk("fuzzy", 85)).toBe("medium");
  });
  it("identity suggestion at 95+ is low", () => {
    expect(classifyReviewRisk("business_identity", 97)).toBe("low");
    expect(classifyReviewRisk("business_identity", 91)).toBe("medium");
  });
});

describe("summarizeSignals", () => {
  it("lists score parts", () => {
    expect(summarizeSignals("fuzzy", { scores: { name: 0.8, city: 1, address: 0, category: 0 } })).toEqual([
      "Nama 80%",
      "Kota 100%",
    ]);
  });
  it("lists shared contact", () => {
    expect(summarizeSignals("verified_contact", { phone: "62812" })).toEqual(["Telepon sama: 62812"]);
  });
});

describe("resolveCanonicalChain", () => {
  it("follows replacements", () => {
    const m = new Map<string, string | null>([["a", "b"], ["b", "c"], ["c", null]]);
    expect(resolveCanonicalChain(m, "a")).toBe("c");
  });
  it("stops on cycles", () => {
    const m = new Map<string, string | null>([["a", "b"], ["b", "a"]]);
    expect(resolveCanonicalChain(m, "a")).toBe("b");
  });
  it("returns itself when active", () => {
    expect(resolveCanonicalChain(new Map(), "x")).toBe("x");
  });
});
