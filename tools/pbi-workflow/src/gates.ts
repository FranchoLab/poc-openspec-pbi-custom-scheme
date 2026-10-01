import { z } from "zod";

import type { WorkflowConfig } from "./config.js";
import { parseManagedBlocks, renderManagedBlock } from "./markers.js";
import type { GateRecord } from "./state.js";

const gateRecordSchema = z.object({
  gate: z.enum(["contract", "documentation", "qa", "demo-preparation", "demo-approval"]),
  headSha: z.string().regex(/^[0-9a-f]{40}$/u),
  runId: z.uuid(),
  verdict: z.enum(["pass", "fail", "not-applicable"]),
  evidence: z.array(z.string().min(1)),
  findings: z.array(z.string().min(1)),
}).strict();

export interface GateProjection {
  readonly currentRecords: readonly GateRecord[];
  readonly staleRecords: readonly GateRecord[];
  readonly labelsToAdd: readonly string[];
  readonly labelsToRemove: readonly string[];
}

export function renderGateRecord(record: GateRecord): string {
  const parsed = gateRecordSchema.parse(record);
  const id = `${record.gate}-${record.headSha.slice(0, 12)}-${record.runId}`;
  return renderManagedBlock("gate", id, JSON.stringify(parsed));
}

export function parseGateRecords(source: string): readonly GateRecord[] {
  return parseManagedBlocks(source).filter((block) => block.kind === "gate").map((block) => gateRecordSchema.parse(JSON.parse(block.body)));
}

export function projectGateLabels(
  records: readonly GateRecord[],
  currentHeadSha: string,
  config: WorkflowConfig,
): GateProjection {
  const currentRecords = records.filter(({ headSha }) => headSha === currentHeadSha);
  const staleRecords = records.filter(({ headSha }) => headSha !== currentHeadSha);
  const allLabels = Object.values(config.labels.gate);
  const labels = new Set<string>();
  for (const record of currentRecords) {
    if (record.verdict === "fail") continue;
    if (record.gate === "contract" && record.verdict === "pass") labels.add(config.labels.gate.contractApproved);
    if (record.gate === "documentation" && record.verdict === "pass") labels.add(config.labels.gate.documentationPassed);
    if (record.gate === "qa" && record.verdict === "pass") labels.add(config.labels.gate.qaPassed);
    if (record.gate === "demo-preparation" && record.verdict === "pass") labels.add(config.labels.gate.demoReady);
    if (record.gate === "demo-preparation" && record.verdict === "not-applicable") labels.add(config.labels.gate.demoNotApplicable);
    if (record.gate === "demo-approval" && record.verdict === "pass") labels.add(config.labels.gate.demoApproved);
  }
  return {
    currentRecords,
    staleRecords,
    labelsToAdd: [...labels],
    labelsToRemove: allLabels.filter((label) => !labels.has(label)),
  };
}