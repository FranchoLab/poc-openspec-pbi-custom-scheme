import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  RepositoryScopeError,
  assertRepositoryScope,
  redactSecrets,
  resolveRepositoryPath,
} from "../src/commands.js";
import { renderFinalPullRequestBody } from "../src/final-pr-body.js";
import { requireTrustedLabelApproval } from "../src/trusted-approval.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/security/adversarial.json", import.meta.url), "utf8")) as Record<string, string>;

describe("adversarial workflow boundaries", () => {
  it("rejects path traversal before repository file access", () => {
    expect(() => resolveRepositoryPath("/workspace/repository", fixture.pathTraversal!))
      .toThrow(RepositoryScopeError);
  });

  it("rejects malicious links before invoking external resolvers", async () => {
    let resolverCalled = false;
    const resolver = {
      issueResolves: () => { resolverCalled = true; return Promise.resolve(true); },
      commitResolves: () => { resolverCalled = true; return Promise.resolve(true); },
      checkResolves: () => { resolverCalled = true; return Promise.resolve(true); },
    };
    await expect(renderFinalPullRequestBody({
      existingBody: "",
      pbiNumber: 42,
      pbiUrl: fixture.maliciousIssueUrl!,
      archiveCommitSha: "a".repeat(40),
      slices: [{ id: "T01", title: fixture.promptInjection!, issueUrl: "https://github.com/acme/shop/issues/101", commitSha: "b".repeat(40) }],
      verification: [{ name: "test", checkUrl: "https://github.com/acme/shop/actions/runs/123", evidence: fixture.commandSubstitution! }],
      gates: [{ gate: "qa", verdict: "pass", evidence: ["pass"] }],
      demoEvidence: ["approved"],
      mergeRisk: { level: "low", assessment: "bounded" },
    }, resolver)).rejects.toThrow(/Invalid canonical PBI reference/u);
    expect(resolverCalled).toBe(false);
  });

  it("renders prompt injection and command substitution as escaped data", async () => {
    const resolver = {
      issueResolves: () => Promise.resolve(true),
      commitResolves: () => Promise.resolve(true),
      checkResolves: () => Promise.resolve(true),
    };
    const body = await renderFinalPullRequestBody({
      existingBody: "",
      pbiNumber: 42,
      pbiUrl: "https://github.com/acme/shop/issues/42",
      archiveCommitSha: "a".repeat(40),
      slices: [{ id: "T01", title: fixture.promptInjection!, issueUrl: "https://github.com/acme/shop/issues/101", commitSha: "b".repeat(40) }],
      verification: [{ name: "test", checkUrl: "https://github.com/acme/shop/actions/runs/123", evidence: fixture.commandSubstitution! }],
      gates: [{ gate: "qa", verdict: "pass", evidence: ["pass"] }],
      demoEvidence: ["approved"],
      mergeRisk: { level: "low", assessment: "bounded" },
    }, resolver);
    expect(body).toContain("$\\(");
    expect(body).not.toContain("](https://evil.invalid");
  });

  it("redacts secrets and rejects untrusted approvals and cross-repository scope", () => {
    expect(redactSecrets(fixture.secretDiagnostic!)).toBe("Authentication failed: [REDACTED]");
    expect(() => requireTrustedLabelApproval([{
      action: "labeled",
      label: "gate/demo-approved",
      createdAt: "2026-10-01T00:01:00Z",
      actor: { login: fixture.untrustedApprover!, type: "User" },
    }], "gate/demo-approved", ["lead"], "2026-10-01T00:00:00Z")).toThrow(/trusted human/u);
    expect(() => assertRepositoryScope("acme/shop", fixture.crossRepository!)).toThrow(RepositoryScopeError);
  });
});