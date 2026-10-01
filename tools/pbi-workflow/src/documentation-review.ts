import { z } from "zod";

const documentResultSchema = z
  .object({
    path: z.string().min(1),
    crossReferencesChecked: z.boolean(),
    commandExamplesChecked: z.boolean(),
    behaviorConsistent: z.boolean(),
    findings: z.array(z.string().min(1)),
  })
  .strict();

export const documentationReviewSchema = z
  .object({
    headSha: z.string().regex(/^[0-9a-f]{40}$/u),
    verdict: z.enum(["pass", "fail"]),
    documents: z.array(documentResultSchema),
  })
  .strict();

export type DocumentationReview = z.infer<typeof documentationReviewSchema>;

export function validateDocumentationReview(
  input: unknown,
  changedDocumentationPaths: readonly string[],
): DocumentationReview {
  const report = documentationReviewSchema.parse(input);
  const reported = new Set(report.documents.map(({ path }) => path));
  const missing = changedDocumentationPaths.filter((path) => !reported.has(path));
  if (missing.length > 0) throw new Error(`Documentation review omitted changed files: ${missing.join(", ")}`);
  const blocking = report.documents.some(
    (document) =>
      !document.crossReferencesChecked ||
      !document.commandExamplesChecked ||
      !document.behaviorConsistent ||
      document.findings.length > 0,
  );
  if ((report.verdict === "pass") === blocking) {
    throw new Error("Documentation verdict does not match coverage and findings");
  }
  return report;
}