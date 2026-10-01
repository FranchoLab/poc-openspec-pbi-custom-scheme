import { resolve, sep } from "node:path";

let source = "";
for await (const chunk of process.stdin) source += chunk;

const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }));
};

let input;
try {
  input = JSON.parse(source);
} catch {
  deny("Cannot validate malformed tool input");
  process.exit(0);
}

const toolName = String(input.toolName ?? input.tool_name ?? "").toLowerCase();
if (!/(?:edit|apply.?patch|create|delete|rename)/u.test(toolName)) {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

const cwd = resolve(String(input.cwd ?? ""));
const marker = `${sep}.pbi-worktrees${sep}`;
if (!cwd.includes(marker)) {
  deny("The pbi-implementer session must run from its assigned managed worktree");
  process.exit(0);
}

const argumentsValue = input.toolInput ?? input.tool_input ?? input.arguments ?? {};
const paths = [];
const collectPaths = (value, key = "") => {
  if (typeof value === "string" && /(?:^|_)(?:path|file|filepath|directory)$/iu.test(key)) paths.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectPaths(item, key));
  else if (value !== null && typeof value === "object") Object.entries(value).forEach(([childKey, child]) => collectPaths(child, childKey));
};
collectPaths(argumentsValue);

if (paths.length === 0) {
  deny("Cannot prove that the write tool is scoped to the assigned worktree");
  process.exit(0);
}
const outside = paths.map((path) => resolve(cwd, path)).find((path) => path !== cwd && !path.startsWith(`${cwd}${sep}`));
if (outside !== undefined) {
  deny(`Write target is outside the assigned worktree: ${outside}`);
  process.exit(0);
}
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    permissionDecisionReason: "Write is inside the assigned managed worktree",
  },
}));