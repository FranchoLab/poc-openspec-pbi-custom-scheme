import { describe, expect, it } from "vitest";

import {
  ArchiveFinalizationError,
  completePbiArchive,
} from "../src/archive-finalization.js";
import type {
  ArchiveResult,
  PbiArchiveOperations,
} from "../src/archive-finalization.js";

const changeName = "pbi-42-release-notes";
const pbiBranch = "feature/pbi-42-release-notes";
const commitSha = "a".repeat(40);
const archivePath = `openspec/changes/archive/2026-10-01-${changeName}`;

class StubArchiveOperations implements PbiArchiveOperations {
  readonly calls: string[] = [];

  constructor(
    readonly branch = pbiBranch,
    readonly archive: ArchiveResult = {
      archivePath,
      commitSha,
      changedPaths: [
        "openspec/specs/release-notes/spec.md",
        `${archivePath}/proposal.md`,
        `${archivePath}/tasks.md`,
      ],
    },
  ) {}

  currentBranch(): Promise<string> {
    this.calls.push("branch");
    return Promise.resolve(this.branch);
  }

  syncSpecs(name: string): Promise<void> {
    this.calls.push(`sync:${name}`);
    return Promise.resolve();
  }

  archiveChange(name: string): Promise<ArchiveResult> {
    this.calls.push(`archive:${name}`);
    return Promise.resolve(this.archive);
  }

  pushCommit(branch: string, sha: string): Promise<void> {
    this.calls.push(`push:${branch}:${sha}`);
    return Promise.resolve();
  }

  updatePullRequestBody(number: number, body: string): Promise<void> {
    this.calls.push(`body:${number}:${body}`);
    return Promise.resolve();
  }

  markPullRequestReady(number: number): Promise<void> {
    this.calls.push(`ready:${number}`);
    return Promise.resolve();
  }
}

const input = {
  changeName,
  pbiBranch,
  pullRequestNumber: 200,
  finalPullRequestBody: "Final verified summary",
  orchestrationTaskCompleted: true,
};

describe("PBI archive finalization", () => {
  it("syncs, archives, pushes the archive commit, and only then marks the final PR ready", async () => {
    const operations = new StubArchiveOperations();

    await expect(completePbiArchive(operations, input)).resolves.toEqual({
      archivePath,
      commitSha,
      pullRequestNumber: 200,
    });
    expect(operations.calls).toEqual([
      "branch",
      `sync:${changeName}`,
      `archive:${changeName}`,
      `push:${pbiBranch}:${commitSha}`,
      "body:200:Final verified summary",
      "ready:200",
    ]);
    expect(operations.calls.some((call) => call.includes("auto-merge"))).toBe(false);
  });

  it("stops before mutation when the orchestration task is pending or the branch is wrong", async () => {
    const pending = new StubArchiveOperations();
    await expect(completePbiArchive(pending, { ...input, orchestrationTaskCompleted: false }))
      .rejects.toThrow(ArchiveFinalizationError);
    expect(pending.calls).toEqual([]);

    const wrongBranch = new StubArchiveOperations("main");
    await expect(completePbiArchive(wrongBranch, input)).rejects.toThrow(/requires branch/u);
    expect(wrongBranch.calls).toEqual(["branch"]);
  });

  it.each([
    {
      name: "durable specs",
      changedPaths: [`${archivePath}/tasks.md`],
    },
    {
      name: "archived change files",
      changedPaths: ["openspec/specs/release-notes/spec.md"],
    },
  ])("does not push or ready the PR when the archive commit omits $name", async ({ changedPaths }) => {
    const operations = new StubArchiveOperations(pbiBranch, { archivePath, commitSha, changedPaths });

    await expect(completePbiArchive(operations, input)).rejects.toThrow(/does not include/u);
    expect(operations.calls).toEqual(["branch", `sync:${changeName}`, `archive:${changeName}`]);
  });
});