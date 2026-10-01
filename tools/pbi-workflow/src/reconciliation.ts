export interface ExistingResource {
  readonly key: string;
  readonly content: string;
  readonly immutable: boolean;
}

export interface DesiredResource {
  readonly key: string;
  readonly content: string;
}

export type ReconciliationAction =
  | { readonly type: "create"; readonly key: string; readonly content: string }
  | { readonly type: "update"; readonly key: string; readonly content: string }
  | { readonly type: "unchanged"; readonly key: string }
  | {
      readonly type: "conflict";
      readonly key: string;
      readonly existing: string;
      readonly desired: string;
    };

export class ReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReconciliationError";
  }
}

function uniqueByKey<Resource extends { readonly key: string }>(
  resources: readonly Resource[],
  collectionName: string,
): Map<string, Resource> {
  const result = new Map<string, Resource>();
  for (const resource of resources) {
    if (result.has(resource.key)) {
      throw new ReconciliationError(
        `Duplicate ${collectionName} resource key: ${resource.key}`,
      );
    }
    result.set(resource.key, resource);
  }
  return result;
}

export function planReconciliation(
  existing: readonly ExistingResource[],
  desired: readonly DesiredResource[],
): readonly ReconciliationAction[] {
  const existingByKey = uniqueByKey(existing, "existing");
  uniqueByKey(desired, "desired");

  return desired.map((target) => {
    const current = existingByKey.get(target.key);
    if (current === undefined) {
      return { type: "create", key: target.key, content: target.content };
    }
    if (current.content === target.content) {
      return { type: "unchanged", key: target.key };
    }
    if (current.immutable) {
      return {
        type: "conflict",
        key: target.key,
        existing: current.content,
        desired: target.content,
      };
    }
    return { type: "update", key: target.key, content: target.content };
  });
}