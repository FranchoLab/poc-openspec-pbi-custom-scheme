import { describe, expect, it } from "vitest";

import { packageName, packageVersion } from "../src/index.js";

describe("package identity", () => {
  it("exposes a stable name and semantic version", () => {
    expect(packageName).toBe("@openspec/pbi-workflow");
    expect(packageVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});