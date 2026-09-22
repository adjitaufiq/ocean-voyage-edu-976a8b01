import { describe, expect, it } from "vitest";

import {
  matchEntity,
  normalizeDomain,
  normalizeName,
  normalizePhone,
  similarity,
  type EntityCandidateRow,
  type EntitySignals,
} from "./entity-resolution";

function signals(partial: Partial<EntitySignals>): EntitySignals {
  return {
    name: "",
    normalizedName: null,
    city: null,
    province: null,
    address: null,
    category: null,
    website: null,
    websiteDomain: null,
    googlePlaceId: null,
    phone: null,
    whatsapp: null,
    email: null,
    ...partial,
  };
}

function entity(partial: Partial<EntityCandidateRow> & { id: string }): EntityCandidateRow {
  return { ...signals({}), ...partial };
}

describe("normalizers", () => {
  it("strips legal words from names", () => {
    expect(normalizeName("PT Kartika Sari Indonesia")).toBe("kartika sari");
  });

  it("normalizes domains", () => {
    expect(normalizeDomain("https://WWW.Toko.co.id/menu/")).toBe("toko.co.id");
    expect(normalizeDomain("not-a-domain")).toBeNull();
  });

  it("normalizes Indonesian phones", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizePhone("123")).toBeNull();
  });

  it("scores similarity", () => {
    expect(similarity("kartika sari", "kartika sari")).toBe(1);
    expect(similarity("kartika sari", "holland bakery")).toBeLessThan(0.3);
  });
});

describe("matchEntity", () => {
  it("level 1: place id auto matches", () => {
    const result = matchEntity(
      signals({ name: "A", googlePlaceId: "p1" }),
      [entity({ id: "e1", name: "Other", googlePlaceId: "p1" })],
    );
    expect(result).toMatchObject({ entityId: "e1", method: "google_place_id", status: "auto_matched" });
  });

  it("level 2: website domain auto matches", () => {
    const result = matchEntity(
      signals({ name: "A", website: "http://www.toko.co.id/" }),
      [entity({ id: "e2", name: "B", websiteDomain: "toko.co.id" })],
    );
    expect(result.method).toBe("website_domain");
    expect(result.entityId).toBe("e2");
  });

  it("level 3: shared phone auto matches", () => {
    const result = matchEntity(
      signals({ name: "A", phone: "0812 3456 7890" }),
      [entity({ id: "e3", name: "B", whatsapp: "+6281234567890" })],
    );
    expect(result.method).toBe("verified_contact");
  });

  it("level 4: same name + city suggests", () => {
    const result = matchEntity(
      signals({ name: "Kartika Sari", city: "Bandung", address: "Jl Dago 1" }),
      [entity({ id: "e4", name: "Kartika Sari", city: "Bandung", address: "Jl Dago 1" })],
    );
    expect(result.status).toBe("suggested");
    expect(result.entityId).toBe("e4");
  });

  it("level 5: similar name needs review, never auto merge", () => {
    const result = matchEntity(
      signals({ name: "Kartika Sari Bakery", city: "Bandung" }),
      [entity({ id: "e5", name: "Kartika Sari", city: "Bandung" })],
    );
    expect(result.status).toBe("review_required");
  });

  it("no pool: creates a new entity", () => {
    const result = matchEntity(signals({ name: "Brand Baru" }), []);
    expect(result).toMatchObject({ entityId: null, method: "new_entity", status: "created" });
  });
});
