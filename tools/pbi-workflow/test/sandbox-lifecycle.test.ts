import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { completePbiArchive } from "../src/archive-finalization.js";
import type { ArchiveResult, PbiArchiveOperations } from "../src/archive-finalization.js";
import { createClaim } from "../src/claims.js";
import { NodeCommandRunner } from "../src/commands.js";
import type { GitHubIssue } from "../src/commands.js";
import { approveDemo } from "../src/demo.js";
import { renderFinalPullRequestBody } from "../src/final-pr-body.js";
import { planPbiFinalization } from "../src/finalization.js";
import { resolvePbiChange } from "../src/pbi-identity.js";
import { validatePbiPreflight } from "../src/pbi-preflight.js";
import { ensureDraftPbiPullRequest, ensureTaskPullRequest } from "../src/pull-requests.js";
import type { PullRequestCreateInput, PullRequestGitHub, PullRequestRecord } from "../src/pull-requests.js";
import { gatesToRerunAfterRemediation, publishRemediation } from "../src/remediation.js";
import { buildResumeDiagnostics } from "../src/resume-diagnostics.js";
import { evaluateReviewCycle } from "../src/review-cycles.js";
import { parseReviewResult, reviewAcceptanceAndSpecs } from "../src/reviews.js";
import { scheduleReadyTasks } from "../src/scheduler.js";
import type { SchedulerSlice } from "../src/scheduler.js";
import { reconcileSetup } from "../src/setup-reconciliation.js";
import type { SetupManifest, SetupTarget } from "../src/setup-reconciliation.js";
import { approveTechnicalContract, computePbiRevision, isContractApprovalCurrent, updateTechnicalContract } from "../src/technical-contract.js";
import { publishTaskGraph } from "../src/task-graph.js";
import type { DeliverySlice, PublishedSliceIssue, TaskGraphGitHub } from "../src/task-graph.js";
import { planTaskMerge } from "../src/task-merge.js";
import type { GateRecord } from "../src/state.js";

const fixtureRoot = dirname(fileURLToPath(new URL("./fixtures/specification/package.json", import.meta.url)));
const pbiNumber = 42;
const pbiUrl = "https://github.com/acme/shop/issues/42";
const changeName = "pbi-42-release-notes";
const pbiBranch = "feature/pbi-42-release-notes";
const headSha = "a".repeat(40);
const archiveCommitSha = "b".repeat(40);
const runId = "00000000-0000-4000-8000-000000000001";

class SandboxSetupTarget implements SetupTarget {
  readonly files = new Map<string, string>();
  readonly labels = new Set<string>();

  readText(path: string): Promise<string | undefined> { return Promise.resolve(this.files.get(path)); }
  writeText(path: string, content: string): Promise<void> { this.files.set(path, content); return Promise.resolve(); }
  listLabels(): Promise<readonly string[]> { return Promise.resolve([...this.labels]); }
  createLabel(name: string): Promise<void> { this.labels.add(name); return Promise.resolve(); }
}

class SandboxIssues implements TaskGraphGitHub {
  readonly issues: PublishedSliceIssue[] = [];

  listSubIssues(): Promise<readonly PublishedSliceIssue[]> { return Promise.resolve([...this.issues]); }
  createIssue(title: string, body: string): Promise<number> {
    const number = 100 + this.issues.length;
    this.issues.push({ number, title, body, lifecycle: "not-started" });
    return Promise.resolve(number);
  }
  updateIssue(issueNumber: number, title: string, body: string): Promise<void> {
    const index = this.issues.findIndex(({ number }) => number === issueNumber);
    this.issues[index] = { ...this.issues[index]!, title, body };
    return Promise.resolve();
  }
  addSubIssue(): Promise<void> { return Promise.resolve(); }
}

class SandboxPullRequests implements PullRequestGitHub {
  readonly records: PullRequestRecord[] = [];

  listPullRequests(): Promise<readonly PullRequestRecord[]> { return Promise.resolve([...this.records]); }
  createPullRequest(input: PullRequestCreateInput): Promise<PullRequestRecord> {
    const record = {
      ...input,
      number: 200 + this.records.length,
      url: `https://github.com/acme/shop/pull/${200 + this.records.length}`,
      state: "open" as const,
    };
    this.records.push(record);
    return Promise.resolve(record);
  }
}

class SandboxArchive implements PbiArchiveOperations {
  readonly calls: string[] = [];
  readonly archivePath = `openspec/changes/archive/2026-10-01-${changeName}`;

  currentBranch(): Promise<string> { this.calls.push("branch"); return Promise.resolve(pbiBranch); }
  syncSpecs(name: string): Promise<void> { this.calls.push(`sync:${name}`); return Promise.resolve(); }
  archiveChange(name: string): Promise<ArchiveResult> {
    this.calls.push(`archive:${name}`);
    return Promise.resolve({
      archivePath: this.archivePath,
      commitSha: archiveCommitSha,
      changedPaths: ["openspec/specs/release-notes/spec.md", `${this.archivePath}/tasks.md`],
    });
  }
  pushCommit(branch: string, sha: string): Promise<void> { this.calls.push(`push:${branch}:${sha}`); return Promise.resolve(); }
  updatePullRequestBody(number: number): Promise<void> { this.calls.push(`body:${number}`); return Promise.resolve(); }
  markPullRequestReady(number: number): Promise<void> { this.calls.push(`ready:${number}`); return Promise.resolve(); }
}

