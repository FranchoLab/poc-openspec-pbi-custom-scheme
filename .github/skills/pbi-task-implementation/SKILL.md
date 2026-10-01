---
name: pbi-task-implementation
description: "Supervise implementation of one claimed PBI sub-issue in its dedicated worktree. Use when pbi-orchestrator schedules a ready slice; supplies scoped context to pbi-implementer, runs configured verification, validates changed paths, and returns completed or blocked evidence without mutating GitHub from the subagent."
license: MIT
compatibility: Requires a valid task claim, managed Git worktree, pbi-implementer agent, and repository workflow configuration.
metadata:
  author: openspec
  version: "1.0"
---

# Implement One PBI Task

The orchestrator owns GitHub state. This skill supervises local implementation only.

## Prepare

1. Verify the task claim belongs to the current orchestrator run and remains unexpired.
2. Create or recover the configured task branch and managed worktree. Refuse dirty or ambiguous worktrees unless resuming the same claim.
3. Build bounded context containing only the PBI summary, current approved contract revision, relevant OpenSpec requirements/scenarios, assigned sub-issue fields, repository instructions, and nearby code/tests.
4. Launch `pbi-implementer` with its session cwd set to the assigned worktree. Never launch it from the primary checkout.

## Verify

1. Validate that every changed path is inside the assigned worktree and belongs to the task scope. Stop and report a policy violation otherwise.
2. Run each enabled configured verification command from the assigned worktree. Report disabled categories with their configured reasons.
3. Require focused tests for changed behavior and documentation when the public behavior, command, configuration, or workflow changed.
4. Trace the result to every assigned acceptance criterion and OpenSpec scenario.

## Return

Return `completed` only with changed paths, verification evidence, test evidence, documentation disposition, and full acceptance/spec coverage. Return `blocked` with actionable evidence when implementation, policy validation, or verification fails. Do not create commits, push, open a pull request, or mutate issue labels; the orchestrator performs those transitions after accepting the result.