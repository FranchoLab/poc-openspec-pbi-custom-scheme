import { describe, expect, it } from "vitest";

import { createClaim, isClaimStale, parseClaims, renderClaim, resolveOwnership } from "../src/claims.js";

const now = new Date("2026-10-01T12:00:00.000Z");
const runA = "00000000-0000-4000-8000-00000000000a";
const runB = "00000000-0000-4000-8000-00000000000b";

describe("claim leases", () => {
  it("uses the configurable 120-minute default and round-trips structured markers", () => {
    const claim = createClaim(runA, "pbi-orchestrator", "feature/pbi-42-release-notes", now);
    expect(claim.leaseExpiresAt).toBe("2026-10-01T14:00:00.000Z");
    expect(parseClaims(renderClaim(claim))).toEqual([claim]);
  });

  it("resumes the same owner after a local session restart", () => {
    const claim = createClaim(runA, "pbi-orchestrator", "feature/pbi-42-release-notes", now);
    const resolution = resolveOwnership([claim], runA, new Date("2026-10-01T13:00:00Z"));
    expect(resolution.decision).toBe("resume");
    expect(resolution.owner?.runId).toBe(runA);
  });

  it("rejects a competing run while a valid owner exists", () => {
    const claim = createClaim(runA, "pbi-orchestrator", "feature/pbi-42-release-notes", now);
    expect(resolveOwnership([claim], runB, new Date("2026-10-01T13:00:00Z"))).toMatchObject({
      decision: "contended",
      owner: { runId: runA },
    });
  });

  it("chooses one deterministic owner when colliding claims are observed", () => {
    const claimB = createClaim(runB, "pbi-orchestrator", "feature/pbi-42-release-notes", now);
    const claimA = createClaim(runA, "pbi-orchestrator", "feature/pbi-42-release-notes", now);
    const resolution = resolveOwnership([claimB, claimA], runB, new Date("2026-10-01T12:01:00Z"));
    expect(resolution.decision).toBe("contended");
    expect(resolution.owner?.runId).toBe(runA);
    expect(resolution.competingClaims.map(({ runId }) => runId)).toEqual([runB]);
  });

  it("marks expired claims stale and permits acquisition", () => {
    const claim = createClaim(runA, "pbi-orchestrator", "feature/pbi-42-release-notes", now, 5);
    const later = new Date("2026-10-01T12:05:00Z");
    expect(isClaimStale(claim, later)).toBe(true);
    expect(resolveOwnership([claim], runB, later)).toEqual({
      decision: "acquire",
      staleClaims: [claim],
      competingClaims: [],
    });
  });
});