function gate(name: GateRecord["gate"], verdict: GateRecord["verdict"] = "pass"): GateRecord {
  return { gate: name, headSha, runId, verdict, evidence: [`${name} evidence`], findings: [] };
}

describe("sandbox PBI lifecycle qualification", () => {
  it("runs the complete workflow and produces reproducible final evidence", async () => {
    const setupTarget = new SandboxSetupTarget();
    const manifest: SetupManifest = {
      configuration: "version: 1\n",
      openSpecConfig: "schema: spec-driven\n",
      issueTemplate: "name: PBI\n",
      skills: { "pbi-orchestrator": "orchestrate" },
      agents: { "pbi-reviewer": "review" },
      labels: ["pbi/refinement", "ready-for-agent", "agent-blocked"],
    };
    expect((await reconcileSetup(setupTarget, manifest, true)).createdLabels).toHaveLength(3);
    expect(await reconcileSetup(setupTarget, manifest, true)).toEqual({ changedFiles: [], createdLabels: [] });

    const proposalInstructions = await readFile(new URL("../../../.github/copilot-instructions.md", import.meta.url), "utf8");
    expect(proposalInstructions).toMatch(/Require a GitHub PBI issue number or canonical URL/u);
    const issue: GitHubIssue = {
      number: pbiNumber,
      title: "Release notes",
      url: pbiUrl,
      state: "OPEN",
      body: await readFile(new URL("./fixtures/pbi/valid.md", import.meta.url), "utf8"),
      author: { login: "product-owner" },
    };
    expect(validatePbiPreflight(issue, { trustedAuthors: ["product-owner"], trustedApprovers: ["lead"] }).accepted).toBe(true);
    expect(resolvePbiChange(pbiNumber, issue.title, [])).toEqual({ action: "create", changeName, source: "derived" });

    const contractUpdate = updateTechnicalContract(issue.body, computePbiRevision(issue.body), {
      changeName,
      decisions: ["Use deterministic local orchestration"],
      alternatives: ["Reject repository-hosted workflow automation"],
      constraints: ["GitHub remains authoritative"],
      risks: ["Stale evidence after branch updates"],
      verification: ["Run the sandbox lifecycle qualification"],
      slices: [
        { id: "T01", title: "Plan", outcome: "Publish the approved graph" },
        { id: "T02", title: "Implement", outcome: "Deliver implementation" },
        { id: "T03", title: "Document", outcome: "Deliver documentation" },
      ],
    });
    const approval = approveTechnicalContract(contractUpdate.revision, contractUpdate.revision, [{
      action: "labeled",
      label: "gate/contract-approved",
      createdAt: "2026-10-01T00:01:00Z",
      actor: { login: "lead", type: "User" },
    }], "gate/contract-approved", ["lead"], "2026-10-01T00:00:00Z");
    expect(isContractApprovalCurrent(approval, contractUpdate.body)).toBe(true);

    const specValidation = await new NodeCommandRunner().run({
      executable: "openspec",
      args: ["validate", changeName, "--strict"],
      cwd: fixtureRoot,
    });
    expect(specValidation.exitCode, specValidation.stderr).toBe(0);

    const slices: DeliverySlice[] = ["T01", "T02", "T03"].map((id) => ({
      id,
      title: `Sandbox ${id}`,
      outcome: `Deliver ${id}`,
      acceptanceCriteria: [`AC-${id}: observable outcome`],
      specCoverage: [`SC-${id}: sandbox scenario`],
      blockedBy: [],
      verification: [`Verify ${id}`],
      outOfScope: ["Unrelated changes"],
    }));
    const issues = new SandboxIssues();
    expect((await publishTaskGraph(issues, pbiNumber, pbiUrl, slices, { ready: "ready-for-agent", blocked: "agent-blocked" })).created).toHaveLength(3);
    const schedulerSlices: SchedulerSlice[] = slices.map((slice, index) => ({ ...slice, issueNumber: 100 + index, state: "ready" }));
    expect(scheduleReadyTasks(schedulerSlices, [], 3).map(({ id }) => id)).toEqual(["T01", "T02", "T03"]);

    const now = new Date("2026-10-01T12:00:00Z");
    const claims = schedulerSlices.map((slice) => ({ sliceId: slice.id, claim: createClaim(`${runId.slice(0, -1)}${String(Number(slice.id.slice(2)))}`, "pbi-implementer", `task/${slice.issueNumber}`, now) }));
    const pullRequests = new SandboxPullRequests();
    for (const slice of schedulerSlices) {
      await ensureTaskPullRequest(pullRequests, {
        subIssueNumber: slice.issueNumber,
        title: slice.title,
        summary: `Implements ${slice.id}`,
        taskBranch: `task/${slice.issueNumber}-${slice.id.toLowerCase()}`,
        pbiBranch,
      });
    }
    expect((await ensureDraftPbiPullRequest(pullRequests, {
      pbiNumber,
      title: issue.title,
      summary: "Integrates sandbox PBI",
      pbiBranch,
      defaultBranch: "main",
      mergedTaskCount: 1,
    })).pullRequest?.draft).toBe(true);

    const standards = parseReviewResult({ reviewer: "standards", headSha, review: "standards", verdict: "pass", findings: [], evidence: ["lint passed"] });
    const compliance = reviewAcceptanceAndSpecs({
      headSha,
      acceptanceCriteria: [{ id: "AC", text: "Observable result" }],
      scenarios: [{ id: "SC", text: "Sandbox scenario" }],
      evidence: [
        { targetId: "AC", status: "pass", evidence: "acceptance test" },
        { targetId: "SC", status: "pass", evidence: "scenario test" },
      ],
      changedPaths: ["tools/pbi-workflow/src"],
      allowedPathPrefixes: ["tools/pbi-workflow"],
    });
    const review = evaluateReviewCycle({ headSha, cycle: 1, standards, compliance, requiredChecks: ["test"], checks: [{ name: "test", status: "success" }] });
    expect(planTaskMerge("clean", review)).toMatchObject({ action: "enable-squash-auto-merge" });

    const staleRecovery = buildResumeDiagnostics({
      now: new Date("2026-10-01T15:00:00Z"),
      currentHeadSha: headSha,
      slices: schedulerSlices,
      claims,
      taskPullRequests: [],
      blockers: [],
      gateRecords: [],
      orchestrationTaskCompleted: false,
      finalPullRequestReady: false,
    });
    expect(staleRecovery.nextAction).toBe("resolve-blockers");
    expect(staleRecovery.staleClaims).toHaveLength(3);

    const finding = { gate: "qa" as const, code: "missing-evidence", path: "test/sandbox", message: "Add sandbox evidence", verification: ["Rerun qualification"] };
    const remediation = await publishRemediation(issues, pbiNumber, pbiUrl, finding, "ready-for-agent");
    expect(remediation.created).toBe(true);
    expect((await publishRemediation(issues, pbiNumber, pbiUrl, finding, "ready-for-agent")).created).toBe(false);
    expect(gatesToRerunAfterRemediation("qa")).toEqual(["qa", "demo-preparation", "demo-approval"]);

    const demoApproval = approveDemo(headSha, headSha, [{
      action: "labeled",
      label: "gate/demo-approved",
      createdAt: "2026-10-01T00:03:00Z",
      actor: { login: "lead", type: "User" },
    }], "gate/demo-approved", ["lead"], "2026-10-01T00:02:00Z");
    expect(demoApproval.approvedBy).toBe("lead");
    const gates = [gate("documentation"), gate("qa"), gate("demo-preparation", "not-applicable"), gate("demo-approval")];
    const mergedTaskPullRequests = pullRequests.records.slice(0, 3).map((record) => ({ ...record, state: "merged" as const }));
    const tasksDocument = `# PBI Orchestration\n\n- [ ] 1.1 Run the PBI orchestrator for ${pbiUrl}\n`;
    const finalization = planPbiFinalization(tasksDocument, mergedTaskPullRequests, gates, headSha);
    expect(finalization.completed).toBe(true);

    const finalBody = await renderFinalPullRequestBody({
      existingBody: pullRequests.records[3]!.body,
      pbiNumber,
      pbiUrl,
      archiveCommitSha,
      slices: schedulerSlices.map((slice, index) => ({ id: slice.id, title: slice.title, issueUrl: `https://github.com/acme/shop/issues/${100 + index}`, commitSha: String(index + 1).repeat(40) })),
      verification: [{ name: "sandbox", checkUrl: "https://github.com/acme/shop/actions/runs/123", evidence: "qualification passed" }],
      gates: gates.map(({ gate: name, verdict, evidence }) => ({ gate: name as Exclude<GateRecord["gate"], "contract">, verdict, evidence })),
      demoEvidence: ["Trusted human accepted the non-applicable demo"],
      mergeRisk: { level: "low", assessment: "Deterministic sandbox evidence covers the workflow" },
    }, {
      issueResolves: () => Promise.resolve(true),
      commitResolves: () => Promise.resolve(true),
      checkResolves: () => Promise.resolve(true),
    });
    const archive = new SandboxArchive();
    await expect(completePbiArchive(archive, {
      changeName,
      pbiBranch,
      pullRequestNumber: pullRequests.records[3]!.number,
      finalPullRequestBody: finalBody,
      orchestrationTaskCompleted: finalization.completed,
    })).resolves.toMatchObject({ commitSha: archiveCommitSha, pullRequestNumber: 203 });
    expect(archive.calls).toEqual([
      "branch",
      `sync:${changeName}`,
      `archive:${changeName}`,
      `push:${pbiBranch}:${archiveCommitSha}`,
      "body:203",
      "ready:203",
    ]);
  }, 20_000);
});