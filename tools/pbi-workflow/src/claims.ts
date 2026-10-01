import { z } from "zod";

import { parseManagedBlocks, renderManagedBlock } from "./markers.js";
import type { Claim } from "./state.js";

const claimSchema = z
  .object({
    runId: z.uuid(),
    agent: z.string().min(1),
    branch: z.string().min(1),
    startedAt: z.iso.datetime(),
    leaseExpiresAt: z.iso.datetime(),
  })
  .strict();

export interface OwnershipResolution {
  readonly decision: "acquire" | "resume" | "contended";
  readonly owner?: Claim;
  readonly staleClaims: readonly Claim[];
  readonly competingClaims: readonly Claim[];
}

export class ClaimValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimValidationError";
  }
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new ClaimValidationError(`Invalid claim timestamp: ${value}`);
  return parsed;
}

export function createClaim(
  runId: string,
  agent: string,
  branch: string,
  startedAt: Date,
  leaseMinutes = 120,
): Claim {
  if (!Number.isInteger(leaseMinutes) || leaseMinutes < 5 || leaseMinutes > 1440) {
    throw new ClaimValidationError(`Lease minutes must be between 5 and 1440: ${leaseMinutes}`);
  }
  const claim = {
    runId,
    agent,
    branch,
    startedAt: startedAt.toISOString(),
    leaseExpiresAt: new Date(startedAt.getTime() + leaseMinutes * 60_000).toISOString(),
  };
  const parsed = claimSchema.safeParse(claim);
  if (!parsed.success) throw new ClaimValidationError(z.prettifyError(parsed.error));
  return parsed.data;
}

export function isClaimStale(claim: Claim, now: Date): boolean {
  return timestamp(claim.leaseExpiresAt) <= now.getTime();
}

export function renderClaim(claim: Claim): string {
  const parsed = claimSchema.safeParse(claim);
  if (!parsed.success) throw new ClaimValidationError(z.prettifyError(parsed.error));
  return renderManagedBlock("claim", claim.runId, JSON.stringify(parsed.data));
}

export function parseClaims(source: string): readonly Claim[] {
  return parseManagedBlocks(source)
    .filter((block) => block.kind === "claim")
    .map((block) => {
      let value: unknown;
      try {
        value = JSON.parse(block.body);
      } catch {
        throw new ClaimValidationError(`Claim ${block.id} is not valid JSON`);
      }
      const parsed = claimSchema.safeParse(value);
      if (!parsed.success) throw new ClaimValidationError(`Invalid claim ${block.id}: ${z.prettifyError(parsed.error)}`);
      if (parsed.data.runId !== block.id) throw new ClaimValidationError(`Claim marker ${block.id} does not match run ${parsed.data.runId}`);
      return parsed.data;
    });
}

export function resolveOwnership(
  claims: readonly Claim[],
  requestingRunId: string,
  now: Date,
): OwnershipResolution {
  const validated = claims.map((claim) => {
    const parsed = claimSchema.safeParse(claim);
    if (!parsed.success) throw new ClaimValidationError(z.prettifyError(parsed.error));
    return parsed.data;
  });
  const staleClaims = validated.filter((claim) => isClaimStale(claim, now));
  const active = validated
    .filter((claim) => !isClaimStale(claim, now))
    .sort((left, right) => timestamp(left.startedAt) - timestamp(right.startedAt) || left.runId.localeCompare(right.runId));
  const owner = active[0];
  if (owner === undefined) {
    return { decision: "acquire", staleClaims, competingClaims: [] };
  }
  return {
    decision: owner.runId === requestingRunId ? "resume" : "contended",
    owner,
    staleClaims,
    competingClaims: active.slice(1),
  };
}