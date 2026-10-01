import { parseManagedBlocks, renderManagedBlock } from "./markers.js";

export interface DeliverySlice {
  readonly id: string;
  readonly title: string;
  readonly outcome: string;
  readonly acceptanceCriteria: readonly string[];
  readonly specCoverage: readonly string[];
  readonly blockedBy: readonly string[];
  readonly verification: readonly string[];
  readonly outOfScope: readonly string[];
}

export interface PublishedSliceIssue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly lifecycle: "not-started" | "started" | "merged";
}

export interface TaskGraphGitHub {
  listSubIssues(parentIssue: number): Promise<readonly PublishedSliceIssue[]>;
  createIssue(title: string, body: string, labels: readonly string[]): Promise<number>;
  updateIssue(issueNumber: number, title: string, body: string, labels: readonly string[]): Promise<void>;
  addSubIssue(parentIssue: number, childIssue: number): Promise<void>;
}

export interface TaskGraphPublicationResult {
  readonly created: readonly number[];
  readonly updated: readonly number[];
  readonly unchanged: readonly number[];
}

export class TaskGraphConflictError extends Error {
  constructor(readonly conflicts: readonly string[]) {
    super(`Started delivery slices conflict with the approved contract: ${conflicts.join(", ")}`);
    this.name = "TaskGraphConflictError";
  }
}

function section(title: string, values: readonly string[]): string {
  return [`## ${title}`, ...values.map((value) => `- ${value}`)].join("\n");
}

export function renderSliceIssue(slice: DeliverySlice, parentUrl: string): string {
  const managed = [
    `# ${slice.id}: ${slice.title}`,
    `Parent PBI: ${parentUrl}`,
    "## Outcome",
    slice.outcome,
    section("Acceptance Criteria", slice.acceptanceCriteria),
    section("Spec Coverage", slice.specCoverage),
    section("Blocked By", slice.blockedBy.length === 0 ? ["None"] : slice.blockedBy),
    section("Verification", slice.verification),
    section("Out of Scope", slice.outOfScope),
  ].join("\n\n");
  return renderManagedBlock("slice", slice.id, managed);
}

function sliceId(body: string): string | undefined {
  return parseManagedBlocks(body).find((block) => block.kind === "slice")?.id;
}

function validateSlices(slices: readonly DeliverySlice[]): void {
  const ids = new Set(slices.map(({ id }) => id));
  if (ids.size !== slices.length || [...ids].some((id) => !/^T\d{2,}$/u.test(id))) {
    throw new TaskGraphConflictError(["duplicate or invalid stable slice IDs"]);
  }
  for (const slice of slices) {
    if (slice.blockedBy.some((blocker) => !ids.has(blocker) || blocker === slice.id)) {
      throw new TaskGraphConflictError([`${slice.id} has an unknown or self blocker`]);
    }
    if ([slice.acceptanceCriteria, slice.specCoverage, slice.verification, slice.outOfScope].some((values) => values.length === 0)) {
      throw new TaskGraphConflictError([`${slice.id} has incomplete publication metadata`]);
    }
  }
}

export async function publishTaskGraph(
  github: TaskGraphGitHub,
  parentIssue: number,
  parentUrl: string,
  slices: readonly DeliverySlice[],
  labels: { readonly ready: string; readonly blocked: string },
): Promise<TaskGraphPublicationResult> {
  validateSlices(slices);
  const existing = await github.listSubIssues(parentIssue);
  const byId = new Map<string, PublishedSliceIssue>();
  for (const issue of existing) {
    const id = sliceId(issue.body);
    if (id !== undefined) {
      if (byId.has(id)) throw new TaskGraphConflictError([`${id} has duplicate managed sub-issues`]);
      byId.set(id, issue);
    }
  }

  const desired = slices.map((slice) => ({
    slice,
    title: `${slice.id}: ${slice.title}`,
    body: renderSliceIssue(slice, parentUrl),
    labels: [slice.blockedBy.length === 0 ? labels.ready : labels.blocked],
    existing: byId.get(slice.id),
  }));
  const conflicts = desired
    .filter(({ title, body, existing: issue }) => issue !== undefined && issue.lifecycle !== "not-started" && (issue.title !== title || issue.body !== body))
    .map(({ slice }) => slice.id);
  if (conflicts.length > 0) throw new TaskGraphConflictError(conflicts);

  const created: number[] = [];
  const updated: number[] = [];
  const unchanged: number[] = [];
  for (const item of desired) {
    if (item.existing === undefined) {
      const number = await github.createIssue(item.title, item.body, item.labels);
      await github.addSubIssue(parentIssue, number);
      created.push(number);
    } else if (item.existing.title === item.title && item.existing.body === item.body) {
      unchanged.push(item.existing.number);
    } else {
      await github.updateIssue(item.existing.number, item.title, item.body, item.labels);
      updated.push(item.existing.number);
    }
  }
  return { created, updated, unchanged };
}