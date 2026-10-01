---
name: pbi-task-merge
description: "Integrate and squash-merge a reviewed PBI task pull request. Use when pbi-orchestrator receives current-SHA passing reviews and checks; updates the task branch, delegates conflicts to pbi-merger, reruns gates, enables squash auto-merge, closes the sub-issue, and unlocks the new frontier."
license: MIT
compatibility: Requires a marker-owned task PR, valid task claim, pbi-merger agent, and configured squash auto-merge policy.
metadata:
  author: openspec
  version: "1.0"
---

# Merge a PBI Task

1. Verify PR purpose marker, task claim ownership, task/PBI branches, current head SHA, and current-SHA review decision.
2. If behind, update the task branch from the current PBI integration branch in its managed worktree. If conflicts exist, invoke `pbi-merger` there and stop on unresolved semantic conflicts.
3. After every branch update or conflict edit, push the task branch and rerun configured verification, required checks, standards review, and acceptance/spec review for the new head SHA.
4. Only when the latest decision is ready, enable GitHub auto-merge using squash. Never merge directly, use another merge method, or enable auto-merge for stale, pending, failed, or blocked evidence.
5. After GitHub reports the PR merged, explicitly close the sub-issue, record merged state, release its claim, and clean only a clean managed worktree.
6. Recompute blockers from GitHub and transition only slices newly unlocked by this merge to ready. Do not relaunch already-ready or actively claimed work.

Only the orchestrator executes Git and GitHub lifecycle mutations. Return the merged PR, squash commit, closed issue, cleanup disposition, and newly ready stable slice IDs.