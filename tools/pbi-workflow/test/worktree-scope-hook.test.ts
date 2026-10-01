import { spawn } from "node:child_process";

import { describe, expect, it } from "vitest";

const hook = new URL("../../../.github/hooks/pbi-worktree-scope.mjs", import.meta.url);

async function invoke(payload: object): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hook.pathname], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(JSON.parse(stdout) as Record<string, unknown>) : reject(new Error(stderr)));
    child.stdin.end(JSON.stringify(payload));
  });
}

function decision(output: Record<string, unknown>): string | undefined {
  return (output.hookSpecificOutput as { permissionDecision?: string } | undefined)?.permissionDecision;
}

describe("pbi implementer worktree hook", () => {
  it("allows edits inside the assigned managed worktree", async () => {
    const output = await invoke({
      toolName: "apply_patch",
      cwd: "/repo/.pbi-worktrees/pbi-42/101-task",
      toolInput: { filePath: "src/feature.ts" },
    });
    expect(decision(output)).toBe("allow");
  });

  it("denies edits outside the assigned worktree", async () => {
    const output = await invoke({
      toolName: "edit",
      cwd: "/repo/.pbi-worktrees/pbi-42/101-task",
      toolInput: { filePath: "../../../../README.md" },
    });
    expect(decision(output)).toBe("deny");
  });

  it("denies writes when the session is not rooted in a managed worktree", async () => {
    const output = await invoke({
      toolName: "create_file",
      cwd: "/repo",
      toolInput: { filePath: "/repo/src/feature.ts" },
    });
    expect(decision(output)).toBe("deny");
  });

  it("allows read-only tools without path restrictions", async () => {
    expect(await invoke({ toolName: "read_file", cwd: "/repo", toolInput: { filePath: "/repo/README.md" } }))
      .toEqual({ continue: true });
  });
});