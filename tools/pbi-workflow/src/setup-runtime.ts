import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { parseWorkflowConfigYaml } from "./config.js";
import { CommandExecutionError, parseExternalJson, resolveRepositoryPath } from "./commands.js";
import type { CommandRunner } from "./commands.js";
import type { SetupManifest, SetupTarget } from "./setup-reconciliation.js";
import { z } from "zod";

const labelsSchema = z.array(z.object({ name: z.string() }).passthrough());

async function collectNamedFiles(
  root: string,
  kind: "skills" | "agents",
): Promise<Record<string, string>> {
  const directory = join(root, ".github", kind);
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.name.startsWith("pbi-") && (kind === "skills" ? entry.isDirectory() : entry.isFile()))
    .map((entry) => entry.name);
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => {
        const key = kind === "agents" ? name.replace(/\.agent\.md$/u, "") : name;
        const path = kind === "skills" ? join(directory, name, "SKILL.md") : join(directory, name);
        return [key, await readFile(path, "utf8")] as const;
      }),
    ),
  );
}

export async function loadSetupManifest(root: string): Promise<SetupManifest> {
  const configuration = await readFile(join(root, ".github/pbi-workflow.yaml"), "utf8");
  const config = parseWorkflowConfigYaml(configuration);
  const labelGroups = [config.labels.pbi, config.labels.task, config.labels.gate];
  return {
    configuration,
    openSpecConfig: await readFile(join(root, "openspec/config.yaml"), "utf8"),
    issueTemplate: await readFile(join(root, ".github/ISSUE_TEMPLATE/pbi.yml"), "utf8"),
    skills: await collectNamedFiles(root, "skills"),
    agents: await collectNamedFiles(root, "agents"),
    labels: labelGroups.flatMap((group) => Object.values(group)),
  };
}

export class RepositorySetupTarget implements SetupTarget {
  constructor(private readonly runner: CommandRunner, private readonly root: string) {}

  async readText(path: string): Promise<string | undefined> {
    try {
      return await readFile(resolveRepositoryPath(this.root, path), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async writeText(path: string, content: string): Promise<void> {
    const destination = resolveRepositoryPath(this.root, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content, "utf8");
  }

  async listLabels(): Promise<readonly string[]> {
    const result = await this.runner.run({ executable: "gh", args: ["label", "list", "--limit", "1000", "--json", "name"], cwd: this.root });
    if (result.exitCode !== 0) throw new CommandExecutionError("gh", result.exitCode, result.stderr);
    return parseExternalJson(result.stdout, labelsSchema, "GitHub labels").map(({ name }) => name);
  }

  async createLabel(name: string): Promise<void> {
    const result = await this.runner.run({ executable: "gh", args: ["label", "create", name], cwd: this.root });
    if (result.exitCode !== 0) throw new CommandExecutionError("gh", result.exitCode, result.stderr);
  }
}