import { z } from "zod";

import type { WorkflowConfig } from "./config.js";

const verificationCategories = ["install", "format", "lint", "typecheck", "test", "build"] as const;

const commandResultSchema = z.object({
  category: z.enum(verificationCategories),
  status: z.enum(["pass", "fail", "disabled"]),
  command: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  evidence: z.array(z.string().min(1)),
}).strict();

const traceSchema = z.object({ id: z.string().min(1), status: z.enum(["pass", "fail"]), evidence: z.array(z.string().min(1)).min(1) }).strict();

export const qaReportSchema = z.object({
  headSha: z.string().regex(/^[0-9a-f]{40}$/u),
  verdict: z.enum(["pass", "fail"]),
  commands: z.array(commandResultSchema),
  acceptanceCriteria: z.array(traceSchema),
  specScenarios: z.array(traceSchema),
  findings: z.array(z.string().min(1)),
}).strict();

export type QaReport = z.infer<typeof qaReportSchema>;

export function validateQaReport(
  input: unknown,
  config: WorkflowConfig,
  criterionIds: readonly string[],
  scenarioIds: readonly string[],
): QaReport {
  const report = qaReportSchema.parse(input);
  const byCategory = new Map(report.commands.map((result) => [result.category, result]));
  for (const category of verificationCategories) {
    const configured = config.verification[category];
    const result = byCategory.get(category);
    if (result === undefined) throw new Error(`QA report omitted ${category}`);
    if (configured.enabled) {
      if (result.status === "disabled" || result.command !== configured.command || result.evidence.length === 0) {
        throw new Error(`QA result does not execute configured ${category} command`);
      }
    } else if (result.status !== "disabled" || result.reason !== configured.reason) {
      throw new Error(`QA disabled ${category} reason does not match configuration`);
    }
  }
  const assertTrace = (name: string, required: readonly string[], traces: QaReport["acceptanceCriteria"]): void => {
    const byId = new Map(traces.map((trace) => [trace.id, trace]));
    const missing = required.filter((id) => !byId.has(id));
    if (missing.length > 0) throw new Error(`QA report omitted ${name}: ${missing.join(", ")}`);
  };
  assertTrace("acceptance criteria", criterionIds, report.acceptanceCriteria);
  assertTrace("spec scenarios", scenarioIds, report.specScenarios);
  const failed = report.commands.some(({ status }) => status === "fail") || report.acceptanceCriteria.some(({ status }) => status === "fail") || report.specScenarios.some(({ status }) => status === "fail") || report.findings.length > 0;
  if ((report.verdict === "pass") === failed) throw new Error("QA verdict does not match command, trace, and finding results");
  return report;
}