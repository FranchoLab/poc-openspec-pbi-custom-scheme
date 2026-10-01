import { describe, expect, it } from "vitest";

import { newlyReadyAfterMerge, planTaskMerge } from "../src/task-merge.js";
import type { ReviewCycleDecision } from "../src/review-cycles.js";
import type { SchedulerSlice } from "../src/scheduler.js";

const ready: ReviewCycleDecision = { state: "ready-for-merge", cycle: 1, enableAutoMerge: true, reasons: [] };
const slice = (id: string, blockedBy: string[], state: SchedulerSlice["state"], blockReason?: SchedulerSlice["blockReason"]): SchedulerSlice => ({ id, issueNumber: Number(id.slice(1)) + 100, title: id, blockedBy, state, ...(blockReason === undefined ? {} : { blockReason }) });

describe("task merge", () => {
  it("updates or resolves the branch before enabling squash auto-merge", () => {
    expect(planTaskMerge("behind", ready).action).toBe("update-branch");
    expect(planTaskMerge("conflicting", ready).action).toBe("resolve-conflicts");
    expect(planTaskMerge("clean", ready).action).toBe("enable-squash-auto-merge");
  });

  it("never enables merge without a current passing review decision", () => {
    const blocked: ReviewCycleDecision = { state: "blocked", cycle: 3, enableAutoMerge: false, reasons: ["failure"] };
    expect(planTaskMerge("clean", blocked).action).toBe("wait");
    expect(planTaskMerge("unknown", ready).action).toBe("wait");
  });

  it("unlocks only the frontier newly released by the merged slice", () => {
    const graph = [
      slice("T01", [], "in-progress"),
      slice("T02", ["T01"], "blocked", "dependencies"),
      slice("T03", [], "ready"),
      slice("T04", ["T02"], "blocked", "dependencies"),
    ];
    expect(newlyReadyAfterMerge(graph, "T01").map(({ id }) => id)).toEqual(["T02"]);
  });
});