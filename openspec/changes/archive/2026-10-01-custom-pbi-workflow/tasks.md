# Tasks

## 1. Deterministic Workflow Core

- [x] 1.1 Scaffold the standalone TypeScript package in `tools/pbi-workflow` for Node.js 20+, including build, lint, and test scripts, and verify a clean install can run all three scripts
- [x] 1.2 Implement and document the versioned `.github/pbi-workflow.yaml` schema, defaults, disabled-command reasons, and validation errors, and verify fixtures cover valid, incomplete, and unsupported configurations
- [x] 1.3 Implement typed PBI, slice, label, gate, claim, and pull request state models with legal transition checks, and verify table-driven tests reject conflicting or out-of-order transitions
- [x] 1.4 Implement versioned managed-marker parsing and idempotent reconciliation for PBI regions, sub-issues, claims, gates, and PRs, and verify repeated and malformed-input fixtures cannot duplicate or corrupt resources
- [x] 1.5 Implement injectable `gh`, `git`, and `openspec` command adapters with external JSON validation, repository scoping, and redacted errors, and verify mocked command tests cover authentication, permissions, malformed output, and scope violations

## 2. Schema and Repository Setup

- [x] 2.1 Add the `pbi-driven` schema with `specs/**/*.md` and a single tracked `tasks.md` orchestration task, and verify `openspec schema validate pbi-driven --verbose` succeeds
- [x] 2.2 Add the English PBI issue form with the required user story and planning sections, and verify fixture submissions expose every field required by preflight
- [x] 2.3 Implement setup discovery and preview for repository defaults, trusted actors, labels, branches, checks, commands, and demo settings, and verify no local or GitHub mutation occurs before confirmation
- [x] 2.4 Implement idempotent setup reconciliation for configuration, schema selection, skills, agents, issue template, and missing GitHub labels, and verify two sandbox setup runs produce no duplicate resources or unexpected second-run diff
- [x] 2.5 Add the user-invoked `setup-pbi-workflow` skill with permission reporting and rollback guidance, and verify a fresh Copilot session can complete setup against documented sandbox prerequisites

## 3. PBI Refinement and Planning

- [x] 3.1 Implement trusted PBI retrieval and English preflight validation for issue state, authorship, required sections, user-story form, placeholders, contradictions, acceptance criteria, and documentation links, and verify accepted and rejected fixtures produce actionable results
- [x] 3.2 Add repository guidance that makes `/opsx-propose` request a PBI when absent, derive `pbi-<number>-<slug>`, and resume an existing link, and verify proposal scenarios do not create duplicate or unlinked changes
- [x] 3.3 Implement the `pbi-refinement` skill with focused grilling, managed Technical Contract updates, optimistic revision checks, stable slice IDs, and trusted human approval, and verify contract changes invalidate approval and downstream gate markers
- [x] 3.4 Implement the `pbi-specification` skill and schema delegation that convert only the approved contract into valid delta specs, and verify generated examples pass `openspec validate --strict` without copying operational task state locally
- [x] 3.5 Implement the `pbi-task-graph` skill and publisher for native sub-issues, structured blockers, spec coverage, verification, labels, and stable markers, and verify reruns reconcile unchanged slices while started-slice conflicts stop for human resolution
- [x] 3.6 Generate `tasks.md` with exactly one PBI-linked orchestration checkbox after successful publication, and verify OpenSpec apply instructions report one pending task and include the generated specs as context

## 4. Local Task Orchestration

