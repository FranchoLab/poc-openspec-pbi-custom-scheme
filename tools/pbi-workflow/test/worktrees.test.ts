import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { NodeCommandRunner } from "../src/commands.js";
import { GitWorktreeManager } from "../src/worktrees.js";

const temporaryRepositories: string[] = [];
const runner = new NodeCommandRunner();

async function git(root: string, args: readonly string[]): Promise<void> {
  const result = await runner.run({ executable: "git", args, cwd: root });
  if (result.exitCode !== 0) throw new Error(result.stderr);
}

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pbi-worktree-"));
  temporaryRepositories.push(root);
  await git(root, ["init", "--initial-branch=main"]);
  await writeFile(join(root, "README.md"), "user content\n", "utf8");
  await git(root, ["add", "README.md"]);
  await git(root, ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "initial"]);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRepositories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Git worktree lifecycle", () => {
  it("creates branches and reuses the same worktree during recovery", async () => {
    const root = await repository();
    const manager = new GitWorktreeManager(runner, root);
    const created = await manager.ensureTaskWorktree(42, "release-notes", 101, "generate-notes", "main");
    const recovered = await manager.ensureTaskWorktree(42, "release-notes", 101, "generate-notes", "main");
    expect(created).toMatchObject({ pbiBranch: "feature/pbi-42-release-notes", taskBranch: "task/101-generate-notes", created: true });
    expect(recovered).toEqual({ ...created, created: false });
    expect(await readFile(join(root, "README.md"), "utf8")).toBe("user content\n");
  });

  it("removes only clean managed worktrees and retains their recovery branch", async () => {
    const root = await repository();
    const manager = new GitWorktreeManager(runner, root);
    const worktree = await manager.ensureTaskWorktree(42, "release-notes", 101, "generate-notes", "main");
    expect(await manager.cleanupTaskWorktree(worktree.taskBranch)).toBe("removed");
    const recovered = await manager.ensureTaskWorktree(42, "release-notes", 101, "generate-notes", "main");
    expect(recovered.created).toBe(true);
  });

  it("preserves dirty task work and unrelated main-worktree changes", async () => {
    const root = await repository();
    const manager = new GitWorktreeManager(runner, root);
    const worktree = await manager.ensureTaskWorktree(42, "release-notes", 101, "generate-notes", "main");
    await writeFile(join(worktree.path, "task.txt"), "unfinished\n", "utf8");
    await writeFile(join(root, "local.txt"), "unrelated\n", "utf8");
    expect(await manager.cleanupTaskWorktree(worktree.taskBranch)).toBe("preserved-dirty");
    expect(await readFile(join(worktree.path, "task.txt"), "utf8")).toBe("unfinished\n");
    expect(await readFile(join(root, "local.txt"), "utf8")).toBe("unrelated\n");
  });
});