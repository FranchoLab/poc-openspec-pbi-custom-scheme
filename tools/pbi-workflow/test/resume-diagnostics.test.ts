import { describe, expect, it } from "vitest";

import { createClaim } from "../src/claims.js";
import { buildResumeDiagnostics } from "../src/resume-diagnostics.js";
import type { ClaimedSlice, ResumeNextAction } from "../src/resume-diagnostics.js";
import type { PullRequestRecord } from "../src/pull-requests.js";
import type { SchedulerSlice } from "../src/scheduler.js";
import type { GateRecord } from "../src/state.js";

const now = new Date("2026-10-01T12:00:00Z");
const headSha = "a".repeat(40);
const mergedSlice: SchedulerSlice = { id: "T01", issueNumber: 101, title: "Slice", blockedBy: [], state: "merged" };
const readySlice: SchedulerSlice = { ...mergedSlice, state: "ready" };
const taskPullRequest: PullRequestRecord = {
  number: 201,
  url: "https://github.com/acme/shop/pull/201",
  title: "Slice",
  body: "task",
  headBranch: "task/101-slice",
  baseBranch: "feature/pbi-42-release-notes",
  draft: false,
  state: "open",
};
const gate = (name: GateRecord["gate"], sha = headSha): GateRecord => ({
  gate: name,
  headSha: sha,
  runId: "00000000-0000-4000-8000-000000000001",
  verdict: "pass",
  evidence: ["evidence"],
  findings: [],
});
const allGates = [gate("documentation"), gate("qa"), gate("demo-preparation"), gate("demo-approval")];
const base = {
  now,
  currentHeadSha: headSha,
  slices: [mergedSlice],
  claims: [] as ClaimedSlice[],
  taskPullRequests: [] as PullRequestRecord[],
  blockers: [] as string[],
  gateRecords: allGates,
  orchestrationTaskCompleted: true,
  finalPullRequestReady: true,
};

describe("resume diagnostics", () => {
  it.each([
    { name: "missing graph", overrides: { slices: [] }, action: "reconstruct-task-graph" },
    { name: "blocker", overrides: { blockers: ["Workflow conflict"] }, action: "resolve-blockers" },
    {
      name: "active claim",
      overrides: { claims: [{ sliceId: "T01", claim: createClaim("00000000-0000-4000-8000-000000000001", "agent", "task/101", now) }] },
      action: "supervise-active-claims",
    },
    { name: "open task PR", overrides: { taskPullRequests: [taskPullRequest] }, action: "review-task-pull-requests" },
    { name: "ready slice", overrides: { slices: [readySlice] }, action: "schedule-ready-slices" },
    { name: "documentation", overrides: { gateRecords: [] }, action: "run-documentation-review" },
    { name: "QA", overrides: { gateRecords: [gate("documentation")] }, action: "run-qa" },
    { name: "demo", overrides: { gateRecords: [gate("documentation"), gate("qa")] }, action: "prepare-demo" },
    { name: "approval", overrides: { gateRecords: allGates.slice(0, 3) }, action: "await-demo-approval" },
    { name: "finalization", overrides: { orchestrationTaskCompleted: false }, action: "complete-finalization" },
    { name: "human merge", overrides: {}, action: "await-human-merge" },
  ] satisfies { name: string; overrides: Partial<typeof base>; action: ResumeNextAction }[])(
    "continues a fresh session from $name state",
    ({ overrides, action }) => {
      expect(buildResumeDiagnostics({ ...base, ...overrides }).nextAction).toBe(action);
    },
  );

  it("surfaces stale claims as recovery blockers and ignores stale-SHA gates", () => {
    const staleClaim = createClaim("00000000-0000-4000-8000-000000000002", "agent", "task/101", new Date("2026-10-01T08:00:00Z"), 5);
    const result = buildResumeDiagnostics({
      ...base,
      claims: [{ sliceId: "T01", claim: staleClaim }],
      gateRecords: allGates.map((record) => ({ ...record, headSha: "b".repeat(40) })),
    });

    expect(result.activeClaims).toEqual([]);
    expect(result.staleClaims).toHaveLength(1);
    expect(result.blockers).toEqual(["Slice T01 has a stale claim requiring recovery"]);
    expect(result.validGates).toEqual([]);
    expect(result.nextAction).toBe("resolve-blockers");
  });
});