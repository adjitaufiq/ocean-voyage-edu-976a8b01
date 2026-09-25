import { describe, expect, it } from "vitest";
import { assistantActionDecision, classifyAssistantReply, proposalDecisionDiff } from "./decision-classify";

describe("decision classify", () => {
  it("detects assistant decision kinds", () => {
    const kinds = classifyAssistantReply(
      "Saya sarankan paket Growth. Jika customer bilang terlalu mahal, follow-up besok.",
    );
    expect(kinds).toEqual(expect.arrayContaining(["package_recommendation", "objection_response", "follow_up_strategy"]));
    expect(classifyAssistantReply("Halo, apa kabar?")).toEqual([]);
  });

  it("maps assistant actions", () => {
    expect(assistantActionDecision("create_followup_task")).toBe("follow_up_strategy");
    expect(assistantActionDecision("update_lead_status")).toBe("lead_status");
  });

  it("diffs proposal package and features", () => {
    const d = proposalDecisionDiff(
      { recommended_package: "Starter", core_features: [{ name: "Menu" }], enhancements: [] },
      { recommended_package: "Growth", core_features: [{ name: "Menu" }, { name: "Kasir" }], enhancements: [] },
    );
    expect(d.packageChanged).toBe(true);
    expect(d.featuresAdded).toEqual(["Kasir"]);
    expect(d.featuresChanged).toBe(true);
    const same = proposalDecisionDiff({ recommended_package: "A" }, { recommended_package: "A" });
    expect(same.packageChanged || same.featuresChanged).toBe(false);
  });
});
