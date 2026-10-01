import { z } from "zod";

export const reviewFindingSchema = z
  .object({
    id: z.string().regex(/^F\d{2,}$/u),
    severity: z.enum(["blocking", "major", "minor"]),
    category: z.enum(["standards", "acceptance", "spec-compliance"]),
    path: z.string().min(1),
    line: z.number().int().positive().optional(),
    message: z.string().min(1),
    recommendation: z.string().min(1),
  })
  .strict();

export const reviewResultSchema = z
  .object({
    reviewer: z.string().min(1),
    headSha: z.string().regex(/^[0-9a-f]{40}$/u),
    review: z.enum(["standards", "acceptance-spec"]),
    verdict: z.enum(["pass", "fail"]),
    findings: z.array(reviewFindingSchema),
    evidence: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((result, context) => {
    const blocking = result.findings.some((finding) => finding.severity === "blocking");
    if ((result.verdict === "pass" && blocking) || (result.verdict === "fail" && !blocking)) {
      context.addIssue({ code: "custom", path: ["verdict"], message: "Verdict must match the presence of blocking findings" });
    }
    const expectedCategory = result.review === "standards" ? "standards" : undefined;
    if (expectedCategory !== undefined && result.findings.some((finding) => finding.category !== expectedCategory)) {
      context.addIssue({ code: "custom", path: ["findings"], message: "Standards reviews may contain only standards findings" });
    }
  });

export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;

export function parseReviewResult(input: unknown): ReviewResult {
  return reviewResultSchema.parse(input);
}

export interface ComplianceTarget {
  readonly id: string;
  readonly text: string;
}

export interface ComplianceEvidence {
  readonly targetId: string;
  readonly status: "pass" | "fail";
  readonly evidence: string;
}

export interface ComplianceReviewInput {
  readonly headSha: string;
  readonly acceptanceCriteria: readonly ComplianceTarget[];
  readonly scenarios: readonly ComplianceTarget[];
  readonly evidence: readonly ComplianceEvidence[];
  readonly changedPaths: readonly string[];
  readonly allowedPathPrefixes: readonly string[];
}

export function reviewAcceptanceAndSpecs(input: ComplianceReviewInput): ReviewResult {
  const findings: ReviewFinding[] = [];
  let sequence = 1;
  const add = (finding: Omit<ReviewFinding, "id">): void => {
    findings.push({ id: `F${String(sequence++).padStart(2, "0")}`, ...finding });
  };
  for (const criterion of input.acceptanceCriteria) {
    const evidence = input.evidence.filter(({ targetId }) => targetId === criterion.id);
    if (!evidence.some(({ status }) => status === "pass")) {
      add({ severity: "blocking", category: "acceptance", path: "PBI acceptance criteria", message: `Missing passing evidence for ${criterion.id}: ${criterion.text}`, recommendation: `Add a focused test or reproducible verification for ${criterion.id}` });
    }
  }
  for (const scenario of input.scenarios) {
    const evidence = input.evidence.filter(({ targetId }) => targetId === scenario.id);
    if (evidence.some(({ status }) => status === "fail")) {
      add({ severity: "blocking", category: "spec-compliance", path: "OpenSpec scenario", message: `Observed behavior contradicts ${scenario.id}: ${scenario.text}`, recommendation: `Correct the implementation or return to approved refinement before changing the scenario` });
    } else if (!evidence.some(({ status }) => status === "pass")) {
      add({ severity: "blocking", category: "spec-compliance", path: "OpenSpec scenario", message: `Missing evidence for ${scenario.id}: ${scenario.text}`, recommendation: `Add verification that exercises ${scenario.id}` });
    }
  }
  for (const path of input.changedPaths) {
    if (!input.allowedPathPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      add({ severity: "blocking", category: "acceptance", path, message: "Changed path is outside the assigned delivery-slice scope", recommendation: "Revert the unrelated change or obtain an approved scope revision" });
    }
  }
  return parseReviewResult({
    reviewer: "pbi-reviewer",
    headSha: input.headSha,
    review: "acceptance-spec",
    verdict: findings.some(({ severity }) => severity === "blocking") ? "fail" : "pass",
    findings,
    evidence: input.evidence.map(({ targetId, evidence }) => `${targetId}: ${evidence}`),
  });
}