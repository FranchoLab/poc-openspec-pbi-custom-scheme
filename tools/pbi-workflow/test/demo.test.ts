import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseWorkflowConfigYaml } from "../src/config.js";
import { approveDemo, validateDemoReport } from "../src/demo.js";

async function disabledConfig() {
  return parseWorkflowConfigYaml(await readFile(new URL("./fixtures/config/valid.yaml", import.meta.url), "utf8"));
}

describe("demo preparation", () => {
  it("reports disabled demos as justified not applicable rather than pass", async () => {
    const config = await disabledConfig();
    const report = validateDemoReport({
      headSha: "a".repeat(40), disposition: "not-applicable", readinessObserved: false,
      evidence: ["No interactive application entry point exists"], findings: [],
      justification: "This package has no interactive application",
    }, config);
    expect(report.disposition).toBe("not-applicable");
    expect(() => validateDemoReport({ ...report, disposition: "ready" }, config)).toThrow();
  });

  it("requires enabled demos to use configured startup and readiness values", async () => {
    const base = await disabledConfig();
    const config = { ...base, demo: { start: { enabled: true as const, command: "npm run demo" }, url: "http://localhost:3000", readinessUrl: "http://localhost:3000/ready", startupTimeoutSeconds: 60 } };
    expect(validateDemoReport({
      headSha: "b".repeat(40), disposition: "ready", startCommand: "npm run demo",
      url: "http://localhost:3000", readinessUrl: "http://localhost:3000/ready",
      readinessObserved: true, evidence: ["Demo screenshot and interaction log"], findings: [],
    }, config).disposition).toBe("ready");
    expect(() => validateDemoReport({
      headSha: "b".repeat(40), disposition: "ready", startCommand: "npm start",
      url: "http://localhost:3000", readinessObserved: true, evidence: ["evidence"], findings: [],
    }, config)).toThrow(/configured/u);
  });

  it("accepts demo approval only from current trusted human label history", () => {
    const headSha = "c".repeat(40);
    const event = { action: "labeled" as const, label: "gate/demo-approved", createdAt: "2026-10-01T00:01:00Z", actor: { login: "lead", type: "User" } };
    expect(approveDemo(headSha, headSha, [event], event.label, ["lead"], "2026-10-01T00:00:00Z").approvedBy).toBe("lead");
    expect(() => approveDemo(headSha, headSha, [{ ...event, actor: { login: "outsider", type: "User" } }], event.label, ["lead"], "2026-10-01T00:00:00Z"))
      .toThrow(/trusted human/u);
    expect(() => approveDemo(headSha, headSha, [{ ...event, action: "unlabeled" }], event.label, ["lead"], "2026-10-01T00:00:00Z"))
      .toThrow(/not currently applied/u);
  });
});