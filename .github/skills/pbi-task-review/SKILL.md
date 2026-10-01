---
name: pbi-task-review
description: "Run independent read-only review of a PBI task pull request. Use when pbi-orchestrator needs standards or acceptance/spec-compliance findings for a current task PR head; invokes pbi-reviewer, validates structured results, and returns evidence without editing code or GitHub."
license: MIT
compatibility: Requires a task PR, current head SHA, pbi-reviewer agent, and scoped review context.
metadata:
  author: openspec
  version: "1.0"
---

# Review a PBI Task

1. Capture the task PR head SHA and changed-file diff before launching review.
2. For standards review, supply repository guidance, changed files, and focused surrounding code. For acceptance/spec review, supply only the assigned sub-issue criteria, covered OpenSpec scenarios, changed diff, and relevant tests.
3. Invoke `pbi-reviewer` in exactly one review mode. It is read-only and must return structured JSON.
4. Validate the result with the workflow review schema and reject a result for another SHA, malformed findings, or a verdict inconsistent with blocking findings.
5. Refetch the PR head. If it changed, discard the stale review and rerun against the new SHA.

Return validated findings to the orchestrator. Do not publish comments, request changes, modify code, or update labels from this skill or reviewer.

The orchestrator publishes both validated results in one managed review-cycle comment. It evaluates configured required checks and reviews against the same current head SHA. Failed cycles return the same PR to its implementer for focused fixes, up to the configured maximum of three cycles. A persistent failure moves the sub-issue to `agent-blocked`; no failing, pending, stale, or blocked decision may enable auto-merge.