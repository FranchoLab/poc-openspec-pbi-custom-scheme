import { readFile } from "node:fs/promises";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { validateDocumentationReview } from "../src/documentation-review.js";

describe("documentation review", () => {
  it("passes only when every changed document and concern is covered", () => {
    expect(validateDocumentationReview({
      headSha: "a".repeat(40),
      verdict: "pass",
      documents: [
        { path: "README.md", crossReferencesChecked: true, commandExamplesChecked: true, behaviorConsistent: true, findings: [] },
        { path: "docs/setup.md", crossReferencesChecked: true, commandExamplesChecked: true, behaviorConsistent: true, findings: [] },
      ],
    }, ["README.md", "docs/setup.md"]).verdict).toBe("pass");
  });

  it("rejects omitted documents and false passes over behavior conflicts", () => {
    expect(() => validateDocumentationReview({
      headSha: "a".repeat(40), verdict: "pass", documents: [],
    }, ["README.md"])).toThrow(/omitted/u);
    expect(() => validateDocumentationReview({
      headSha: "a".repeat(40),
      verdict: "pass",
      documents: [{ path: "README.md", crossReferencesChecked: true, commandExamplesChecked: true, behaviorConsistent: false, findings: ["Command uses a removed option"] }],
    }, ["README.md"])).toThrow(/verdict/u);
  });

  it("configures the documentation reviewer as read-only", async () => {
    const source = await readFile(new URL("../../../.github/agents/pbi-documentation-reviewer.agent.md", import.meta.url), "utf8");
    const frontmatter = parse(source.split("---")[1] ?? "") as { tools?: string[] };
    expect(frontmatter.tools).toEqual(["read", "search"]);
  });
});