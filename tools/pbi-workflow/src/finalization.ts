import type { PullRequestRecord } from "./pull-requests.js";
import type { GateName, GateRecord } from "./state.js";

export interface PbiFinalizationPlan {
  readonly completed: boolean;
  readonly tasksDocument: string;
  readonly blockers: readonly string[];
}

const requiredGates = ["documentation", "qa", "demo-preparation", "demo-approval"] as const;

function gateBlocker(
  gate: (typeof requiredGates)[number],
  records: readonly GateRecord[],
  currentHeadSha: string,
): string | undefined {
  const current = records.filter((record) => record.gate === gate && record.headSha === currentHeadSha);
  if (current.length === 0) return `Missing current-SHA ${gate} gate`;
  if (current.length > 1) return `Multiple current-SHA ${gate} gates require resolution`;

  const verdict = current[0]?.verdict;
  const accepted = gate === "demo-preparation"
    ? verdict === "pass" || verdict === "not-applicable"
    : verdict === "pass";
  return accepted ? undefined : `Current-SHA ${gate} gate has verdict ${verdict}`;
}

export function planPbiFinalization(
  tasksDocument: string,
  taskPullRequests: readonly PullRequestRecord[],
  gateRecords: readonly GateRecord[],
  currentHeadSha: string,
): PbiFinalizationPlan {
  const blockers: string[] = [];
  if (!/^[0-9a-f]{40}$/u.test(currentHeadSha)) blockers.push(`Invalid PBI head SHA: ${currentHeadSha}`);
  if (taskPullRequests.length === 0) blockers.push("No task pull requests found");
  for (const pullRequest of taskPullRequests) {
    if (pullRequest.state !== "merged") blockers.push(`Task PR #${pullRequest.number} is ${pullRequest.state}`);
  }
  for (const gate of requiredGates) {
    const blocker = gateBlocker(gate, gateRecords, currentHeadSha);
    if (blocker !== undefined) blockers.push(blocker);
  }

  const pendingTasks = tasksDocument.match(/^- \[ \] .+$/gmu) ?? [];
  const completedTasks = tasksDocument.match(/^- \[[xX]\] .+$/gmu) ?? [];
  if (pendingTasks.length + completedTasks.length !== 1) {
    blockers.push("tasks.md must contain exactly one orchestration checkbox");
  }

  if (blockers.length > 0) return { completed: false, tasksDocument, blockers };
  if (pendingTasks.length === 0) return { completed: true, tasksDocument, blockers: [] };
  return {
    completed: true,
    tasksDocument: tasksDocument.replace(/^- \[ \] /mu, "- [x] "),
    blockers: [],
  };
}

export type FinalizationGate = Exclude<GateName, "contract">;