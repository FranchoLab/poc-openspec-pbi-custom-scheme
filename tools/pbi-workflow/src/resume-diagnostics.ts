import { isClaimStale } from "./claims.js";
import { calculateReadyFrontier } from "./scheduler.js";
import type { PullRequestRecord } from "./pull-requests.js";
import type { SchedulerSlice } from "./scheduler.js";
import type { Claim, GateName, GateRecord } from "./state.js";

export type ResumeNextAction =
  | "reconstruct-task-graph"
  | "resolve-blockers"
  | "supervise-active-claims"
  | "review-task-pull-requests"
  | "schedule-ready-slices"
  | "run-documentation-review"
  | "run-qa"
  | "prepare-demo"
  | "await-demo-approval"
  | "complete-finalization"
  | "await-human-merge";

export interface ClaimedSlice {
  readonly sliceId: string;
  readonly claim: Claim;
}

export interface ResumeDiagnostics {
  readonly activeClaims: readonly ClaimedSlice[];
  readonly staleClaims: readonly ClaimedSlice[];
  readonly openTaskPullRequests: readonly PullRequestRecord[];
  readonly blockers: readonly string[];
  readonly validGates: readonly GateName[];
  readonly nextAction: ResumeNextAction;
}

function hasCurrentGate(
  records: readonly GateRecord[],
  currentHeadSha: string,
  gate: GateName,
): boolean {
  const matching = records.filter((record) => record.headSha === currentHeadSha && record.gate === gate);
  if (matching.length !== 1) return false;
  return gate === "demo-preparation"
    ? matching[0]?.verdict === "pass" || matching[0]?.verdict === "not-applicable"
    : matching[0]?.verdict === "pass";
}

export function buildResumeDiagnostics(input: {
  readonly now: Date;
  readonly currentHeadSha: string;
  readonly slices: readonly SchedulerSlice[];
  readonly claims: readonly ClaimedSlice[];
  readonly taskPullRequests: readonly PullRequestRecord[];
  readonly blockers: readonly string[];
  readonly gateRecords: readonly GateRecord[];
  readonly orchestrationTaskCompleted: boolean;
  readonly finalPullRequestReady: boolean;
}): ResumeDiagnostics {
  const activeClaims = input.claims.filter(({ claim }) => !isClaimStale(claim, input.now));
  const staleClaims = input.claims.filter(({ claim }) => isClaimStale(claim, input.now));
  const openTaskPullRequests = input.taskPullRequests.filter(({ state }) => state === "open");
  const blockers = [
    ...input.blockers,
    ...staleClaims.map(({ sliceId }) => `Slice ${sliceId} has a stale claim requiring recovery`),
  ];
  const gateOrder: readonly GateName[] = ["documentation", "qa", "demo-preparation", "demo-approval"];
  const validGates = gateOrder.filter((gate) => hasCurrentGate(input.gateRecords, input.currentHeadSha, gate));

  let nextAction: ResumeNextAction;
  if (input.slices.length === 0) nextAction = "reconstruct-task-graph";
  else if (blockers.length > 0) nextAction = "resolve-blockers";
  else if (activeClaims.length > 0) nextAction = "supervise-active-claims";
  else if (openTaskPullRequests.length > 0) nextAction = "review-task-pull-requests";
  else if (input.slices.some(({ state }) => state !== "merged")) {
    nextAction = calculateReadyFrontier(input.slices).ready.length > 0
      ? "schedule-ready-slices"
      : "resolve-blockers";
  } else if (!validGates.includes("documentation")) nextAction = "run-documentation-review";
  else if (!validGates.includes("qa")) nextAction = "run-qa";
  else if (!validGates.includes("demo-preparation")) nextAction = "prepare-demo";
  else if (!validGates.includes("demo-approval")) nextAction = "await-demo-approval";
  else if (!input.orchestrationTaskCompleted || !input.finalPullRequestReady) nextAction = "complete-finalization";
  else nextAction = "await-human-merge";

  return { activeClaims, staleClaims, openTaskPullRequests, blockers, validGates, nextAction };
}