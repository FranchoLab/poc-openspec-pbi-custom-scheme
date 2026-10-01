import { parseDocument } from "yaml";

import { ConfigValidationError } from "./config.js";

export interface SetupManifest {
  readonly configuration: string;
  readonly openSpecConfig: string;
  readonly issueTemplate: string;
  readonly skills: Readonly<Record<string, string>>;
  readonly agents: Readonly<Record<string, string>>;
  readonly labels: readonly string[];
}

export interface SetupTarget {
  readText(path: string): Promise<string | undefined>;
  writeText(path: string, content: string): Promise<void>;
  listLabels(): Promise<readonly string[]>;
  createLabel(name: string): Promise<void>;
}

export interface SetupReconciliationResult {
  readonly changedFiles: readonly string[];
  readonly createdLabels: readonly string[];
}

export class SetupConfirmationRequiredError extends Error {
  constructor() {
    super("Setup confirmation is required before repository mutation");
    this.name = "SetupConfirmationRequiredError";
  }
}

function assertManagedName(name: string, kind: "skill" | "agent"): void {
  const suffix = kind === "skill" ? "/SKILL.md" : ".agent.md";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name)) {
    throw new Error(`Invalid ${kind} name: ${name}`);
  }
  if (name.endsWith(suffix)) {
    throw new Error(`${kind} name must not include its managed path suffix`);
  }
}

function managedFiles(manifest: SetupManifest): ReadonlyMap<string, string> {
  const files = new Map<string, string>([
    [".github/pbi-workflow.yaml", manifest.configuration],
    ["openspec/config.yaml", selectOpenSpecSchema(manifest.openSpecConfig)],
    [".github/ISSUE_TEMPLATE/pbi.yml", manifest.issueTemplate],
  ]);

  for (const [name, content] of Object.entries(manifest.skills)) {
    assertManagedName(name, "skill");
    files.set(`.github/skills/${name}/SKILL.md`, content);
  }
  for (const [name, content] of Object.entries(manifest.agents)) {
    assertManagedName(name, "agent");
    files.set(`.github/agents/${name}.agent.md`, content);
  }
  return files;
}

export function selectOpenSpecSchema(
  source: string,
  schema = "pbi-driven",
): string {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new ConfigValidationError(
      document.errors.map((error) => ({ path: "$", message: error.message })),
    );
  }
  const value = document.toJS({ maxAliasCount: 0 });
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ConfigValidationError([
      { path: "$", message: "OpenSpec configuration must be a mapping" },
    ]);
  }
  document.set("schema", schema);
  return document.toString({ lineWidth: 0 });
}

export async function reconcileSetup(
  target: SetupTarget,
  manifest: SetupManifest,
  confirmed: boolean,
): Promise<SetupReconciliationResult> {
  if (!confirmed) {
    throw new SetupConfirmationRequiredError();
  }

  const desiredFiles = managedFiles(manifest);
  const paths = [...desiredFiles.keys()];
  const [currentFiles, currentLabels] = await Promise.all([
    Promise.all(paths.map((path) => target.readText(path))),
    target.listLabels(),
  ]);
  const changedFiles = paths.filter(
    (path, index) => currentFiles[index] !== desiredFiles.get(path),
  );
  const existingLabels = new Set(currentLabels);
  const createdLabels = [...new Set(manifest.labels)].filter(
    (label) => !existingLabels.has(label),
  );

  for (const path of changedFiles) {
    await target.writeText(path, desiredFiles.get(path)!);
  }
  for (const label of createdLabels) {
    await target.createLabel(label);
  }

  return { changedFiles, createdLabels };
}