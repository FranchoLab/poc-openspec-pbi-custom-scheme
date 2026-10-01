export interface PbiChangeResolution {
  readonly action: "create" | "resume";
  readonly changeName: string;
  readonly source: "derived" | "managed-link" | "existing-prefix";
}

export class PbiIdentityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PbiIdentityConflictError";
  }
}

export function derivePbiChangeName(issueNumber: number, title: string): string {
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new PbiIdentityConflictError(`Invalid PBI number: ${issueNumber}`);
  }
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60)
    .replace(/-+$/u, "");
  if (slug === "") throw new PbiIdentityConflictError("PBI title cannot produce a change slug");
  return `pbi-${issueNumber}-${slug}`;
}

export function resolvePbiChange(
  issueNumber: number,
  title: string,
  existingChanges: readonly string[],
  managedLink?: string,
): PbiChangeResolution {
  const prefix = `pbi-${issueNumber}-`;
  const matches = existingChanges.filter((name) => name.startsWith(prefix));
  if (managedLink !== undefined) {
    if (!managedLink.startsWith(prefix)) {
      throw new PbiIdentityConflictError(`Managed change ${managedLink} does not belong to PBI #${issueNumber}`);
    }
    if (!existingChanges.includes(managedLink)) {
      throw new PbiIdentityConflictError(`Managed change ${managedLink} does not exist`);
    }
    return { action: "resume", changeName: managedLink, source: "managed-link" };
  }
  if (matches.length > 1) {
    throw new PbiIdentityConflictError(`PBI #${issueNumber} has multiple changes: ${matches.join(", ")}`);
  }
  if (matches[0] !== undefined) {
    return { action: "resume", changeName: matches[0], source: "existing-prefix" };
  }
  return { action: "create", changeName: derivePbiChangeName(issueNumber, title), source: "derived" };
}