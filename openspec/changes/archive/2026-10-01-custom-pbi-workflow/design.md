# Design

## Context

The workflow is a reusable repository bundle for GitHub Copilot in VS Code. OpenSpec 1.13.2 supplies a static artifact DAG and file-based completion, while GitHub supplies the dynamic PBI, task graph, pull requests, labels, and audit trail. The first release is locally supervised, uses one repository per PBI, and relies on authenticated `git`, `gh`, and `openspec` CLIs.

The standard `/opsx-propose` and `/opsx-apply` behaviors remain the public interface. A custom schema and delegated skills specialize their behavior without replacing OpenSpec commands.

## Goals / Non-Goals

**Goals:**

- Package an installable and configurable PBI workflow for multiple repositories.
- Make GitHub the canonical operational state while retaining durable OpenSpec behavioral specs.
- Allow safe parallel implementation with deterministic claims, isolated worktrees, task PRs, and serialized integration.
- Make every approval and automated gate attributable to a specific contract or code revision.
- Keep planning and execution resumable across local Copilot sessions.

**Non-Goals:**

- Cloud or unattended orchestration.
- Cross-repository PBIs or OpenSpec Stores.
- Automatic merge of the final PBI pull request.
- Supporting non-GitHub trackers or non-Copilot agent runtimes in the MVP.
- Treating labels as authoritative evidence without validating their actor and associated revision.

## Decisions

### Package layout

The reusable bundle will contain:

```text
openspec/schemas/pbi-driven/
  schema.yaml
  templates/spec.md
  templates/tasks.md
.github/pbi-workflow.yaml
.github/ISSUE_TEMPLATE/pbi.yml
.github/skills/<skill-name>/SKILL.md
.github/agents/<agent-name>.agent.md
tools/pbi-workflow/
  package.json
  src/
  test/
```

`setup-pbi-workflow` is the only additional user-invoked skill. All workflow disciplines are model-invoked skills so `/opsx-propose` and `/opsx-apply` remain the normal entry points.

Alternative considered: expose separate refine, plan, and run commands. Rejected because it duplicates OpenSpec's public lifecycle and requires users to remember internal stages.

### Deterministic workflow CLI

A standalone TypeScript package targeting Node.js 20 or newer will implement configuration validation, managed-marker parsing, state transitions, dependency resolution, claim leases, reconciliation, and adapters for `gh`, `git`, and `openspec`. It will compile to JavaScript before execution and expose a narrow CLI that skills call for deterministic operations.

The package will use schema-based validation for configuration and external JSON, inject command execution behind adapters, and keep semantic activities such as grilling, specification, code review, QA assessment, and demo narration in skills and agents. Fixture-driven tests will exercise the core without requiring network access; sandbox tests will cover real GitHub integration.

Alternative considered: encode all behavior in skills and shell snippets. Rejected because distributed prompt logic would make state reconciliation, security validation, and idempotency difficult to test or evolve safely.

### Minimal artifact graph

The `pbi-driven` schema has two artifacts:

```text
specs/**/*.md --> tasks.md --> apply
```

The specs instruction delegates PBI preflight, grilling, contract approval, and spec generation to the refinement and specification skills. The tasks instruction delegates sub-issue publication and writes exactly one orchestration checkbox. `apply.tracks` remains `tasks.md`, preserving compatibility with the generated `/opsx-apply` skill.

Alternative considered: set `apply.tracks` to null and customize `/opsx-apply`. Rejected for the MVP because one adapter task provides compatibility without duplicating GitHub task state.

### PBI and change identity

The OpenSpec change name is `pbi-<number>-<slug>`. Its supported metadata `goal` contains the PBI title and canonical URL. The PBI contains the change name in its managed Technical Contract region, and `tasks.md` includes the PBI URL. Custom `.openspec.yaml` fields are not used because OpenSpec validates that file against a closed schema.

### Managed PBI content and approval

PBIs use an English issue form with User Story, Context, Scope, Acceptance Criteria, Related Documentation, Constraints, and Out of Scope sections. The user story uses `As a ..., I want ..., so that ...`.

Agents may edit only the region bounded by stable Technical Contract markers. Before writing, the refinement skill compares the current issue revision with the revision it read. The contract contains decisions, alternatives, risks, verification, and stable slice IDs such as `T01`. Approval is valid only when a configured human approver applies it to the current revision.

### Repository configuration

`.github/pbi-workflow.yaml` is a versioned structured contract. It includes:

- Workflow language and PBI template requirements.
- Trusted PBI authors and contract/demo approvers.
- Configurable mappings for PBI, task, and gate labels.
- Base, PBI, and task branch patterns.
- Maximum parallel tasks, lease duration, and stale-claim policy.
- Install, format, lint, typecheck, test, build, demo start, readiness, and timeout commands.
- Required GitHub checks, task auto-merge, merge method, and final PR policy.

Setup detects repository defaults and proposes values, but stores only confirmed commands. An inapplicable verification category is disabled with a reason.

### GitHub state and idempotency

Native GitHub sub-issues express parentage. A structured `Blocked By` section is the canonical dependency representation so all supported GitHub repositories expose the graph consistently. Hidden versioned markers identify managed PBI regions, slice IDs, claims, gate results, and PR purpose.

Every mutating operation follows read, reconcile, then write. Existing resources with matching markers are reused. Started or merged slices are immutable under automatic reconciliation; a conflicting contract revision requires human resolution.

### State labels

