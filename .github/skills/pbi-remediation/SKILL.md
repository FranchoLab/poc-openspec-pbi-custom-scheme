---
name: pbi-remediation
description: "Create or resume stable remediation sub-issues for blocking PBI completion-gate findings. Use when documentation, QA, or demo gates fail; deduplicates findings, routes fixes through the normal task PR workflow, and reruns affected downstream gates after merge."
license: MIT
compatibility: Requires a current SHA-bound blocking gate report and the PBI task orchestration workflow.
metadata:
  author: openspec
  version: "1.0"
---

# Remediate a Completion Gate

1. Accept only blocking findings from a validated current-SHA documentation, QA, or demo-preparation report.
2. Derive the stable remediation key from gate, finding code, affected path, and normalized message. Reuse the matching managed native sub-issue; stop on duplicates.
3. Publish outcome, affected path, verification, and explicit out-of-scope content. Attach it to the PBI and mark it ready through configured labels.
4. Route remediation through the normal claim, worktree, implementation, task PR, independent reviews, checks, and squash-merge workflow. Do not patch the PBI branch directly.
5. After merge changes the PBI head, invalidate stale gate labels and rerun the originating gate plus every downstream gate: documentation to QA to demo preparation to demo approval.

The orchestrator owns all GitHub mutations. Report created or reused remediation issue, merged PR, new PBI SHA, and gates scheduled to rerun.