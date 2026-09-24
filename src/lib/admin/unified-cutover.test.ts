import { describe, expect, it } from "vitest";

import { decisionFromAnalysis, parseUnifiedMode, unifiedReadyBlockers } from "./unified-cutover";

describe("unified cutover", () => {
  it("defaults unknown mode to off (safe rollback)", () => {
    expect(parseUnifiedMode(undefined)).toBe("off");
    expect(parseUnifiedMode("running")).toBe("off");
    expect(parseUnifiedMode("on")).toBe("on");
  });

  it("blocks without entity or analysis", () => {
    expect(unifiedReadyBlockers({ entityId: null, analysis: null, preparation: null })).toEqual(["no_entity"]);
    expect(unifiedReadyBlockers({ entityId: "e", analysis: null, preparation: null })).toEqual(["no_active_analysis"]);
  });

  it("blocks stale analysis and version mismatch", () => {
    const blockers = unifiedReadyBlockers({
      entityId: "e",
      analysis: { id: "a2", version: 2, stale: true },
      preparation: { analysisId: "a1", analysisVersion: 1 },
    });
    expect(blockers).toEqual(["analysis_stale", "version_mismatch"]);
  });

  it("passes when preparation uses the current analysis", () => {
    expect(
      unifiedReadyBlockers({
        entityId: "e",
        analysis: { id: "a2", version: 2, stale: false },
        preparation: { analysisId: "a2", analysisVersion: 2 },
      }),
    ).toEqual([]);
  });

  it("maps analysis without inventing a diagnosis; hypotheses stay marked", () => {
    const d = decisionFromAnalysis({
      problem_hypotheses: [{ statement: "Jadwal pasien masih manual" }],
      confirmed_problems: [],
      core_solution: { summary: "Sistem booking online" },
      recommended_features: [{ label: "Booking" }, { label: "Pengingat" }],
      recommended_package: { name: "Growth" },
    });
    expect(d.problem).toMatch(/^Dugaan \(belum dikonfirmasi\)/);
    expect(d.solution).toBe("Sistem booking online");
    expect(d.features).toEqual(["Booking", "Pengingat"]);
    expect(d.packageName).toBe("Growth");
  });
});
