import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      throw new Error("db down");
    },
  },
}));

import { buildTraceRow, recordDecisionTrace, recordDecisionTraces } from "./decision-trace.server";

describe("decision trace", () => {
  it("builds a complete row", () => {
    const row = buildTraceRow(
      {
        legacyType: "consultation",
        legacyId: "L1",
        module: "proposal",
        decisionType: "proposal_recommendation",
        decision: { recommended_package: "Growth" },
        analysisVersion: 3,
        evidence: { x: 1 },
        confidence: 80,
        actorKind: "user",
        actorId: "U1",
      },
      "E1",
    );
    expect(row).toMatchObject({
      business_entity_id: "E1",
      legacy_id: "L1",
      source_module: "proposal",
      decision_type: "proposal_recommendation",
      analysis_version: 3,
      confidence: 80,
      actor_kind: "user",
    });
  });

  it("drops non-finite confidence and defaults actor to system", () => {
    const row = buildTraceRow({ module: "m", decisionType: "d", decision: {}, confidence: NaN }, null);
    expect(row.confidence).toBeNull();
    expect(row.actor_kind).toBe("system");
    // evidence_source is NOT NULL in the table — never send null.
    expect(row.evidence_source).toEqual([]);
  });

  it("never throws when the database fails", async () => {
    await expect(
      recordDecisionTrace({ legacyType: "prospect_candidate", legacyId: "C1", module: "m", decisionType: "d", decision: {} }),
    ).resolves.toBeUndefined();
    await expect(recordDecisionTraces([])).resolves.toBeUndefined();
  });
});
