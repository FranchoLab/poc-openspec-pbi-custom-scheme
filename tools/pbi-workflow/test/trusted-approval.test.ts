import { describe, expect, it } from "vitest";

import { requireTrustedLabelApproval } from "../src/trusted-approval.js";

const label = "gate/contract-approved";

describe("trusted label approval", () => {
  it("uses the latest label event and rejects stale or automated applications", () => {
    const trusted = { action: "labeled" as const, label, createdAt: "2026-10-01T00:02:00Z", actor: { login: "Lead", type: "User" } };
    expect(requireTrustedLabelApproval([trusted], label, ["lead"], "2026-10-01T00:01:00Z").approvedBy).toBe("Lead");
    expect(() => requireTrustedLabelApproval([{ ...trusted, createdAt: "2026-09-30T23:59:00Z" }], label, ["lead"], "2026-10-01T00:01:00Z"))
      .toThrow(/predates/u);
    expect(() => requireTrustedLabelApproval([{ ...trusted, actor: { login: "lead", type: "Bot" } }], label, ["lead"], "2026-10-01T00:01:00Z"))
      .toThrow(/trusted human/u);
    expect(() => requireTrustedLabelApproval([trusted, { ...trusted, action: "unlabeled", createdAt: "2026-10-01T00:03:00Z" }], label, ["lead"], "2026-10-01T00:01:00Z"))
      .toThrow(/not currently applied/u);
  });
});