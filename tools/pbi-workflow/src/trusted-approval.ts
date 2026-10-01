export interface LabelHistoryEvent {
  readonly action: "labeled" | "unlabeled";
  readonly label: string;
  readonly createdAt: string;
  readonly actor: { readonly login: string; readonly type: string } | null;
}

export interface TrustedLabelApproval {
  readonly approvedBy: string;
  readonly approvedAt: string;
}

export class TrustedApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrustedApprovalError";
  }
}

function timestamp(value: string, field: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new TrustedApprovalError(`Invalid ${field} timestamp: ${value}`);
  return result;
}

export function requireTrustedLabelApproval(
  events: readonly LabelHistoryEvent[],
  label: string,
  trustedApprovers: readonly string[],
  evidenceUpdatedAt: string,
): TrustedLabelApproval {
  const matching = events
    .filter((event) => event.label === label)
    .map((event, index) => ({ event, index, time: timestamp(event.createdAt, "label event") }))
    .sort((left, right) => left.time - right.time || left.index - right.index);
  const latest = matching.at(-1)?.event;
  if (latest === undefined || latest.action !== "labeled") {
    throw new TrustedApprovalError(`Required label ${label} is not currently applied`);
  }
  if (timestamp(latest.createdAt, "label event") < timestamp(evidenceUpdatedAt, "evidence update")) {
    throw new TrustedApprovalError(`Label ${label} predates the current evidence`);
  }
  const trusted = new Set(trustedApprovers.map((login) => login.toLowerCase()));
  if (latest.actor?.type !== "User" || !trusted.has(latest.actor.login.toLowerCase())) {
    throw new TrustedApprovalError(`Label ${label} was not applied by a trusted human`);
  }
  return { approvedBy: latest.actor.login, approvedAt: latest.createdAt };
}