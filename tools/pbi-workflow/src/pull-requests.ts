import { parseManagedBlocks, renderManagedBlock } from "./markers.js";

export interface PullRequestRecord {
  readonly number: number;
  readonly url: string;
  readonly title: string;
  readonly body: string;
  readonly headBranch: string;
  readonly baseBranch: string;
  readonly draft: boolean;
  readonly state: "open" | "closed" | "merged";
}

export interface PullRequestCreateInput {
  readonly title: string;
  readonly body: string;
  readonly headBranch: string;
  readonly baseBranch: string;
  readonly draft: boolean;
}

export interface PullRequestGitHub {
  listPullRequests(): Promise<readonly PullRequestRecord[]>;
  createPullRequest(input: PullRequestCreateInput): Promise<PullRequestRecord>;
}

export class PullRequestConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PullRequestConflictError";
  }
}

function purpose(record: PullRequestRecord): string | undefined {
  return parseManagedBlocks(record.body).find((block) => block.kind === "pull-request")?.id;
}

function body(markerId: string, summary: string): string {
  return `${summary.trim()}\n\n${renderManagedBlock("pull-request", markerId, JSON.stringify({ purpose: markerId }))}\n`;
}

function uniquePurpose(records: readonly PullRequestRecord[], markerId: string): PullRequestRecord | undefined {
  const matches = records.filter((record) => purpose(record) === markerId);
  if (matches.length > 1) throw new PullRequestConflictError(`Multiple pull requests have purpose ${markerId}`);
  return matches[0];
}

export async function ensureTaskPullRequest(
  github: PullRequestGitHub,
  input: {
    readonly subIssueNumber: number;
    readonly title: string;
    readonly summary: string;
    readonly taskBranch: string;
    readonly pbiBranch: string;
  },
): Promise<{ readonly created: boolean; readonly pullRequest: PullRequestRecord }> {
  const markerId = `task-${input.subIssueNumber}`;
  const existing = uniquePurpose(await github.listPullRequests(), markerId);
  if (existing !== undefined) {
    if (existing.headBranch !== input.taskBranch || existing.baseBranch !== input.pbiBranch) {
      throw new PullRequestConflictError(`Task PR ${existing.number} does not target the configured branches`);
    }
    return { created: false, pullRequest: existing };
  }
  const pullRequest = await github.createPullRequest({
    title: input.title,
    body: body(markerId, input.summary),
    headBranch: input.taskBranch,
    baseBranch: input.pbiBranch,
    draft: false,
  });
  return { created: true, pullRequest };
}

export async function ensureDraftPbiPullRequest(
  github: PullRequestGitHub,
  input: {
    readonly pbiNumber: number;
    readonly title: string;
    readonly summary: string;
    readonly pbiBranch: string;
    readonly defaultBranch: string;
    readonly mergedTaskCount: number;
  },
): Promise<{ readonly created: boolean; readonly deferred: boolean; readonly pullRequest?: PullRequestRecord }> {
  if (input.mergedTaskCount < 1) return { created: false, deferred: true };
  const markerId = `pbi-${input.pbiNumber}`;
  const existing = uniquePurpose(await github.listPullRequests(), markerId);
  if (existing !== undefined) {
    if (existing.headBranch !== input.pbiBranch || existing.baseBranch !== input.defaultBranch) {
      throw new PullRequestConflictError(`PBI PR ${existing.number} does not target the configured branches`);
    }
    if (!existing.draft) throw new PullRequestConflictError(`PBI PR ${existing.number} must remain draft during implementation`);
    return { created: false, deferred: false, pullRequest: existing };
  }
  const pullRequest = await github.createPullRequest({
    title: input.title,
    body: body(markerId, input.summary),
    headBranch: input.pbiBranch,
    baseBranch: input.defaultBranch,
    draft: true,
  });
  return { created: true, deferred: false, pullRequest };
}