PBI state defaults are `pbi/refinement`, `pbi/awaiting-contract-approval`, `pbi/planned`, `pbi/implementation`, `pbi/documentation-review`, `pbi/qa`, `pbi/demo`, `pbi/ready-for-pr`, `pbi/pr-open`, `pbi/done`, and `pbi/blocked`.

Task state defaults are `ready-for-agent`, `agent-in-progress`, `agent-pr-open`, `agent-merged`, `agent-blocked`, and `agent-stalled`. Gate labels are `gate/contract-approved`, `gate/documentation-passed`, `gate/qa-passed`, `gate/demo-ready`, `gate/demo-approved`, and `gate/demo-not-applicable`.

Exactly one state label from the relevant category is allowed. Labels are projections for discovery; structured comments and GitHub events provide evidence.

### Local orchestration and claims

One `pbi-orchestrator` owns a PBI at a time. It computes the ready frontier from open sub-issues whose blockers are merged, then launches up to three task agents by default. Claims record a UUID run ID, agent, branch, start timestamp, and expiry. The default lease is 120 minutes and is configurable.

On restart, the orchestrator reads GitHub rather than conversation history. Expired claims become stalled; branch and PR inspection determines whether to resume or requeue. A competing orchestrator with a valid claim exits without mutation.

### Agent and skill boundaries

Skills encode process and domain discipline: setup, refinement, specification, task graph creation, orchestration, implementation, task review, merge, documentation review, QA, demo, and finalization.

Custom agents enforce tool boundaries:

- `pbi-implementer`: writes code and tests only in its assigned worktree.
- `pbi-reviewer`: read-only standards or compliance review.
- `pbi-merger`: updates branches and resolves conflicts.
- `pbi-qa`: executes configured verification without editing source.
- `pbi-demo`: starts the application and captures evidence without editing source.

Only the orchestrator mutates GitHub issues, labels, comments, and PR lifecycle. Specialized agents return structured results to it.

### Branch and pull request strategy

The PBI branch is `feature/pbi-<pbi-number>-<slug>`. Each task uses `task/<sub-issue-number>-<slug>` in a dedicated worktree and opens a PR against the PBI branch. Task PRs must pass repository checks, standards review, and acceptance/spec compliance review on the current commit.

Failed review findings are repaired on the same task PR for at most three cycles. Passing PRs are updated against the PBI branch and squash-merged automatically. The orchestrator explicitly closes the sub-issue after merge rather than relying on default-branch closing keywords.

A draft PBI PR against the repository default branch is opened after the first task merge. It remains draft throughout implementation and gates.

### Global gates and remediation

After all task PRs merge, documentation review, QA, and demo preparation run sequentially. Each structured result records gate, PBI head SHA, run ID, verdict, evidence, and findings. Any head change invalidates results for that SHA.

Blocking findings become stable remediation sub-issues and pass through the same implementation and PR workflow. After they merge, affected gates rerun. A trusted human must approve demo evidence or explicitly accept a non-applicable demo before finalization.

### OpenSpec finalization

After all gates pass, the orchestrator checks the single task in `tasks.md`, synchronizes and archives the OpenSpec change on the PBI branch, pushes the resulting commit, and marks the draft PR ready for human review. The final PR is never auto-merged.

### Trust boundary

GitHub issue bodies, comments, and linked documents are untrusted input. They are delimited as data in agent prompts and cannot authorize commands, reveal secrets, broaden repository scope, or override workflow rules. Configuration names trusted authors and approvers. Credentials remain in local `gh` and `git` credential stores and are not copied into prompts or configuration.

### Validation strategy

Pure parsing, state transition, dependency, marker, lease, and reconciliation behavior will be covered by fixture-driven tests. GitHub mutations will be tested through a command adapter with recorded responses. A sandbox repository will exercise setup, proposal resumption, parallel task PRs, stale recovery, remediation, gates, archive, and final PR readiness end to end.

## Risks / Trade-offs

- [GitHub labels are not transactional locks] -> Use a single local orchestrator, structured claims, deterministic ownership checks, and leases; document that the MVP offers collision resistance rather than a distributed lock guarantee.
- [GitHub state may be manually edited] -> Reconcile markers, labels, issue state, and PR state before every mutation and stop on ambiguous conflicts.
- [A single orchestration checkbox provides little local progress detail] -> Keep detailed progress canonical in GitHub and report a summarized frontier during apply.
- [Three concurrent agents may create integration conflicts] -> Require vertical slices, explicit dependency edges, current-base checks, and a dedicated merger agent.
- [Remote content can contain prompt injection] -> Treat all remote content as untrusted data, restrict tools by agent role, and centralize mutations in the orchestrator.
- [OpenSpec schema APIs are experimental] -> Pin and test the supported OpenSpec version, validate the schema during setup, and isolate schema assumptions from GitHub orchestration logic.
- [Local sessions can terminate mid-run] -> Persist every state transition and claim in GitHub and reconstruct execution on resume.

## Migration Plan

1. Add the bundle and its fixture-driven tests without selecting the new schema.
2. Run setup against a sandbox repository and validate generated labels, configuration, and issue template.
3. Exercise one complete PBI with sequential execution, then enable the default parallel limit of three.
4. Set `schema: pbi-driven` only after sandbox proposal, apply, remediation, archive, and final PR flows pass.
5. Roll back by restoring the previous OpenSpec schema selection; existing GitHub issues and branches remain ordinary repository resources and are not deleted automatically.