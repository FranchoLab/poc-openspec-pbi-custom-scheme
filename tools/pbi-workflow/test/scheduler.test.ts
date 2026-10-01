import { describe, expect, it } from "vitest";

import { DependencyGraphError, calculateReadyFrontier, scheduleReadyTasks } from "../src/scheduler.js";
import type { SchedulerSlice } from "../src/scheduler.js";

const slice = (id: string, blockedBy: string[], state: SchedulerSlice["state"] = "ready", blockReason?: SchedulerSlice["blockReason"]): SchedulerSlice => ({
  id,
  issueNumber: Number(id.slice(1)) + 100,
  title: id,
  blockedBy,
  state,
  ...(blockReason === undefined ? {} : { blockReason }),
});

describe("ready frontier", () => {
  it("never includes a slice with an unresolved blocker", () => {
    const graph = [slice("T01", [], "in-progress"), slice("T02", ["T01"], "blocked", "dependencies")];
    expect(calculateReadyFrontier(graph).ready).toEqual([]);
  });

  it("unlocks only dependency-blocked slices after every blocker merges", () => {
    const graph = [
      slice("T01", [], "merged"),
      slice("T02", ["T01"], "blocked", "dependencies"),
      slice("T03", ["T01"], "blocked", "workflow"),
    ];
    expect(calculateReadyFrontier(graph).ready.map(({ id }) => id)).toEqual(["T02"]);
  });

  it("does not exceed the configured limit including active claims", () => {
    const graph = [slice("T01", []), slice("T02", []), slice("T03", []), slice("T04", [])];
    expect(scheduleReadyTasks(graph, ["T01"], 3).map(({ id }) => id)).toEqual(["T02", "T03"]);
    expect(scheduleReadyTasks(graph, ["T01", "T02", "T03"], 3)).toEqual([]);
  });

  it("rejects missing blockers and cycles", () => {
    expect(() => calculateReadyFrontier([slice("T01", ["T99"])]))
      .toThrow(DependencyGraphError);
    expect(() => calculateReadyFrontier([slice("T01", ["T02"]), slice("T02", ["T01"])]))
      .toThrow(DependencyGraphError);
  });
});