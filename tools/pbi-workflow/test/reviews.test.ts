import { readFile } from "node:fs/promises";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { parseReviewResult } from "../src/reviews.js";

describe("structured reviews", () => {
  it("accepts standards findings whose verdict matches blocking severity", () => {
    const result = parseReviewResult({
      reviewer: "pbi-reviewer",
      headSha: "a".repeat(40),
      review: "standards",
      verdict: "fail",
      findings: [{ id: "F01", severity: "blocking", category: "standards", path: "src/release.ts", line: 12, message: "Error is swallowed", recommendation: "Return the failure to the caller" }],
      evidence: ["src/release.ts:12"],
    });
    expect(result.verdict).toBe("fail");
  });

  it("rejects passing results with blocking findings", () => {
    expect(() => parseReviewResult({
      reviewer: "pbi-reviewer",
      headSha: "a".repeat(40),
      review: "standards",
      verdict: "pass",
      findings: [{ id: "F01", severity: "blocking", category: "standards", path: "src/release.ts", message: "Failure", recommendation: "Fix it" }],
      evidence: ["diff"],
    })).toThrow();
  });

  it("configures the reviewer without edit, execute, agent, or web tools", async () => {
    const source = await readFile(new URL("../../../.github/agents/pbi-reviewer.agent.md", import.meta.url), "utf8");
    const frontmatter = parse(source.split("---")[1] ?? "") as { tools?: string[] };
    expect(frontmatter.tools).toEqual(["read", "search"]);
    expect(frontmatter.tools).not.toEqual(expect.arrayContaining(["edit", "execute", "agent", "web"]));
  });
});