import { describe, expect, it } from "vitest";

import { TaskGraphConflictError, publishTaskGraph, renderSliceIssue } from "../src/task-graph.js";
import type { DeliverySlice, PublishedSliceIssue, TaskGraphGitHub } from "../src/task-graph.js";

const slices: DeliverySlice[] = [
  { id: "T01", title: "Generate notes", outcome: "Tagged releases receive notes.", acceptanceCriteria: ["Notes are categorized"], specCoverage: ["release-notes: Categorized release notes"], blockedBy: [], verification: ["Test a tagged release"], outOfScope: ["Publishing packages"] },
  { id: "T02", title: "Handle empty releases", outcome: "Empty releases explain that no changes exist.", acceptanceCriteria: ["An explicit empty message is shown"], specCoverage: ["release-notes: No eligible changes exist"], blockedBy: ["T01"], verification: ["Test without eligible changes"], outOfScope: ["Changelog generation"] },
];

class FakeGitHub implements TaskGraphGitHub {
  readonly issues: PublishedSliceIssue[] = [];
  readonly mutations: string[] = [];
  listSubIssues() { return Promise.resolve([...this.issues]); }
  createIssue(title: string, body: string) {
    const number = 100 + this.issues.length;
    this.mutations.push(`create:${number}`);
    this.issues.push({ number, title, body, lifecycle: "not-started" });
    return Promise.resolve(number);
  }
  updateIssue(issueNumber: number, title: string, body: string) {
    this.mutations.push(`update:${issueNumber}`);
    const index = this.issues.findIndex(({ number }) => number === issueNumber);
    this.issues[index] = { number: issueNumber, title, body, lifecycle: "not-started" };
    return Promise.resolve();
  }
  addSubIssue(parentIssue: number, childIssue: number) {
    this.mutations.push(`parent:${parentIssue}:${childIssue}`);
    return Promise.resolve();
  }
}

describe("task graph publication", () => {
  it("publishes native sub-issues with all required managed metadata", async () => {
    const github = new FakeGitHub();
    const result = await publishTaskGraph(github, 42, "https://github.com/acme/shop/issues/42", slices, { ready: "ready-for-agent", blocked: "agent-blocked" });
    expect(result.created).toEqual([100, 101]);
    expect(github.issues[1]?.body).toContain("## Blocked By\n- T01");
    expect(github.issues[0]?.body).toContain("## Spec Coverage");
  });

  it("reuses unchanged slices without duplicate resources", async () => {
    const github = new FakeGitHub();
    await publishTaskGraph(github, 42, "https://github.com/acme/shop/issues/42", slices, { ready: "ready", blocked: "blocked" });
    github.mutations.length = 0;
    const rerun = await publishTaskGraph(github, 42, "https://github.com/acme/shop/issues/42", slices, { ready: "ready", blocked: "blocked" });
    expect(rerun).toEqual({ created: [], updated: [], unchanged: [100, 101] });
    expect(github.mutations).toEqual([]);
  });

  it("detects all started-slice conflicts before any mutation", async () => {
    const github = new FakeGitHub();
    github.issues.push({ number: 100, title: "T01: Generate notes", body: renderSliceIssue(slices[0]!, "https://github.com/acme/shop/issues/42"), lifecycle: "started" });
    const revised = [{ ...slices[0]!, outcome: "Materially changed outcome." }, slices[1]!];
    await expect(publishTaskGraph(github, 42, "https://github.com/acme/shop/issues/42", revised, { ready: "ready", blocked: "blocked" }))
      .rejects.toBeInstanceOf(TaskGraphConflictError);
    expect(github.mutations).toEqual([]);
  });
});