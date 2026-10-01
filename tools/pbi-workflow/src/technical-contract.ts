import { createHash } from "node:crypto";

import { parseManagedBlocks, upsertManagedBlock } from "./markers.js";
import type { GateName } from "./state.js";
import { requireTrustedLabelApproval } from "./trusted-approval.js";
import type { LabelHistoryEvent } from "./trusted-approval.js";

export interface ContractSlice {
  readonly id: string;
  readonly title: string;
  readonly outcome: string;
}

export interface TechnicalContract {
  readonly changeName: string;
  readonly decisions: readonly string[];
  readonly alternatives: readonly string[];
  readonly constraints: readonly string[];
  readonly risks: readonly string[];
  readonly verification: readonly string[];
  readonly slices: readonly ContractSlice[];
}

export interface ContractApproval {
  readonly approvedBy: string;
  readonly revision: string;
  readonly approvedAt: string;
}

export class PbiRevisionConflictError extends Error {
  constructor(readonly expected: string, readonly actual: string) {
    super(`PBI revision changed: expected ${expected}, received ${actual}`);
    this.name = "PbiRevisionConflictError";
  }
}

export class TechnicalContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TechnicalContractError";
  }
}

export function computePbiRevision(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function bullets(values: readonly string[]): string {
  return values.map((value) => `- ${value}`).join("\n");
}

function validateContract(contract: TechnicalContract, previousBody?: string): void {
  if (!/^pbi-\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(contract.changeName)) {
    throw new TechnicalContractError(`Invalid linked change name: ${contract.changeName}`);
  }
  for (const [name, values] of Object.entries({
    decisions: contract.decisions,
    alternatives: contract.alternatives,
    constraints: contract.constraints,
    risks: contract.risks,
    verification: contract.verification,
  })) {
    if (values.length === 0 || values.some((value) => value.trim() === "")) {
      throw new TechnicalContractError(`Technical Contract requires concrete ${name}`);
    }
  }
  const ids = contract.slices.map(({ id }) => id);
  if (ids.length === 0 || ids.some((id) => !/^T\d{2,}$/u.test(id)) || new Set(ids).size !== ids.length) {
    throw new TechnicalContractError("Delivery slices require unique stable IDs such as T01");
  }
  if (contract.slices.some(({ title, outcome }) => title.trim() === "" || outcome.trim() === "")) {
    throw new TechnicalContractError("Every delivery slice requires a title and outcome");
  }
  if (previousBody !== undefined) {
    const oldSlices = [...previousBody.matchAll(/^### (T\d{2,}): (.+)$/gmu)];
    for (const match of oldSlices) {
      const retained = contract.slices.find(({ id }) => id === match[1]);
      if (retained === undefined || retained.title !== match[2]) {
        throw new TechnicalContractError(`Stable slice ${match[1]} must retain its identity and title`);
      }
    }
  }
}

export function renderTechnicalContract(contract: TechnicalContract): string {
  return [
    "## Technical Contract",
    `OpenSpec change: \`${contract.changeName}\``,
    "### Decisions",
    bullets(contract.decisions),
    "### Alternatives",
    bullets(contract.alternatives),
    "### Constraints",
    bullets(contract.constraints),
    "### Risks",
    bullets(contract.risks),
    "### Verification Strategy",
    bullets(contract.verification),
    "### Delivery Slices",
    ...contract.slices.flatMap((slice) => [`### ${slice.id}: ${slice.title}`, slice.outcome]),
  ].join("\n\n");
}

export function updateTechnicalContract(
  currentBody: string,
  expectedRevision: string,
  contract: TechnicalContract,
): { readonly body: string; readonly revision: string; readonly invalidatedGates: readonly GateName[] } {
  const actualRevision = computePbiRevision(currentBody);
  if (actualRevision !== expectedRevision) throw new PbiRevisionConflictError(expectedRevision, actualRevision);
  const existing = parseManagedBlocks(currentBody).find((block) => block.kind === "technical-contract" && block.id === "pbi");
  validateContract(contract, existing?.body);
  const body = upsertManagedBlock(currentBody, "technical-contract", "pbi", renderTechnicalContract(contract));
  const changed = body !== currentBody;
  return {
    body,
    revision: computePbiRevision(body),
    invalidatedGates: changed ? ["contract", "documentation", "qa", "demo-preparation", "demo-approval"] : [],
  };
}

export function approveTechnicalContract(
  revision: string,
  observedRevision: string,
  events: readonly LabelHistoryEvent[],
  approvalLabel: string,
  trustedApprovers: readonly string[],
  revisionUpdatedAt: string,
): ContractApproval {
  if (revision !== observedRevision) throw new PbiRevisionConflictError(revision, observedRevision);
  const approval = requireTrustedLabelApproval(events, approvalLabel, trustedApprovers, revisionUpdatedAt);
  return { ...approval, revision };
}

export function isContractApprovalCurrent(approval: ContractApproval | undefined, currentBody: string): boolean {
  return approval !== undefined && approval.revision === computePbiRevision(currentBody);
}