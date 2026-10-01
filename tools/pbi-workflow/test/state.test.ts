import { describe, expect, it } from "vitest";

import {
  InvalidStateTransitionError,
  StateLabelConflictError,
  assertPbiTransition,
  assertTaskTransition,
  canTransitionPbi,
  canTransitionTask,
  resolveExclusiveState,
} from "../src/state.js";

describe("PBI state transitions", () => {
  it.each([
    ["refinement", "awaiting-contract-approval"],
    ["awaiting-contract-approval", "planned"],
    ["planned", "implementation"],
    ["implementation", "documentation-review"],
    ["documentation-review", "qa"],
    ["qa", "demo"],
    ["demo", "ready-for-pr"],
    ["ready-for-pr", "pr-open"],
    ["pr-open", "done"],
    ["qa", "qa"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransitionPbi(from, to)).toBe(true);
    expect(() => assertPbiTransition(from, to)).not.toThrow();
  });

  it.each([
    ["refinement", "implementation"],
    ["planned", "qa"],
    ["documentation-review", "done"],
    ["done", "implementation"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(canTransitionPbi(from, to)).toBe(false);
    expect(() => assertPbiTransition(from, to)).toThrow(
      InvalidStateTransitionError,
    );
  });
});

describe("task state transitions", () => {
  it.each([
    ["ready", "in-progress"],
    ["in-progress", "pr-open"],
    ["pr-open", "merged"],
    ["in-progress", "stalled"],
    ["stalled", "ready"],
    ["blocked", "in-progress"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransitionTask(from, to)).toBe(true);
    expect(() => assertTaskTransition(from, to)).not.toThrow();
  });

  it.each([
    ["ready", "merged"],
    ["in-progress", "merged"],
    ["merged", "ready"],
    ["blocked", "merged"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(canTransitionTask(from, to)).toBe(false);
    expect(() => assertTaskTransition(from, to)).toThrow(
      InvalidStateTransitionError,
    );
  });
});

describe("resolveExclusiveState", () => {
  const labels = {
    ready: "ready-for-agent",
    "in-progress": "agent-in-progress",
    merged: "agent-merged",
  } as const;

  it("maps configured labels to semantic states", () => {
    expect(resolveExclusiveState(["bug", "agent-in-progress"], labels)).toBe(
      "in-progress",
    );
  });

  it("returns undefined when no state label is present", () => {
    expect(resolveExclusiveState(["bug"], labels)).toBeUndefined();
  });

  it("rejects conflicting state labels", () => {
    expect(() =>
      resolveExclusiveState(["ready-for-agent", "agent-in-progress"], labels),
    ).toThrow(StateLabelConflictError);
  });
});