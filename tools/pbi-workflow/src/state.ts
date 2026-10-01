export const pbiStates = [
  "refinement",
  "awaiting-contract-approval",
  "planned",
  "implementation",
  "documentation-review",
  "qa",
  "demo",
  "ready-for-pr",
  "pr-open",
  "done",
  "blocked",
] as const;

export type PbiState = (typeof pbiStates)[number];

export const taskStates = [
  "ready",
  "in-progress",
  "pr-open",
  "merged",
  "blocked",
  "stalled",
] as const;

export type TaskState = (typeof taskStates)[number];

export type GateName =
  | "contract"
  | "documentation"
  | "qa"
  | "demo-preparation"
  | "demo-approval";

export type GateVerdict = "pass" | "fail" | "not-applicable";
export type PullRequestState = "draft" | "open" | "merged" | "closed";

export interface Pbi {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly revision: string;
  readonly state: PbiState;
}

export interface Slice {
  readonly id: string;
  readonly issueNumber: number;
  readonly title: string;
  readonly blockedBy: readonly string[];
  readonly state: TaskState;
}

export interface Claim {
  readonly runId: string;
  readonly agent: string;
  readonly branch: string;
  readonly startedAt: string;
  readonly leaseExpiresAt: string;
}

export interface GateRecord {
  readonly gate: GateName;
  readonly headSha: string;
  readonly runId: string;
  readonly verdict: GateVerdict;
  readonly evidence: readonly string[];
  readonly findings: readonly string[];
}

const pbiTransitions = {
  refinement: ["awaiting-contract-approval", "blocked"],
  "awaiting-contract-approval": ["refinement", "planned", "blocked"],
  planned: ["refinement", "implementation", "blocked"],
  implementation: ["documentation-review", "blocked"],
  "documentation-review": ["implementation", "qa", "blocked"],
  qa: ["implementation", "demo", "blocked"],
  demo: ["implementation", "ready-for-pr", "blocked"],
  "ready-for-pr": ["implementation", "pr-open", "blocked"],
  "pr-open": ["done", "blocked"],
  done: [],
  blocked: [
    "refinement",
    "awaiting-contract-approval",
    "planned",
    "implementation",
    "documentation-review",
    "qa",
    "demo",
    "ready-for-pr",
    "pr-open",
  ],
} satisfies Record<PbiState, readonly PbiState[]>;

const taskTransitions = {
  ready: ["in-progress", "blocked"],
  "in-progress": ["pr-open", "blocked", "stalled"],
  "pr-open": ["in-progress", "merged", "blocked", "stalled"],
  merged: [],
  blocked: ["ready", "in-progress"],
  stalled: ["ready", "in-progress", "blocked"],
} satisfies Record<TaskState, readonly TaskState[]>;

export class InvalidStateTransitionError extends Error {
  constructor(
    readonly entity: "PBI" | "task",
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid ${entity} state transition: ${from} -> ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

export class StateLabelConflictError extends Error {
  constructor(readonly labels: readonly string[]) {
    super(`Conflicting state labels: ${labels.join(", ")}`);
    this.name = "StateLabelConflictError";
  }
}

export function canTransitionPbi(from: PbiState, to: PbiState): boolean {
  const allowed: readonly PbiState[] = pbiTransitions[from];
  return from === to || allowed.includes(to);
}

export function canTransitionTask(from: TaskState, to: TaskState): boolean {
  const allowed: readonly TaskState[] = taskTransitions[from];
  return from === to || allowed.includes(to);
}

export function assertPbiTransition(from: PbiState, to: PbiState): void {
  if (!canTransitionPbi(from, to)) {
    throw new InvalidStateTransitionError("PBI", from, to);
  }
}

export function assertTaskTransition(from: TaskState, to: TaskState): void {
  if (!canTransitionTask(from, to)) {
    throw new InvalidStateTransitionError("task", from, to);
  }
}

export function resolveExclusiveState<State extends string>(
  labels: readonly string[],
  labelByState: Readonly<Record<State, string>>,
): State | undefined {
  const entries = Object.entries(labelByState) as [State, string][];
  const matches = entries.filter(([, label]) => labels.includes(label));

  if (matches.length > 1) {
    throw new StateLabelConflictError(matches.map(([, label]) => label));
  }

  return matches[0]?.[0];
}