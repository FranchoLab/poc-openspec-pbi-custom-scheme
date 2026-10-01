import { readFile } from "node:fs/promises";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { parseWorkflowConfigYaml } from "../src/config.js";
import { validateQaReport } from "../src/qa.js";

async function config() {
  return parseWorkflowConfigYaml(await readFile(new URL("./fixtures/config/valid.yaml", import.meta.url), "utf8"));
}

function report() {
  const enabled = (category: string, command: string) => ({ category, status: "pass", command, evidence: [`${category} passed`] });
  return {
    headSha: "a".repeat(40), verdict: "pass",
    commands: [
      enabled("install", "npm ci"),
      { category: "format", status: "disabled", reason: "This repository has no standalone format check", evidence: [] },
      enabled("lint", "npm run lint"), enabled("typecheck", "npm run build"), enabled("test", "npm test"), enabled("build", "npm run build"),
    ],
    acceptanceCriteria: [{ id: "AC01", status: "pass", evidence: ["acceptance test"] }],
    specScenarios: [{ id: "S01", status: "pass", evidence: ["scenario test"] }], findings: [],
  };
}

describe("QA gate", () => {
  it("accepts complete configured checks and trace evidence", async () => {
    expect(validateQaReport(report(), await config(), ["AC01"], ["S01"]).verdict).toBe("pass");
  });

  it("requires exact configured reasons for disabled checks", async () => {
    const invalid = report();
    invalid.commands[1] = { category: "format", status: "disabled", reason: "Skipped", evidence: [] };
    const workflowConfig = await config();
    expect(() => validateQaReport(invalid, workflowConfig, ["AC01"], ["S01"]))
      .toThrow(/reason/u);
  });

  it("rejects missing acceptance or scenario evidence", async () => {
    const workflowConfig = await config();
    expect(() => validateQaReport(report(), workflowConfig, ["AC01", "AC02"], ["S01"]))
      .toThrow(/AC02/u);
  });

  it("configures QA without edit or subagent tools", async () => {
    const source = await readFile(new URL("../../../.github/agents/pbi-qa.agent.md", import.meta.url), "utf8");
    const frontmatter = parse(source.split("---")[1] ?? "") as { tools?: string[] };
    expect(frontmatter.tools).toEqual(["read", "search", "execute"]);
    expect(frontmatter.tools).not.toEqual(expect.arrayContaining(["edit", "agent"]));
  });
});