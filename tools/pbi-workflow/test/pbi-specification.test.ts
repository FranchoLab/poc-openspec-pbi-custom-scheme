import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { NodeCommandRunner } from "../src/commands.js";

const fixtureRoot = dirname(fileURLToPath(new URL("./fixtures/specification/package.json", import.meta.url)));
const specUrl = new URL("./fixtures/specification/openspec/changes/pbi-42-release-notes/specs/release-notes/spec.md", import.meta.url);

describe("PBI specification output", () => {
  it("passes strict OpenSpec validation", async () => {
    const result = await new NodeCommandRunner().run({
      executable: "openspec",
      args: ["validate", "pbi-42-release-notes", "--strict", "--json"],
      cwd: fixtureRoot,
    });
    expect(result.exitCode, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      summary: { totals: { failed: 0, passed: 1 } },
      items: [{ id: "pbi-42-release-notes", type: "change", valid: true, issues: [] }],
    });
  }, 15_000);

  it("contains behavior without copying operational task state", async () => {
    const spec = await readFile(specUrl, "utf8");
    expect(spec).toContain("The system SHALL");
    expect(spec).not.toMatch(/\b(?:T\d{2}|assignee|blocked by|branch|claim|pull request|agent-in-progress)\b/iu);
  });
});