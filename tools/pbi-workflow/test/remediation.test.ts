import { describe, expect, it } from "vitest";

import { gatesToRerunAfterRemediation, publishRemediation, remediationKey } from "../src/remediation.js";
import type { RemediationFinding } from "../src/remediation.js";
import type { PublishedSliceIssue, TaskGraphGitHub } from "../src/task-graph.js";

const finding: RemediationFinding = { gate: "documentation", code: "broken-command", path: "README.md", message: "Setup command uses a removed flag", verification: ["Run the corrected setup command"] };

class FakeGitHub implements TaskGraphGitHub {
  readonly issues: PublishedSliceIssue[] = [];
  readonly mutations: string[] = [];
  listSubIssues() { return Promise.resolve([...this.issues]); }
  createIssue(title: string, body: string) {
    const number = 200 + this.issues.length;
    this.mutations.push(`create:${number}`);
    this.issues.push({ number, title, body, lifecycle: "not-started" });
    return Promise.resolve(number);
  }
  updateIssue() { throw new Error("not used"); }
  addSubIssue(parent: number, child: number) { this.mutations.push(`parent:${parent}:${child}`); return Promise.resolve(); }
}

describe("gate remediation", () => {
  it("derives stable identity and reuses an unchanged remediation sub-issue", async () => {
    const github = new FakeGitHub();
    const first = await publishRemediation(github, 42, "https://github.com/acme/shop/issues/42", finding, "ready-for-agent");
    const second = await publishRemediation(github, 42, "https://github.com/acme/shop/issues/42", finding, "ready-for-agent");
    expect(first).toEqual({ key: remediationKey(finding), issueNumber: 200, created: true });
    expect(second).toEqual({ key: first.key, issueNumber: 200, created: false });
    expect(github.mutations).toEqual(["create:200", "parent:42:200"]);
  });

  it("reruns the invalidated gate and every downstream gate after merge", () => {
    expect(gatesToRerunAfterRemediation("documentation")).toEqual(["documentation", "qa", "demo-preparation", "demo-approval"]);
    expect(gatesToRerunAfterRemediation("qa")).toEqual(["qa", "demo-preparation", "demo-approval"]);
    expect(gatesToRerunAfterRemediation("demo-preparation")).toEqual(["demo-preparation", "demo-approval"]);
  });
});