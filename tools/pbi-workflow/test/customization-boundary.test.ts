import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const repositoryFile = (path: string) =>
  readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

describe("OpenSpec customization ownership", () => {
  it("keeps PBI proposal overrides out of generated OpenSpec files", async () => {
    const [skill, prompt] = await Promise.all([
      repositoryFile(".github/skills/openspec-propose/SKILL.md"),
      repositoryFile(".github/prompts/opsx-propose.prompt.md"),
    ]);

    for (const generated of [skill, prompt]) {
      expect(generated).not.toContain("When the selected schema is `pbi-driven`");
      expect(generated).not.toContain("deterministic PBI identity rules");
    }
  });

  it("stores the PBI proposal override in repository-owned instructions", async () => {
    const instructions = await repositoryFile(".github/copilot-instructions.md");

    expect(instructions).toContain("Do not edit generated OpenSpec customizations");
    expect(instructions).toContain("When `/opsx-propose` selects the `pbi-driven` schema");
    expect(instructions).toContain("Never create a duplicate or unlinked change");
  });
});