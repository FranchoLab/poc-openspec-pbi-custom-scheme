import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { reviewAcceptanceAndSpecs } from "../src/reviews.js";
import type { ComplianceReviewInput } from "../src/reviews.js";

async function fixture(name: string): Promise<ComplianceReviewInput> {
  return JSON.parse(await readFile(new URL(`./fixtures/reviews/${name}.json`, import.meta.url), "utf8")) as ComplianceReviewInput;
}

describe("acceptance and spec compliance review", () => {
  it("passes when every criterion and scenario has evidence within scope", async () => {
    expect(reviewAcceptanceAndSpecs(await fixture("compliant"))).toMatchObject({ verdict: "pass", findings: [] });
  });

  it("detects missing criteria, scope creep, and contradictory behavior", async () => {
    const result = reviewAcceptanceAndSpecs(await fixture("noncompliant"));
    expect(result.verdict).toBe("fail");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "acceptance", message: expect.stringContaining("Missing passing evidence for AC02") }),
      expect.objectContaining({ category: "spec-compliance", message: expect.stringContaining("contradicts S01") }),
      expect.objectContaining({ path: "src/unrelated-auth.ts", message: expect.stringContaining("outside") }),
    ]));
  });
});