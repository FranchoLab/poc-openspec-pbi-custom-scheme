import { describe, expect, it } from "vitest";

import { planPbiFinalization } from "../src/finalization.js";
import type { PullRequestRecord } from "../src/pull-requests.js";
import type { GateRecord } from "../src/state.js";

const headSha = "a".repeat(40);
const tasksDocument = "# PBI Orchestration\n\n- [ ] 1.1 Run the PBI orchestrator for https://github.com/acme/shop/issues/42\n";
const taskPullRequest: PullRequestRecord = {
  number: 101,
  url: "https://github.com/acme/shop/pull/101",
  title: "Deliver slice",
  body: "task",
  headBranch: "task/100-deliver-slice",
  baseBranch: "feature/pbi-42-release-notes",
  draft: false,
  state: "merged",
};
const gate = (
  name: GateRecord["gate"],
  verdict: GateRecord["verdict"] = "pass",
  sha = headSha,
): GateRecord => ({
  gate: name,
  headSha: sha,
  runId: "00000000-0000-4000-8000-000000000001",
  verdict,
  evidence: ["evidence"],
  findings: [],
});
const passingGates = [
  gate("documentation"),
  gate("qa"),
  gate("demo-preparation"),
  gate("demo-approval"),
];

describe("PBI finalization", () => {
  it("leaves tasks.md pending and identifies an unmerged task PR", () => {
    const result = planPbiFinalization(
      tasksDocument,
      [{ ...taskPullRequest, state: "open" }],
      passingGates,
      headSha,
    );

    expect(result).toEqual({
      completed: false,
      tasksDocument,
      blockers: ["Task PR #101 is open"],
    });
  });

  it("rejects missing, stale, failed, and ambiguous current-SHA gates", () => {
    const staleSha = "b".repeat(40);
    const result = planPbiFinalization(tasksDocument, [taskPullRequest], [
      gate("documentation", "pass", staleSha),
      gate("qa", "fail"),
      gate("demo-preparation"),
      gate("demo-preparation"),
    ], headSha);

    expect(result.tasksDocument).toBe(tasksDocument);
    expect(result.blockers).toEqual([
      "Missing current-SHA documentation gate",
      "Current-SHA qa gate has verdict fail",
      "Multiple current-SHA demo-preparation gates require resolution",
      "Missing current-SHA demo-approval gate",
    ]);
  });

  it("accepts a human-approved non-applicable demo and completes only the checkbox", () => {
    const result = planPbiFinalization(tasksDocument, [taskPullRequest], [
      gate("documentation"),
      gate("qa"),
      gate("demo-preparation", "not-applicable"),
      gate("demo-approval"),
    ], headSha);

    expect(result.completed).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.tasksDocument).toBe(tasksDocument.replace("- [ ]", "- [x]"));
  });

  it("is idempotent after successful completion", () => {
    const completedDocument = tasksDocument.replace("- [ ]", "- [x]");
    expect(planPbiFinalization(completedDocument, [taskPullRequest], passingGates, headSha))
      .toEqual({ completed: true, tasksDocument: completedDocument, blockers: [] });
  });
});