# Repository OpenSpec Workflow

Do not edit generated OpenSpec customizations whose names begin with `openspec-` or `opsx-`. Extend or override them through repository-owned instructions, `pbi-*` skills, custom agents, schemas, and deterministic tooling because OpenSpec updates may replace generated files.

## PBI-Driven Proposal Override

When `/opsx-propose` selects the `pbi-driven` schema, apply these rules in addition to the generated proposal workflow:

- Require a GitHub PBI issue number or canonical URL. If absent, ask for it and stop before creating a change.
- Fetch and validate the PBI through the repository's `pbi-refinement` workflow. Do not create artifacts while preflight is blocked.
- Read any managed Technical Contract link and list existing OpenSpec changes before choosing a name.
- Resolve exactly one change in this order: resume the valid managed link; otherwise resume the unique existing name beginning `pbi-<number>-`; otherwise derive `pbi-<number>-<slug>` from the current English PBI title.
- Stop for human resolution when a managed link belongs to another PBI, references a missing change, or multiple matching changes exist. Never create a duplicate or unlinked change.
- Use the resolved PBI change name instead of a name inferred from the request. A resume action skips `openspec new change` and continues with status and artifact generation.
- For `pbi-driven`, deterministic resumption overrides the generated workflow's generic instruction to ask whether an existing same-name change should be resumed.