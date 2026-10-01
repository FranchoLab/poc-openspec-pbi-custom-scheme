import type { Slice } from "./state.js";

export interface SchedulerSlice extends Slice {
  readonly blockReason?: "dependencies" | "workflow";
}

export interface ReadyFrontier {
  readonly ready: readonly SchedulerSlice[];
  readonly blocked: readonly SchedulerSlice[];
}

export class DependencyGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DependencyGraphError";
  }
}

function validateGraph(slices: readonly SchedulerSlice[]): Map<string, SchedulerSlice> {
  const byId = new Map(slices.map((slice) => [slice.id, slice]));
  if (byId.size !== slices.length) throw new DependencyGraphError("Duplicate slice IDs");
  for (const slice of slices) {
    for (const blocker of slice.blockedBy) {
      if (!byId.has(blocker)) throw new DependencyGraphError(`${slice.id} references unknown blocker ${blocker}`);
      if (blocker === slice.id) throw new DependencyGraphError(`${slice.id} cannot block itself`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new DependencyGraphError(`Dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const blocker of byId.get(id)!.blockedBy) visit(blocker);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
  return byId;
}

export function calculateReadyFrontier(slices: readonly SchedulerSlice[]): ReadyFrontier {
  const byId = validateGraph(slices);
  const candidates = slices.filter(
    (slice) => slice.state === "ready" || (slice.state === "blocked" && slice.blockReason === "dependencies"),
  );
  const ready = candidates
    .filter((slice) => slice.blockedBy.every((id) => byId.get(id)?.state === "merged"))
    .sort((left, right) => left.id.localeCompare(right.id));
  const readyIds = new Set(ready.map(({ id }) => id));
  return {
    ready,
    blocked: slices.filter((slice) => slice.state !== "merged" && !readyIds.has(slice.id)),
  };
}

export function scheduleReadyTasks(
  slices: readonly SchedulerSlice[],
  activelyClaimedSliceIds: readonly string[],
  maxParallelTasks = 3,
): readonly SchedulerSlice[] {
  if (!Number.isInteger(maxParallelTasks) || maxParallelTasks < 1 || maxParallelTasks > 20) {
    throw new DependencyGraphError(`Concurrency must be between 1 and 20: ${maxParallelTasks}`);
  }
  const active = new Set(activelyClaimedSliceIds);
  const capacity = Math.max(0, maxParallelTasks - active.size);
  return calculateReadyFrontier(slices).ready
    .filter((slice) => !active.has(slice.id))
    .slice(0, capacity);
}