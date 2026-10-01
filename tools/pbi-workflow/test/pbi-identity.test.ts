import { describe, expect, it } from "vitest";

import { PbiIdentityConflictError, derivePbiChangeName, resolvePbiChange } from "../src/pbi-identity.js";

describe("PBI change identity", () => {
  it("derives the required stable prefix and normalized slug", () => {
    expect(derivePbiChangeName(42, "Résumé: Release Notes!"))
      .toBe("pbi-42-resume-release-notes");
  });

  it("creates only when no linked or matching change exists", () => {
    expect(resolvePbiChange(42, "Release notes", ["other-change"])).toEqual({
      action: "create",
      changeName: "pbi-42-release-notes",
      source: "derived",
    });
  });

  it("resumes a managed link even when the PBI title changed", () => {
    expect(resolvePbiChange(42, "New title", ["pbi-42-old-title"], "pbi-42-old-title"))
      .toEqual({ action: "resume", changeName: "pbi-42-old-title", source: "managed-link" });
  });

  it("resumes the unique matching prefix instead of creating a duplicate", () => {
    expect(resolvePbiChange(42, "New title", ["pbi-42-old-title"]).action).toBe("resume");
  });

  it("stops on broken links or ambiguous existing changes", () => {
    expect(() => resolvePbiChange(42, "Title", [], "pbi-42-missing"))
      .toThrow(PbiIdentityConflictError);
    expect(() => resolvePbiChange(42, "Title", ["pbi-42-one", "pbi-42-two"]))
      .toThrow(PbiIdentityConflictError);
  });
});