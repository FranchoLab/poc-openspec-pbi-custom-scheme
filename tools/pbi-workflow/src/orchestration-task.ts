export class TaskPublicationNotVerifiedError extends Error {
  constructor() {
    super("Cannot generate tasks.md before task graph publication is verified");
    this.name = "TaskPublicationNotVerifiedError";
  }
}

export function renderOrchestrationTask(
  pbiUrl: string,
  publicationVerified: boolean,
): string {
  if (!publicationVerified) throw new TaskPublicationNotVerifiedError();
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/u.test(pbiUrl)) {
    throw new Error(`Invalid canonical GitHub PBI URL: ${pbiUrl}`);
  }
  return [
    "# PBI Orchestration",
    "",
    `- [ ] 1.1 Run the PBI orchestrator for ${pbiUrl}`,
    "",
  ].join("\n");
}