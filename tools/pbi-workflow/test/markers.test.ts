import { describe, expect, it } from "vitest";

import {
  ManagedMarkerError,
  parseManagedBlocks,
  renderManagedBlock,
  upsertManagedBlock,
} from "../src/markers.js";

describe("managed markers", () => {
  it("renders and parses a versioned block", () => {
    const source = renderManagedBlock("slice", "T01", "## Outcome\nShip it");

    expect(parseManagedBlocks(source)).toEqual([
      expect.objectContaining({
        kind: "slice",
        id: "T01",
        body: "## Outcome\nShip it",
      }),
    ]);
  });

  it("updates only the selected managed region", () => {
    const source = `PO content\n\n${renderManagedBlock("technical-contract", "pbi-42", "old")}\n\nFooter`;
    const updated = upsertManagedBlock(
      source,
      "technical-contract",
      "pbi-42",
      "new",
    );

    expect(updated).toContain("PO content");
    expect(updated).toContain("Footer");
    expect(updated).toContain("\nnew\n");
    expect(updated).not.toContain("\nold\n");
    expect(upsertManagedBlock(updated, "technical-contract", "pbi-42", "new")).toBe(
      updated,
    );
  });

  it.each([
    "<!-- pbi-workflow:v1:slice:T01:end -->",
    "<!-- pbi-workflow:v1:slice:T01:start -->\nmissing end",
    `${renderManagedBlock("slice", "T01", "one")}\n${renderManagedBlock("slice", "T01", "two")}`,
    "<!-- pbi-workflow:v2:slice:T01:start -->\nx\n<!-- pbi-workflow:v2:slice:T01:end -->",
  ])("rejects malformed input", (source) => {
    expect(() => parseManagedBlocks(source)).toThrow(ManagedMarkerError);
  });
});