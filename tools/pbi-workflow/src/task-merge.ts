import { calculateReadyFrontier } from "./scheduler.js";
import type { SchedulerSlice } from "./scheduler.js";
import type { ReviewCycleDecision } from "./review-cycles.js";

export type Mergeability = "clean" | "behind" | "conflicting" | "unknown";

export interface TaskMergePlan {
  readonly action: "wait" | "update-branch" | "resolve-conflicts" | "enable-squash-auto-merge";
  readonly reason: string;
}

export function planTaskMerge(
  mergeability: Mergeability,
  review: ReviewCycleDecision,
): TaskMergePlan {
  if (review.state !== "ready-for-merge" || !review.enableAutoMerge) {
    return { action: "wait", reason: `Review cycle is ${review.state}` };
  }
  if (mergeability === "behind") {
    return { action: "update-branch", reason: "Task branch must include the current PBI branch" };
  }
  if (mergeability === "conflicting") {
    return { action: "resolve-conflicts", reason: "Task branch conflicts with the current PBI branch" };
  }
  if (mergeability === "unknown") {
    return { action: "wait", reason: "GitHub mergeability is not resolved" };
  }
  return { action: "enable-squash-auto-merge", reason: "Current-SHA reviews and checks passed" };
}

export function newlyReadyAfterMerge(
  slices: readonly SchedulerSlice[],
  mergedSliceId: string,
): readonly SchedulerSlice[] {
  const before = new Set(calculateReadyFrontier(slices).ready.map(({ id }) => id));
  const afterSlices = slices.map((slice) =>
    slice.id === mergedSliceId ? { ...slice, state: "merged" as const } : slice,
  );
  return calculateReadyFrontier(afterSlices).ready.filter(({ id }) => !before.has(id));
}