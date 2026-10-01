import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { NodeCommandRunner } from "../src/commands.js";
import { TaskPublicationNotVerifiedError, renderOrchestrationTask } from "../src/orchestration-task.js";

const fixtureRoot = dirname(fileURLToPath(new URL("./fixtures/specification/package.json", import.meta.url)));
const tasksUrl = new URL("./fixtures/specification/openspec/changes/pbi-42-release-notes/tasks.md", import.meta.url);

describe("PBI orchestration task", () => {
  it("refuses generation until task graph publication is verified", () => {
    expect(() => renderOrchestrationTask("https://github.com/acme/shop/issues/42", false))
      .toThrow(TaskPublicationNotVerifiedError);
  });

  it("renders exactly the fixture's single canonical PBI checkbox", async () => {
    const rendered = renderOrchestrationTask("https://github.com/acme/shop/issues/42", true);
    expect(rendered.trimEnd()).toBe((await readFile(tasksUrl, "utf8")).trimEnd());
    expect(rendered.endsWith("\n")).toBe(true);
    expect(rendered.match(/^- \[[ xX]\]/gmu)).toHaveLength(1);
  });

  it("makes OpenSpec report one pending task with generated specs in context", async () => {
    const result = await new NodeCommandRunner().run({
      executable: "openspec",
      args: ["instructions", "apply", "--change", "pbi-42-release-notes", "--json"],
      cwd: fixtureRoot,
    });
    expect(result.exitCode, result.stderr).toBe(0);
    const instructions = JSON.parse(result.stdout) as {
      progress: { total: number; complete: number; remaining: number };
      contextFiles: { specs: string[]; tasks: string[] };
      tasks: { done: boolean }[];
    };
    expect(instructions.progress).toEqual({ total: 1, complete: 0, remaining: 1 });
    expect(instructions.tasks).toEqual([{ id: "1", description: expect.any(String), done: false }]);
    expect(instructions.contextFiles.specs).toHaveLength(1);
    expect(instructions.contextFiles.specs[0]).toMatch(/specs\/release-notes\/spec\.md$/u);
  }, 15_000);
});