- [x] 4.1 Implement orchestrator ownership, structured task claims, configurable 120-minute leases, stale detection, and deterministic competing-run behavior, and verify restart and collision fixtures preserve a single owner
- [x] 4.2 Implement ready-frontier calculation from sub-issue blockers and the configurable three-task scheduler, and verify dependency graphs never launch blocked slices or exceed the concurrency limit
- [x] 4.3 Implement worktree and branch lifecycle using `feature/pbi-<number>-<slug>` and `task/<sub-issue-number>-<slug>`, and verify creation, reuse, cleanup, and recovery preserve unrelated user work
- [x] 4.4 Add the `pbi-implementer` agent and `pbi-task-implementation` skill with scoped context, focused verification, tests, documentation, and blocked-result reporting, and verify an agent cannot edit outside its assigned worktree
- [x] 4.5 Implement task PR creation against the PBI branch plus draft PBI PR creation after the first task merge, and verify markers make both operations idempotent and the final PR remains draft

## 5. Task Review and Integration

- [x] 5.1 Add the read-only `pbi-reviewer` agent and standards review path with structured findings, and verify its configured tools cannot edit source or mutate GitHub
- [x] 5.2 Add the independent acceptance and spec compliance review path, and verify fixtures detect missing criteria, scope creep, and behavior that contradicts an OpenSpec scenario
- [x] 5.3 Implement review result publication, required-check evaluation, and up to three fix cycles on the same task PR, and verify persistent failure moves the sub-issue to `agent-blocked` without enabling auto-merge
- [x] 5.4 Add the `pbi-merger` agent and `pbi-task-merge` skill to update task branches, resolve integration conflicts, enable squash auto-merge, close merged sub-issues explicitly, and verify each merge unlocks only the newly ready frontier

## 6. Completion Gates and Remediation

- [x] 6.1 Add the read-only documentation reviewer and `pbi-documentation-review` skill, and verify its report covers every changed document, cross-reference, command example, and conflict with current behavior
- [x] 6.2 Add the read-only QA agent and `pbi-qa` skill to execute the configured verification matrix and trace PBI criteria and spec scenarios to evidence, and verify disabled checks are reported with their configured reasons
- [x] 6.3 Add the demo agent and `pbi-demo` skill to use only configured startup and readiness commands, capture reproducible evidence, and verify unavailable demos produce a justified non-applicable result rather than an automatic pass
- [x] 6.4 Implement SHA-bound gate records and label projections for documentation, QA, and demo, and verify any PBI branch change invalidates stale evidence before the next gate or finalization
- [x] 6.5 Implement stable remediation sub-issues for blocking global findings and route them through the normal PR graph, and verify merged remediation reruns every invalidated downstream gate without duplicating findings
- [x] 6.6 Implement trusted human validation for contract and demo labels using GitHub actor history, and verify labels applied by agents or untrusted actors do not satisfy either gate

## 7. Finalization and Recovery

- [x] 7.1 Implement `pbi-finalization` to complete the orchestration checkbox only when all task PRs and current-SHA gates pass, and verify premature finalization leaves `tasks.md` pending with a clear blocker
- [x] 7.2 Integrate OpenSpec sync and archive on the PBI branch, push the archive commit, and mark the draft PBI PR ready without enabling final auto-merge, and verify durable specs and archived change files are included in the final diff
- [x] 7.3 Generate the final PR body with PBI linkage, delivered slices, verification evidence, gate summaries, demo evidence, and merge-risk assessment, and verify every referenced issue, commit, and check resolves
- [x] 7.4 Implement resume diagnostics that summarize active claims, open task PRs, blockers, valid gates, and the next action, and verify a fresh local Copilot session can continue from each persisted workflow state

## 8. Security and End-to-End Qualification

- [x] 8.1 Add adversarial fixtures for prompt injection, malicious links, command substitution, path traversal, secret leakage, untrusted approvals, and cross-repository mutation, and verify the workflow fails closed with redacted diagnostics
- [x] 8.2 Run a sandbox PBI through setup, missing-ID prompting, refinement, approval, spec generation, parallel task PRs, auto-merge, stale recovery, remediation, gates, archive, and final PR readiness, and record reproducible verification instructions with the bundle
- [x] 8.3 Document installation, configuration reference, state labels, recovery procedures, permission requirements, and MVP limitations in English, and verify every documented command runs as written in a clean sandbox checkout