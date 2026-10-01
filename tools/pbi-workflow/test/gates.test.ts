import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseWorkflowConfigYaml } from "../src/config.js";
import { parseGateRecords, projectGateLabels, renderGateRecord } from "../src/gates.js";
import type { GateRecord } from "../src/state.js";

const runId = "00000000-0000-4000-8000-000000000001";
const shaA = "a".repeat(40);
const shaB = "b".repeat(40);
const record = (gate: GateRecord["gate"], headSha = shaA, verdict: GateRecord["verdict"] = "pass"): GateRecord => ({ gate, headSha, runId, verdict, evidence: ["evidence"], findings: [] });

async function config() {
  return parseWorkflowConfigYaml(await readFile(new URL("./fixtures/config/valid.yaml", import.meta.url), "utf8"));
}

describe("SHA-bound gates", () => {
  it("round-trips immutable structured gate markers", () => {
    const qa = record("qa");
    expect(parseGateRecords(renderGateRecord(qa))).toEqual([qa]);
  });

  it("projects only passing current-head labels", async () => {
    const projection = projectGateLabels([
      record("documentation"), record("qa"), record("demo-preparation", shaA, "not-applicable"),
    ], shaA, await config());
    expect(projection.labelsToAdd).toEqual(expect.arrayContaining([
      "gate/documentation-passed", "gate/qa-passed", "gate/demo-not-applicable",
    ]));
    expect(projection.labelsToAdd).not.toContain("gate/demo-approved");
  });

  it("invalidates every stale projection after the PBI head changes", async () => {
    const projection = projectGateLabels([
      record("documentation"), record("qa"), record("demo-preparation"), record("demo-approval"),
    ], shaB, await config());
    expect(projection.currentRecords).toEqual([]);
    expect(projection.staleRecords).toHaveLength(4);
    expect(projection.labelsToAdd).toEqual([]);
    expect(projection.labelsToRemove).toEqual(expect.arrayContaining([
      "gate/documentation-passed", "gate/qa-passed", "gate/demo-ready", "gate/demo-approved",
    ]));
  });
});