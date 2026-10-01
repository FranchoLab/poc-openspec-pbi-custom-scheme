import { describe, expect, it } from "vitest";

import {
  PbiRevisionConflictError,
  TechnicalContractError,
  approveTechnicalContract,
  computePbiRevision,
  isContractApprovalCurrent,
  updateTechnicalContract,
} from "../src/technical-contract.js";
import type { TechnicalContract } from "../src/technical-contract.js";

const contract: TechnicalContract = {
  changeName: "pbi-42-release-notes",
  decisions: ["Generate notes from merged pull requests"],
  alternatives: ["Manual notes were rejected because they drift"],
  constraints: ["Use existing GitHub permissions"],
  risks: ["Uncategorized changes reduce readability"],
  verification: ["Exercise tagged releases with and without eligible changes"],
  slices: [{ id: "T01", title: "Generate categorized notes", outcome: "A tagged release receives deterministic notes." }],
};

describe("Technical Contract", () => {
  it("preserves PO content and invalidates every revision-bound gate after an update", () => {
    const original = "## User Story\n\nAs a maintainer, I want notes, so that users understand releases.\n";
    const result = updateTechnicalContract(original, computePbiRevision(original), contract);
    expect(result.body).toContain(original.trim());
    expect(result.body).toContain("pbi-workflow:v1:technical-contract:pbi:start");
    expect(result.invalidatedGates).toEqual(["contract", "documentation", "qa", "demo-preparation", "demo-approval"]);
  });

  it("stops on optimistic revision conflict before changing content", () => {
    expect(() => updateTechnicalContract("new body", computePbiRevision("old body"), contract))
      .toThrow(PbiRevisionConflictError);
  });

  it("requires existing stable slice identities to be retained", () => {
    const first = updateTechnicalContract("PBI", computePbiRevision("PBI"), contract);
    const changed = { ...contract, slices: [{ id: "T01", title: "Different slice", outcome: "Changed" }] };
    expect(() => updateTechnicalContract(first.body, first.revision, changed))
      .toThrow(TechnicalContractError);
  });

  it("accepts only trusted approval for the current revision", () => {
    const result = updateTechnicalContract("PBI", computePbiRevision("PBI"), contract);
    const events = [{ action: "labeled" as const, label: "gate/contract-approved", createdAt: "2026-10-01T00:01:00Z", actor: { login: "lead", type: "User" } }];
    const approval = approveTechnicalContract(result.revision, result.revision, events, "gate/contract-approved", ["lead"], "2026-10-01T00:00:00Z");
    expect(isContractApprovalCurrent(approval, result.body)).toBe(true);
    expect(isContractApprovalCurrent(approval, `${result.body}\nPO edit`)).toBe(false);
    expect(() => approveTechnicalContract(result.revision, result.revision, [{ ...events[0]!, actor: { login: "agent", type: "Bot" } }], "gate/contract-approved", ["lead"], "2026-10-01T00:00:00Z"))
      .toThrow(/trusted human/u);
  });
});