export const managedKinds = [
  "technical-contract",
  "slice",
  "claim",
  "review",
  "remediation",
  "gate",
  "pull-request",
] as const;

export type ManagedKind = (typeof managedKinds)[number];

export interface ManagedBlock {
  readonly kind: ManagedKind;
  readonly id: string;
  readonly body: string;
  readonly start: number;
  readonly end: number;
}

const markerPattern =
  /<!--\s*pbi-workflow:v(?<version>\d+):(?<kind>[a-z-]+):(?<id>[A-Za-z0-9._-]+):(?<edge>start|end)\s*-->/gu;

export class ManagedMarkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagedMarkerError";
  }
}

function assertManagedKind(value: string): asserts value is ManagedKind {
  if (!(managedKinds as readonly string[]).includes(value)) {
    throw new ManagedMarkerError(`Unsupported managed marker kind: ${value}`);
  }
}

function marker(kind: ManagedKind, id: string, edge: "start" | "end"): string {
  if (!/^[A-Za-z0-9._-]+$/u.test(id)) {
    throw new ManagedMarkerError(`Invalid managed marker id: ${id}`);
  }

  return `<!-- pbi-workflow:v1:${kind}:${id}:${edge} -->`;
}

export function renderManagedBlock(
  kind: ManagedKind,
  id: string,
  body: string,
): string {
  const content = body.trim();
  return `${marker(kind, id, "start")}\n${content}\n${marker(kind, id, "end")}`;
}

export function parseManagedBlocks(source: string): readonly ManagedBlock[] {
  const blocks: ManagedBlock[] = [];
  const seen = new Set<string>();
  let open:
    | {
        readonly kind: ManagedKind;
        readonly id: string;
        readonly markerStart: number;
        readonly bodyStart: number;
      }
    | undefined;

  for (const match of source.matchAll(markerPattern)) {
    const version = match.groups?.version;
    const rawKind = match.groups?.kind;
    const id = match.groups?.id;
    const edge = match.groups?.edge;
    if (version === undefined || rawKind === undefined || id === undefined || edge === undefined) {
      throw new ManagedMarkerError("Malformed managed marker");
    }
    if (version !== "1") {
      throw new ManagedMarkerError(`Unsupported managed marker version: ${version}`);
    }
    assertManagedKind(rawKind);

    if (edge === "start") {
      if (open !== undefined) {
        throw new ManagedMarkerError(
          `Nested managed marker ${rawKind}:${id} inside ${open.kind}:${open.id}`,
        );
      }
      open = {
        kind: rawKind,
        id,
        markerStart: match.index,
        bodyStart: match.index + match[0].length,
      };
      continue;
    }

    if (open === undefined) {
      throw new ManagedMarkerError(`Orphan managed marker end: ${rawKind}:${id}`);
    }
    if (open.kind !== rawKind || open.id !== id) {
      throw new ManagedMarkerError(
        `Mismatched managed marker end ${rawKind}:${id}; expected ${open.kind}:${open.id}`,
      );
    }

    const key = `${rawKind}:${id}`;
    if (seen.has(key)) {
      throw new ManagedMarkerError(`Duplicate managed block: ${key}`);
    }
    seen.add(key);
    blocks.push({
      kind: rawKind,
      id,
      body: source.slice(open.bodyStart, match.index).trim(),
      start: open.markerStart,
      end: match.index + match[0].length,
    });
    open = undefined;
  }

  if (open !== undefined) {
    throw new ManagedMarkerError(`Unclosed managed marker: ${open.kind}:${open.id}`);
  }

  return blocks;
}

export function upsertManagedBlock(
  source: string,
  kind: ManagedKind,
  id: string,
  body: string,
): string {
  const blocks = parseManagedBlocks(source);
  const existing = blocks.find((block) => block.kind === kind && block.id === id);
  const rendered = renderManagedBlock(kind, id, body);

  if (existing !== undefined) {
    return `${source.slice(0, existing.start)}${rendered}${source.slice(existing.end)}`;
  }

  const prefix = source.trimEnd();
  return prefix.length === 0 ? `${rendered}\n` : `${prefix}\n\n${rendered}\n`;
}