---
name: pbi-documentation-review
description: "Run the PBI documentation completion gate. Use after all task PRs merge; enumerates every changed document, invokes the read-only documentation reviewer, validates complete cross-reference and command coverage, and returns SHA-bound findings to the orchestrator."
license: MIT
compatibility: Requires a stable PBI integration-branch head and pbi-documentation-reviewer agent.
metadata:
  author: openspec
  version: "1.0"
---

# Review PBI Documentation

1. Capture the PBI branch head SHA and enumerate every changed documentation file against the default branch, including README, docs, examples, configuration references, and inline user-facing guides.
2. Supply the exact list, diffs, and relevant current implementation to `pbi-documentation-reviewer`.
3. Validate that the report includes every changed documentation path and explicitly covers cross-references, command examples, and consistency with current behavior.
4. Refetch the PBI head and discard the report if the SHA changed.

Return the validated SHA-bound report to the orchestrator. The reviewer and this skill never edit source or documentation and never mutate GitHub. Blocking findings proceed through remediation; a report with omitted files or incomplete checks cannot pass.