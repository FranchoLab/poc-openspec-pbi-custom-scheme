import { resolve } from "node:path";

import { CommandExecutionError } from "./commands.js";
import type { CommandRunner } from "./commands.js";

interface WorktreeRecord {
  readonly path: string;
  readonly branch?: string;
}

export interface TaskWorktree {
  readonly path: string;
  readonly pbiBranch: string;
  readonly taskBranch: string;
  readonly created: boolean;
}

export type WorktreeCleanupResult = "removed" | "preserved-dirty" | "not-found";

export class WorktreeConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorktreeConflictError";
  }
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  if (normalized === "") throw new WorktreeConflictError(`Invalid empty branch slug from: ${value}`);
  return normalized;
}

function parseWorktrees(source: string): readonly WorktreeRecord[] {
  return source.trim().split(/\n\n+/u).filter(Boolean).map((block) => {
    const values = Object.fromEntries(block.split("\n").map((line) => {
      const separator = line.indexOf(" ");
      return separator === -1 ? [line, ""] : [line.slice(0, separator), line.slice(separator + 1)];
    }));
    return {
      path: values.worktree!,
      ...(values.branch === undefined ? {} : { branch: values.branch.replace(/^refs\/heads\//u, "") }),
    };
  });
}

export class GitWorktreeManager {
  constructor(
    private readonly runner: CommandRunner,
    private readonly repositoryRoot: string,
  ) {}

  private async git(args: readonly string[], cwd = this.repositoryRoot, allowFailure = false): Promise<{ stdout: string; exitCode: number }> {
    const result = await this.runner.run({ executable: "git", args, cwd });
    if (result.exitCode !== 0 && !allowFailure) throw new CommandExecutionError("git", result.exitCode, result.stderr);
    return result;
  }

  private async branchExists(branch: string): Promise<boolean> {
    return (await this.git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], this.repositoryRoot, true)).exitCode === 0;
  }

  async ensureTaskWorktree(
    pbiNumber: number,
    pbiSlug: string,
    subIssueNumber: number,
    taskSlug: string,
    baseBranch: string,
  ): Promise<TaskWorktree> {
    const pbiBranch = `feature/pbi-${pbiNumber}-${slug(pbiSlug)}`;
    const taskBranch = `task/${subIssueNumber}-${slug(taskSlug)}`;
    const path = resolve(this.repositoryRoot, ".pbi-worktrees", `pbi-${pbiNumber}`, `${subIssueNumber}-${slug(taskSlug)}`);
    const records = parseWorktrees((await this.git(["worktree", "list", "--porcelain"])).stdout);
    const attached = records.find((record) => record.branch === taskBranch);
    if (attached !== undefined) {
      return { path: attached.path, pbiBranch, taskBranch, created: false };
    }
    const occupying = records.find((record) => resolve(record.path) === path);
    if (occupying !== undefined) throw new WorktreeConflictError(`Managed path is occupied by ${occupying.branch ?? "a detached worktree"}: ${path}`);

    if (!(await this.branchExists(pbiBranch))) await this.git(["branch", pbiBranch, baseBranch]);
    if (await this.branchExists(taskBranch)) {
      await this.git(["worktree", "add", path, taskBranch]);
    } else {
      await this.git(["worktree", "add", "-b", taskBranch, path, pbiBranch]);
    }
    return { path, pbiBranch, taskBranch, created: true };
  }

  async cleanupTaskWorktree(taskBranch: string): Promise<WorktreeCleanupResult> {
    const records = parseWorktrees((await this.git(["worktree", "list", "--porcelain"])).stdout);
    const record = records.find((candidate) => candidate.branch === taskBranch);
    if (record === undefined) return "not-found";
    const managedRoot = resolve(this.repositoryRoot, ".pbi-worktrees");
    if (!resolve(record.path).startsWith(`${managedRoot}/`)) {
      throw new WorktreeConflictError(`Refusing to remove worktree outside ${managedRoot}: ${record.path}`);
    }
    if ((await this.git(["status", "--porcelain"], record.path)).stdout.trim() !== "") return "preserved-dirty";
    await this.git(["worktree", "remove", record.path]);
    return "removed";
  }
}