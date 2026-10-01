import { describe, expect, it } from "vitest";

import { PullRequestConflictError, ensureDraftPbiPullRequest, ensureTaskPullRequest } from "../src/pull-requests.js";
import type { PullRequestCreateInput, PullRequestGitHub, PullRequestRecord } from "../src/pull-requests.js";

class FakeGitHub implements PullRequestGitHub {
  readonly records: PullRequestRecord[] = [];
  listPullRequests() { return Promise.resolve([...this.records]); }
  createPullRequest(input: PullRequestCreateInput) {
    const record: PullRequestRecord = { number: this.records.length + 1, url: `https://github.com/acme/shop/pull/${this.records.length + 1}`, state: "open", ...input };
    this.records.push(record);
    return Promise.resolve(record);
  }
}

describe("pull request creation", () => {
  it("creates one task PR against the PBI branch and reuses its marker", async () => {
    const github = new FakeGitHub();
    const input = { subIssueNumber: 101, title: "Generate notes", summary: "Implements T01.", taskBranch: "task/101-generate-notes", pbiBranch: "feature/pbi-42-release-notes" };
    const first = await ensureTaskPullRequest(github, input);
    const second = await ensureTaskPullRequest(github, input);
    expect(first.created).toBe(true);
    expect(first.pullRequest).toMatchObject({ baseBranch: input.pbiBranch, draft: false });
    expect(second).toEqual({ created: false, pullRequest: first.pullRequest });
    expect(github.records).toHaveLength(1);
  });

  it("opens the final PR as draft only after the first task merge and reuses it", async () => {
    const github = new FakeGitHub();
    const input = { pbiNumber: 42, title: "Release notes", summary: "Integrates PBI 42.", pbiBranch: "feature/pbi-42-release-notes", defaultBranch: "main", mergedTaskCount: 0 };
    expect(await ensureDraftPbiPullRequest(github, input)).toEqual({ created: false, deferred: true });
    const first = await ensureDraftPbiPullRequest(github, { ...input, mergedTaskCount: 1 });
    const second = await ensureDraftPbiPullRequest(github, { ...input, mergedTaskCount: 2 });
    expect(first.pullRequest).toMatchObject({ baseBranch: "main", draft: true });
    expect(second.created).toBe(false);
    expect(github.records).toHaveLength(1);
  });

  it("stops if the final PR was made ready before finalization", async () => {
    const github = new FakeGitHub();
    const input = { pbiNumber: 42, title: "Release notes", summary: "Integrates PBI 42.", pbiBranch: "feature/pbi-42-release-notes", defaultBranch: "main", mergedTaskCount: 1 };
    const created = await ensureDraftPbiPullRequest(github, input);
    github.records[0] = { ...created.pullRequest!, draft: false };
    await expect(ensureDraftPbiPullRequest(github, input)).rejects.toBeInstanceOf(PullRequestConflictError);
  });
});