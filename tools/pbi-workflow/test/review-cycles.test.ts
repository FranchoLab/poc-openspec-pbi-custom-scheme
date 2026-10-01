import { describe, expect, it } from "vitest";

import { evaluateReviewCycle, renderReviewPublication } from "../src/review-cycles.js";
import type { ReviewResult } from "../src/reviews.js";

const sha = "a".repeat(40);
const result = (review: ReviewResult["review"], verdict: ReviewResult["verdict"]): ReviewResult => ({
  reviewer: "pbi-reviewer",
  headSha: sha,
  review,
  verdict,
  findings: verdict === "fail" ? [{ id: "F01", severity: "blocking", category: review === "standards" ? "standards" : "acceptance", path: "src/file.ts", message: "Failure", recommendation: "Fix it" }] : [],
  evidence: ["diff"],
});

describe("review cycles", () => {
  it("publishes both current-SHA reviews in a managed marker", () => {
    const publication = renderReviewPublication(12, 1, result("standards", "pass"), result("acceptance-spec", "pass"));
    expect(publication).toContain("pbi-workflow:v1:review:pr-12-cycle-1:start");
    expect(publication).toContain(sha);
  });

  it("enables auto-merge only when reviews and required checks pass", () => {
    expect(evaluateReviewCycle({ headSha: sha, cycle: 1, standards: result("standards", "pass"), compliance: result("acceptance-spec", "pass"), requiredChecks: ["ci"], checks: [{ name: "ci", status: "success" }] }))
      .toEqual({ state: "ready-for-merge", cycle: 1, enableAutoMerge: true, reasons: [] });
  });

  it("requests fixes on the same PR before the maximum cycle", () => {
    expect(evaluateReviewCycle({ headSha: sha, cycle: 2, standards: result("standards", "fail"), compliance: result("acceptance-spec", "pass"), requiredChecks: [], checks: [] }))
      .toMatchObject({ state: "fix-required", cycle: 2, nextCycle: 3, enableAutoMerge: false });
  });

  it("blocks persistent failure after three cycles without auto-merge", () => {
    expect(evaluateReviewCycle({ headSha: sha, cycle: 3, standards: result("standards", "pass"), compliance: result("acceptance-spec", "fail"), requiredChecks: ["ci"], checks: [{ name: "ci", status: "failure" }] }))
      .toMatchObject({ state: "blocked", cycle: 3, enableAutoMerge: false });
  });

  it("waits for stale reviews or missing checks without consuming a cycle", () => {
    const stale = { ...result("standards", "pass"), headSha: "b".repeat(40) };
    expect(evaluateReviewCycle({ headSha: sha, cycle: 1, standards: stale, compliance: result("acceptance-spec", "pass"), requiredChecks: [], checks: [] }).state).toBe("waiting");
    expect(evaluateReviewCycle({ headSha: sha, cycle: 1, standards: result("standards", "pass"), compliance: result("acceptance-spec", "pass"), requiredChecks: ["ci"], checks: [] }).state).toBe("waiting");
  });
});