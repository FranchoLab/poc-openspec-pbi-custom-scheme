# Proposal

## Why

Teams need a repeatable way to turn an approved GitHub PBI into a technically refined, specification-driven implementation without duplicating operational state across local planning files. A reusable OpenSpec workflow can keep product intent and execution state in GitHub while preserving durable behavioral specifications and coordinating specialized local agents.

## What Changes

- Add a reusable `pbi-driven` OpenSpec schema whose planning artifacts are behavioral specs plus a single orchestration task.
- Make `/opsx-propose` the entry point for PBI validation, technical grilling, human contract approval, spec generation, and publication of vertical GitHub sub-issues.
- Make `/opsx-apply` execute a resumable, locally supervised orchestrator through the single task in `tasks.md`.
- Add configurable GitHub labels, issue templates, branch conventions, trusted actors, verification commands, concurrency limits, leases, and pull request policies.
- Coordinate isolated implementer, reviewer, merger, QA, and demo agents with one pull request per subtask and automatic merge into the PBI integration branch.
- Gate finalization on documentation review, QA, and human demo approval, creating traceable remediation sub-issues for failures.
- Keep GitHub as the canonical source for PBI context, technical contract, task dependencies, and runtime state while storing only OpenSpec specs and the orchestration task locally.

## Capabilities

### New Capabilities

- `pbi-driven-workflow`: Refine an English GitHub PBI, produce approved OpenSpec specifications and vertical sub-issues, orchestrate their implementation through isolated agents and pull requests, and enforce evidence-backed completion gates.

### Modified Capabilities

None.

## Impact

- Adds a project-local OpenSpec schema and templates under `openspec/schemas/`.
- Adds reusable GitHub Copilot skills and custom agents under `.github/`.
- Adds a repository configuration file and an English PBI issue template.
- Uses the local `git`, `gh`, and `openspec` CLIs and requires authenticated GitHub access.
- Creates and updates GitHub issues, labels, branches, comments, checks, and pull requests within one configured repository.
- Initially supports a locally supervised GitHub Copilot workflow in VS Code; cloud and cross-repository orchestration remain out of scope.