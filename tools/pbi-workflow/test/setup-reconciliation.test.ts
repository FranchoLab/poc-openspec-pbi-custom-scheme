import { describe, expect, it } from "vitest";

import {
  SetupConfirmationRequiredError,
  reconcileSetup,
  selectOpenSpecSchema,
} from "../src/setup-reconciliation.js";
import type {
  SetupManifest,
  SetupTarget,
} from "../src/setup-reconciliation.js";

class SandboxTarget implements SetupTarget {
  readonly files = new Map<string, string>([["README.md", "keep me\n"]]);
  readonly labels = new Set(["bug", "pbi/refinement"]);
  readonly mutations: string[] = [];

  readText(path: string) {
    return Promise.resolve(this.files.get(path));
  }

  writeText(path: string, content: string) {
    this.mutations.push(`write:${path}`);
    this.files.set(path, content);
    return Promise.resolve();
  }

  listLabels() {
    return Promise.resolve([...this.labels]);
  }

  createLabel(name: string) {
    this.mutations.push(`label:${name}`);
    this.labels.add(name);
    return Promise.resolve();
  }
}

const manifest: SetupManifest = {
  configuration: "version: 1\n",
  openSpecConfig: "schema: spec-driven\ngithubCopilot:\n  cloudAgent: false\n",
  issueTemplate: "name: Product backlog item\n",
  skills: {
    "pbi-orchestrator": "---\nname: pbi-orchestrator\n---\n",
  },
  agents: {
    "pbi-reviewer": "---\nname: pbi-reviewer\n---\n",
  },
  labels: ["pbi/refinement", "agent-in-progress", "agent-in-progress"],
};

describe("selectOpenSpecSchema", () => {
  it("changes only the structured schema selection and converges", () => {
    const selected = selectOpenSpecSchema(manifest.openSpecConfig);

    expect(selected).toContain("schema: pbi-driven");
    expect(selected).toContain("cloudAgent: false");
    expect(selectOpenSpecSchema(selected)).toBe(selected);
  });
});

describe("reconcileSetup", () => {
  it("does not inspect or mutate the target before confirmation", async () => {
    const target = new SandboxTarget();

    await expect(reconcileSetup(target, manifest, false)).rejects.toBeInstanceOf(
      SetupConfirmationRequiredError,
    );
    expect(target.mutations).toEqual([]);
  });

  it("converges after two sandbox runs without duplicates or second-run diff", async () => {
    const target = new SandboxTarget();

    const first = await reconcileSetup(target, manifest, true);
    expect(first.changedFiles).toEqual([
      ".github/pbi-workflow.yaml",
      "openspec/config.yaml",
      ".github/ISSUE_TEMPLATE/pbi.yml",
      ".github/skills/pbi-orchestrator/SKILL.md",
      ".github/agents/pbi-reviewer.agent.md",
    ]);
    expect(first.createdLabels).toEqual(["agent-in-progress"]);
    expect(target.files.get("README.md")).toBe("keep me\n");
    expect(target.labels).toEqual(
      new Set(["bug", "pbi/refinement", "agent-in-progress"]),
    );

    target.mutations.length = 0;
    const second = await reconcileSetup(target, manifest, true);

    expect(second).toEqual({ changedFiles: [], createdLabels: [] });
    expect(target.mutations).toEqual([]);
  });
});