# Sandbox PBI Lifecycle Qualification

The executable bundle is `test/sandbox-lifecycle.test.ts`. It uses deterministic in-memory GitHub adapters and the real OpenSpec CLI against the bundled generated-spec fixture, so reruns do not mutate a repository or depend on existing GitHub state.

## Covered Evidence

| Workflow phase | Executed evidence |
|---|---|
| Setup | Confirmed reconciliation followed by a zero-diff, zero-label second pass. |
| Missing PBI ID | Repository proposal instructions are checked for mandatory number-or-URL prompting. |
| Refinement and approval | English preflight, managed Technical Contract update, and current trusted-human timeline approval. |
| Specification | Generated sandbox delta spec passes strict OpenSpec validation. |
| Parallel tasks | Three independent slices publish and enter the ready frontier together at concurrency three. |
| Task PR integration | Three task PRs target the PBI branch; passing reviews and checks enable squash auto-merge. |
| Stale recovery | Expired claims produce recovery blockers and the deterministic `resolve-blockers` next action. |
| Remediation | A QA finding creates one stable remediation issue, reuses it on rerun, and schedules downstream gates. |
| Completion gates | Documentation and QA pass; a justified non-applicable demo receives trusted-human approval. |
| Archive and final PR | The orchestration checkbox completes, references resolve, durable specs and archive paths are verified, the archive commit pushes, the body updates, and only then the final PR becomes ready. |

## Reproduce

From the repository root:

```bash
cd tools/pbi-workflow
npm ci
npm run build
npm run lint
npm test -- sandbox-lifecycle.test.ts
npm test
cd ../..
npx openspec validate custom-pbi-workflow --strict
```

Expected focused result: one test file and one complete lifecycle test pass. The complete suite and strict change validation must also pass before accepting the bundle.