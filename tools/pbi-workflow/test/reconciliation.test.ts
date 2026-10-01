import { describe, expect, it } from "vitest";

import {
  ReconciliationError,
  planReconciliation,
} from "../src/reconciliation.js";

describe("planReconciliation", () => {
  it("plans create, update, unchanged, and immutable conflict actions", () => {
    expect(
      planReconciliation(
        [
          { key: "T01", content: "same", immutable: false },
          { key: "T02", content: "old", immutable: false },
          { key: "T03", content: "started", immutable: true },
        ],
        [
          { key: "T01", content: "same" },
          { key: "T02", content: "new" },
          { key: "T03", content: "changed" },
          { key: "T04", content: "create" },
        ],
      ),
    ).toEqual([
      { type: "unchanged", key: "T01" },
      { type: "update", key: "T02", content: "new" },
      {
        type: "conflict",
        key: "T03",
        existing: "started",
        desired: "changed",
      },
      { type: "create", key: "T04", content: "create" },
    ]);
  });

  it("is idempotent after applying desired content", () => {
    const desired = [
      { key: "T01", content: "one" },
      { key: "T02", content: "two" },
    ];
    const existing = desired.map((resource) => ({ ...resource, immutable: false }));

    expect(planReconciliation(existing, desired)).toEqual([
      { type: "unchanged", key: "T01" },
      { type: "unchanged", key: "T02" },
    ]);
  });

  it("rejects duplicate resource keys", () => {
    expect(() =>
      planReconciliation([], [
        { key: "T01", content: "one" },
        { key: "T01", content: "two" },
      ]),
    ).toThrow(ReconciliationError);
  });
});