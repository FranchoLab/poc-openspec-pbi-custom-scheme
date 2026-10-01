import { renderManagedBlock } from "./markers.js";
import type { ReviewResult } from "./reviews.js";

export interface CheckResult {
  readonly name: string;
  readonly status: "pending" | "success" | "failure";
  readonly detailsUrl?: string;
}

export interface ReviewCycleDecision {
  readonly state: "waiting" | "fix-required" | "ready-for-merge" | "blocked";
  readonly cycle: number;
  readonly nextCycle?: number;
  readonly enableAutoMerge: boolean;
  readonly reasons: readonly string[];
}

export function renderReviewPublication(
  pullRequestNumber: number,
  cycle: number,
  standards: ReviewResult,
  compliance: ReviewResult,
): string {
  if (standards.headSha !== compliance.headSha) throw new Error("Review results must target the same head SHA");
  const id = `pr-${pullRequestNumber}-cycle-${cycle}`;
  return renderManagedBlock("review", id, JSON.stringify({ pullRequestNumber, cycle, headSha: standards.headSha, standards, compliance }));
}

export function evaluateReviewCycle(input: {
  readonly headSha: string;
  readonly cycle: number;
  readonly maxCycles?: number;
  readonly standards: ReviewResult;
  readonly compliance: ReviewResult;
  readonly requiredChecks: readonly string[];
  readonly checks: readonly CheckResult[];
}): ReviewCycleDecision {
  const maxCycles = input.maxCycles ?? 3;
  if (!Number.isInteger(input.cycle) || input.cycle < 1 || input.cycle > maxCycles) throw new Error(`Invalid review cycle ${input.cycle}`);
  if (input.standards.headSha !== input.headSha || input.compliance.headSha !== input.headSha) {
    return { state: "waiting", cycle: input.cycle, enableAutoMerge: false, reasons: ["Reviews are stale for the current PR head"] };
  }
  const checks = new Map(input.checks.map((check) => [check.name, check]));
  const pending = input.requiredChecks.filter((name) => checks.get(name)?.status === "pending" || !checks.has(name));
  if (pending.length > 0) {
    return { state: "waiting", cycle: input.cycle, enableAutoMerge: false, reasons: pending.map((name) => `Required check is pending or missing: ${name}`) };
  }
  const reasons = [
    ...(input.standards.verdict === "fail" ? ["Standards review failed"] : []),
    ...(input.compliance.verdict === "fail" ? ["Acceptance/spec review failed"] : []),
    ...input.requiredChecks.filter((name) => checks.get(name)?.status === "failure").map((name) => `Required check failed: ${name}`),
  ];
  if (reasons.length === 0) {
    return { state: "ready-for-merge", cycle: input.cycle, enableAutoMerge: true, reasons: [] };
  }
  if (input.cycle >= maxCycles) {
    return { state: "blocked", cycle: input.cycle, enableAutoMerge: false, reasons };
  }
  return { state: "fix-required", cycle: input.cycle, nextCycle: input.cycle + 1, enableAutoMerge: false, reasons };
}