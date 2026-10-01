---
name: pbi-demo
description: "Prepare the SHA-bound PBI demo gate. Use after QA passes; invokes the non-editing pbi-demo agent using only configured startup and readiness settings, validates reproducible evidence, and reports ready, failed, or justified not-applicable for human disposition."
license: MIT
compatibility: Requires a stable PBI integration worktree, workflow demo configuration, and pbi-demo agent.
metadata:
  author: openspec
  version: "1.0"
---

# Prepare the PBI Demo

1. Capture the current PBI head SHA and load validated demo command, URL, optional readiness URL, and timeout configuration.
2. Invoke `pbi-demo` in a clean integration worktree. Permit only configured startup and readiness operations.
3. Validate command/URL identity, readiness, evidence, findings, and not-applicable justification against configuration.
4. Refetch the branch head and discard stale evidence after any change.

Return `ready`, `failed`, or `not-applicable` evidence to the orchestrator. None is an automatic completion pass. The orchestrator must fetch GitHub timeline label history and accept the latest demo-approval label event only when its actor is an allowlisted `User` and it follows evidence for the same current SHA. Labels applied by bots, agents, untrusted actors, or before the current evidence do not pass the gate. The skill and agent never edit source or mutate GitHub.