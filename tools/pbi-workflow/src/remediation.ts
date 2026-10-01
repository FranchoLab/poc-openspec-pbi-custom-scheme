import { createHash } from "node:crypto";

import { parseManagedBlocks, renderManagedBlock } from "./markers.js";
import type { GateName } from "./state.js";
import type { PublishedSliceIssue, TaskGraphGitHub } from "./task-graph.js";

export interface RemediationFinding {
  readonly gate: "documentation" | "qa" | "demo-preparation";
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly verification: readonly string[];
}

export interface RemediationPublication {
  readonly key: string;
  readonly issueNumber: number;
  readonly created: boolean;
}

export function remediationKey(finding: RemediationFinding): string {
  const identity = [finding.gate, finding.code.trim().toLowerCase(), finding.path.trim().toLowerCase(), finding.message.trim().toLowerCase()].join("\n");
  return `remediation-${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`;
}

function existingKey(issue: PublishedSliceIssue): string | undefined {
  return parseManagedBlocks(issue.body).find((block) => block.kind === "remediation")?.id;
}

export async function publishRemediation(
  github: TaskGraphGitHub,
  parentIssue: number,
  parentUrl: string,
  finding: RemediationFinding,
  readyLabel: string,
): Promise<RemediationPublication> {
  const key = remediationKey(finding);
  const matches = (await github.listSubIssues(parentIssue)).filter((issue) => existingKey(issue) === key);
  if (matches.length > 1) throw new Error(`Duplicate remediation issues for ${key}`);
  if (matches[0] !== undefined) return { key, issueNumber: matches[0].number, created: false };
  const content = [
    `# Remediate ${finding.gate} finding`,
    `Parent PBI: ${parentUrl}`,
    `## Finding\n${finding.message}`,
    `## Affected Path\n${finding.path}`,
    `## Verification\n${finding.verification.map((item) => `- ${item}`).join("\n")}`,
    "## Out of Scope\n- Unrelated gate findings and feature work",
  ].join("\n\n");
  const number = await github.createIssue(
    `Remediate ${finding.gate}: ${finding.message}`,
    renderManagedBlock("remediation", key, content),
    [readyLabel],
  );
  await github.addSubIssue(parentIssue, number);
  return { key, issueNumber: number, created: true };
}

const completionOrder: readonly GateName[] = ["documentation", "qa", "demo-preparation", "demo-approval"];

export function gatesToRerunAfterRemediation(gate: RemediationFinding["gate"]): readonly GateName[] {
  return completionOrder.slice(completionOrder.indexOf(gate));
}