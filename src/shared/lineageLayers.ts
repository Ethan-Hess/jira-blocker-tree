import type { IssueSummary } from "./types";

export interface LineageEdge {
  from: string;
  to: string;
}

export interface LineageLayerRow {
  layerIndex: number;
  issues: IssueSummary[];
  /** Display label for this generation (Ready / Layer N). */
  label: string;
}

export interface LineageLayout {
  layers: LineageLayerRow[];
  edges: LineageEdge[];
  layerByKey: Map<string, number>;
}

function shouldInclude(
  issue: IssueSummary,
  hideDone: boolean,
  rootKey: string,
): boolean {
  // Pedigree shows work under the epic, never the epic/root itself.
  if (issue.key === rootKey) return false;
  if (!hideDone) return true;
  return issue.statusCategory !== "done";
}

function openBlockerKeys(
  issue: IssueSummary,
  included: Set<string>,
  issuesByKey: Record<string, IssueSummary>,
): string[] {
  return issue.blockerKeys.filter((key) => {
    const blocker = issuesByKey[key];
    if (!blocker || !included.has(key)) return false;
    if (blocker.statusCategory === "done") return false;
    return true;
  });
}

function computeLayer(
  key: string,
  included: Set<string>,
  issuesByKey: Record<string, IssueSummary>,
  memo: Map<string, number>,
  visiting: Set<string>,
): number {
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  if (visiting.has(key)) return 0;

  visiting.add(key);
  const issue = issuesByKey[key];
  if (!issue) {
    memo.set(key, 0);
    visiting.delete(key);
    return 0;
  }

  const blockers = openBlockerKeys(issue, included, issuesByKey);
  if (blockers.length === 0) {
    memo.set(key, 0);
    visiting.delete(key);
    return 0;
  }

  let maxChild = 0;
  for (const blockerKey of blockers) {
    maxChild = Math.max(
      maxChild,
      computeLayer(blockerKey, included, issuesByKey, memo, visiting) + 1,
    );
  }
  memo.set(key, maxChild);
  visiting.delete(key);
  return maxChild;
}

function sortLayer(issues: IssueSummary[]): IssueSummary[] {
  return [...issues].sort(
    (a, b) => b.leverage - a.leverage || a.key.localeCompare(b.key),
  );
}

function generationLabel(index: number): string {
  if (index === 0) return "Ready";
  return `Layer ${index}`;
}

/**
 * Ensure A→B (A blocks B) implies layer(B) > layer(A) when A is still open.
 * Cycles stop growing once a layer would exceed the node count.
 */
function enforceBlockLayerOrder(
  layerByKey: Map<string, number>,
  included: Set<string>,
  issuesByKey: Record<string, IssueSummary>,
): void {
  const maxAllowed = Math.max(included.size - 1, 0);
  const edges: { from: string; to: string }[] = [];

  for (const key of included) {
    const issue = issuesByKey[key];
    if (!issue || issue.statusCategory === "done") continue;
    for (const blockedKey of issue.blockedKeys) {
      if (!included.has(blockedKey)) continue;
      const blocked = issuesByKey[blockedKey];
      if (!blocked) continue;
      edges.push({ from: key, to: blockedKey });
    }
  }

  let changed = true;
  let guard = 0;
  while (changed && guard < included.size + 2) {
    changed = false;
    guard += 1;
    for (const { from, to } of edges) {
      const fromLayer = layerByKey.get(from) ?? 0;
      const toLayer = layerByKey.get(to) ?? 0;
      const required = fromLayer + 1;
      if (required > maxAllowed) continue;
      if (toLayer < required) {
        layerByKey.set(to, required);
        changed = true;
      }
    }
  }
}

export function buildLineageLayout(
  issuesByKey: Record<string, IssueSummary>,
  rootKey: string,
  hideDone: boolean,
): LineageLayout {
  const included = new Set<string>();
  for (const issue of Object.values(issuesByKey)) {
    if (shouldInclude(issue, hideDone, rootKey)) {
      included.add(issue.key);
    }
  }

  const layerByKey = new Map<string, number>();
  const memo = new Map<string, number>();

  for (const key of included) {
    layerByKey.set(
      key,
      computeLayer(key, included, issuesByKey, memo, new Set()),
    );
  }

  enforceBlockLayerOrder(layerByKey, included, issuesByKey);

  const maxLayer =
    layerByKey.size > 0 ? Math.max(...layerByKey.values()) : -1;
  const layerBuckets: IssueSummary[][] = Array.from(
    { length: Math.max(0, maxLayer + 1) },
    () => [],
  );

  for (const key of included) {
    const issue = issuesByKey[key];
    if (!issue) continue;
    const layer = layerByKey.get(key) ?? 0;
    layerBuckets[layer].push(issue);
  }

  const layers: LineageLayerRow[] = [];
  for (let i = 0; i < layerBuckets.length; i += 1) {
    const issues = sortLayer(layerBuckets[i]);
    if (issues.length > 0) {
      layers.push({
        layerIndex: i,
        issues,
        label: generationLabel(i),
      });
    }
  }

  const edges: LineageEdge[] = [];
  for (const key of included) {
    const issue = issuesByKey[key];
    if (!issue) continue;
    for (const blockedKey of issue.blockedKeys) {
      if (!included.has(blockedKey)) continue;
      edges.push({ from: issue.key, to: blockedKey });
    }
  }

  return { layers, edges, layerByKey };
}

export function layerLabel(index: number): string {
  return generationLabel(index);
}
