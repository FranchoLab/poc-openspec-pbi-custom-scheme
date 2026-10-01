---
name: pbi-qa
description: "Run the SHA-bound PBI QA completion gate. Use after documentation passes; invokes the non-editing pbi-qa agent with configured commands and complete acceptance/spec traces, validates disabled reasons, and returns reproducible evidence to the orchestrator."
license: MIT
compatibility: Requires a clean PBI integration worktree, workflow configuration, and pbi-qa agent.
metadata:
  author: openspec
  version: "1.0"
---

# Run PBI QA

1. Capture the current PBI branch head SHA and require a clean integration worktree.
2. Load the validated verification matrix, every PBI acceptance criterion, and every applicable OpenSpec scenario.
3. Invoke `pbi-qa` with those immutable inputs. Do not allow source edits or unconfigured substitute commands.
4. Validate all six command categories, exact disabled reasons, complete criterion/scenario traces, evidence, and verdict consistency.
5. Refetch the branch head and discard stale evidence if it changed.

Return the SHA-bound report to the orchestrator. Failures become remediation work; this skill and agent never update labels, comments, pull requests, or source files.