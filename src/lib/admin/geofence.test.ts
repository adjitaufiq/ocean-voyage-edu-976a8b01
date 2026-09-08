import { describe, expect, it } from "vitest";

import {
  buildScopedSearchQuery,
  crossReferenceSocial,
  phoneGeoVerdict,
  phonesComparable,
} from "./geofence";
import { computeTrust } from "./trust";

describe("phone geofencing", () => {
  it("accepts +62 and local trunk formats", () => {
    expect(phoneGeoVerdict("+62 812 3456 7890").local).toBe(true);
    expect(phoneGeoVerdict("0812-3456-7890").local).toBe(true);
    expect(phoneGeoVerdict("81234567890").local).toBe(true);
  });

  it("rejects foreign country codes", () => {
    expect(phoneGeoVerdict("+961 71 234 567").foreign).toBe(true);
    expect(phoneGeoVerdict("+1 415 555 0123").foreign).toBe(true);
  });

  it("never compares numbers across countries", () => {
    expect(phonesComparable("+62 812 3456 7890", "0812 3456 7890")).toBe(true);
    expect(phonesComparable("+62 812 3456 7890", "+961 71 234 567")).toBe(false);
  });

  it("penalises trust by 50 for a foreign phone", () => {
    const base = computeTrust({ fitScore: 80, validationScore: 80, qualityScore: 80, externalScore: 80 });
    const foreign = computeTrust({
      fitScore: 80,
      validationScore: 80,
      qualityScore: 80,
      externalScore: 80,
      phone: "+961 71 234 567",
    });
    expect(base.trust_score - foreign.trust_score).toBe(50);
  });
});

describe("social cross-reference", () => {
  it("verifies when the bio link matches the candidate domain", () => {
    const verdict = crossReferenceSocial({
      candidateWebsite: "https://kopinako.co.id",
      bioLink: "kopinako.co.id",
      bio: "Kopi Nako Jakarta, gratis ongkir",
    });
    expect(verdict.status).toBe("verified");
  });

  it("flags a mismatching bio link with a 40 point penalty", () => {
    const verdict = crossReferenceSocial({
      candidateWebsite: "https://kopinako.co.id",
      bioLink: "https://kopinako.com.lb",
      bio: "Coffee shop",
    });
    expect(verdict.status).toBe("mismatch_social");
    expect(verdict.penalty).toBe(40);
  });

  it("rejects a foreign bio instantly", () => {
    const verdict = crossReferenceSocial({ bio: "Best coffee in Beirut, Lebanon" });
    expect(verdict.status).toBe("rejected_foreign_entity");
  });

  it("rejects a bio phone with a foreign country code", () => {
    const verdict = crossReferenceSocial({ bio: "Order now +961 71 234 567" });
    expect(verdict.status).toBe("rejected_foreign_entity");
  });
});

describe("scoped search query", () => {
  it("never emits a bare business name", () => {
    expect(buildScopedSearchQuery({ businessName: "Kopi Nako", city: "Jakarta" })).toBe(
      '"Kopi Nako" "Jakarta" "Indonesia"',
    );
  });
});
