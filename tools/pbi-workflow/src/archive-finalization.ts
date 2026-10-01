export interface ArchiveResult {
  readonly archivePath: string;
  readonly commitSha: string;
  readonly changedPaths: readonly string[];
}

export interface PbiArchiveOperations {
  currentBranch(): Promise<string>;
  syncSpecs(changeName: string): Promise<void>;
  archiveChange(changeName: string): Promise<ArchiveResult>;
  pushCommit(branch: string, commitSha: string): Promise<void>;
  updatePullRequestBody(pullRequestNumber: number, body: string): Promise<void>;
  markPullRequestReady(pullRequestNumber: number): Promise<void>;
}

export interface PbiArchiveCompletion {
  readonly archivePath: string;
  readonly commitSha: string;
  readonly pullRequestNumber: number;
}

export class ArchiveFinalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveFinalizationError";
  }
}

function assertArchiveResult(changeName: string, result: ArchiveResult): void {
  const expectedPrefix = "openspec/changes/archive/";
  const unsafePath = (path: string): boolean => path.startsWith("/") || path.includes("\\") || path.split("/").includes("..");
  if (unsafePath(result.archivePath) || !result.archivePath.startsWith(expectedPrefix) || !result.archivePath.endsWith(`-${changeName}`)) {
    throw new ArchiveFinalizationError(`Unexpected archive path: ${result.archivePath}`);
  }
  if (!/^[0-9a-f]{40}$/u.test(result.commitSha)) {
    throw new ArchiveFinalizationError(`Invalid archive commit SHA: ${result.commitSha}`);
  }
  if (result.changedPaths.some(unsafePath)) {
    throw new ArchiveFinalizationError("Archive commit contains an unsafe changed path");
  }
  if (!result.changedPaths.some((path) => path.startsWith("openspec/specs/") && path.endsWith("/spec.md"))) {
    throw new ArchiveFinalizationError("Archive commit does not include durable OpenSpec specs");
  }
  if (!result.changedPaths.some((path) => path.startsWith(`${result.archivePath}/`))) {
    throw new ArchiveFinalizationError("Archive commit does not include archived change files");
  }
}

export async function completePbiArchive(
  operations: PbiArchiveOperations,
  input: {
    readonly changeName: string;
    readonly pbiBranch: string;
    readonly pullRequestNumber: number;
    readonly finalPullRequestBody: string;
    readonly orchestrationTaskCompleted: boolean;
  },
): Promise<PbiArchiveCompletion> {
  if (!input.orchestrationTaskCompleted) {
    throw new ArchiveFinalizationError("Orchestration task must be complete before archive finalization");
  }
  const branch = await operations.currentBranch();
  if (branch !== input.pbiBranch) {
    throw new ArchiveFinalizationError(`Archive finalization requires branch ${input.pbiBranch}, received ${branch}`);
  }

  await operations.syncSpecs(input.changeName);
  const archive = await operations.archiveChange(input.changeName);
  assertArchiveResult(input.changeName, archive);
  await operations.pushCommit(input.pbiBranch, archive.commitSha);
  await operations.updatePullRequestBody(input.pullRequestNumber, input.finalPullRequestBody);
  await operations.markPullRequestReady(input.pullRequestNumber);
  return {
    archivePath: archive.archivePath,
    commitSha: archive.commitSha,
    pullRequestNumber: input.pullRequestNumber,
  };
}