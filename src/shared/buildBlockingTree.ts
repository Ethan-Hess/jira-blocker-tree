import { analyzeGraph } from "./analyzeGraph";
import { MAX_TREE_DEPTH, MAX_TREE_NODES } from "./constants";
import { fetchEpicChildren, fetchIssue, fetchIssuesByKeys } from "./jira/client";
import {
  inwardBlockerKeys,
  outwardBlockedKeys,
  placeholderIssueSummary,
  toIssueSummary,
} from "./jira/mapIssue";
import type { JiraIssue } from "./jira/types";
import type { AnalyzeGraphResult } from "./analyzeGraph";
import type { BuildTreeResult, IssueSummary, TreeNode, TreeNodeKind } from "./types";

interface BuildContext {
  rootKey: string;
  issues: Map<string, JiraIssue>;
  epicChildKeys: string[];
  truncated: boolean;
  analysis: AnalyzeGraphResult | null;
}

function placeholderNode(
  key: string,
  kind: TreeNodeKind,
  message: string,
): TreeNode {
  return {
    issue: placeholderIssueSummary(key, message),
    kind,
    children: [],
    message,
  };
}

function buildNode(
  ctx: BuildContext,
  key: string,
  kind: TreeNodeKind,
  depth: number,
  path: Set<string>,
): TreeNode {
  if (path.has(key)) {
    return placeholderNode(key, "cycle", "Cycle back to an ancestor");
  }

  if (depth > MAX_TREE_DEPTH) {
    ctx.truncated = true;
    return placeholderNode(key, "truncated", "Max depth reached");
  }

  const issue = ctx.issues.get(key);
  if (!issue) {
    ctx.truncated = true;
    return placeholderNode(key, "truncated", "Not loaded (limit reached)");
  }

  const metrics = ctx.analysis?.byKey.get(key);
  const nextPath = new Set(path);
  nextPath.add(key);

  const children: TreeNode[] = [];

  for (const blockerKey of inwardBlockerKeys(issue)) {
    children.push(buildNode(ctx, blockerKey, "blocker", depth + 1, nextPath));
  }

  if (key === ctx.rootKey) {
    for (const childKey of ctx.epicChildKeys) {
      children.push(buildNode(ctx, childKey, "epicChild", depth + 1, nextPath));
    }
  }

  return {
    issue: toIssueSummary(issue, metrics ?? undefined),
    kind,
    children,
  };
}

async function prefetchGraph(ctx: BuildContext, origin: string): Promise<void> {
  const [root, epicChildren] = await Promise.all([
    fetchIssue(origin, ctx.rootKey),
    fetchEpicChildren(origin, ctx.rootKey).catch(() => [] as JiraIssue[]),
  ]);

  ctx.issues.set(root.key, root);

  for (const child of epicChildren) {
    if (child.key === ctx.rootKey || ctx.issues.has(child.key)) continue;
    if (ctx.issues.size >= MAX_TREE_NODES) {
      ctx.truncated = true;
      break;
    }
    ctx.issues.set(child.key, child);
    ctx.epicChildKeys.push(child.key);
  }

  let frontier = [...ctx.issues.values()];

  for (let depth = 0; depth < MAX_TREE_DEPTH; depth += 1) {
    const pending = new Set<string>();

    for (const issue of frontier) {
      for (const blockerKey of inwardBlockerKeys(issue)) {
        if (!ctx.issues.has(blockerKey)) {
          pending.add(blockerKey);
        }
      }
    }

    if (pending.size === 0) break;

    let keys = [...pending];
    const remaining = MAX_TREE_NODES - ctx.issues.size;
    if (keys.length > remaining) {
      keys = keys.slice(0, Math.max(0, remaining));
      ctx.truncated = true;
    }
    if (keys.length === 0) break;

    const loaded = await fetchIssuesByKeys(origin, keys);
    frontier = [];
    for (const issue of loaded) {
      if (ctx.issues.has(issue.key)) continue;
      ctx.issues.set(issue.key, issue);
      frontier.push(issue);
    }

    if (frontier.length === 0) break;
  }
}

async function prefetchOutwardTargets(
  ctx: BuildContext,
  origin: string,
): Promise<void> {
  const pending = new Set<string>();

  for (const issue of ctx.issues.values()) {
    for (const blockedKey of outwardBlockedKeys(issue)) {
      if (!ctx.issues.has(blockedKey)) {
        pending.add(blockedKey);
      }
    }
  }

  if (pending.size === 0) return;

  let keys = [...pending];
  const remaining = MAX_TREE_NODES - ctx.issues.size;
  if (keys.length > remaining) {
    keys = keys.slice(0, Math.max(0, remaining));
    ctx.truncated = true;
  }
  if (keys.length === 0) return;

  const loaded = await fetchIssuesByKeys(origin, keys);
  for (const issue of loaded) {
    if (ctx.issues.has(issue.key)) continue;
    if (ctx.issues.size >= MAX_TREE_NODES) {
      ctx.truncated = true;
      break;
    }
    ctx.issues.set(issue.key, issue);
  }
}

function buildIssuesByKey(
  issues: Map<string, JiraIssue>,
  analysis: AnalyzeGraphResult,
): Record<string, IssueSummary> {
  const out: Record<string, IssueSummary> = {};
  for (const issue of issues.values()) {
    const metrics = analysis.byKey.get(issue.key);
    out[issue.key] = toIssueSummary(issue, metrics ?? undefined);
  }
  return out;
}

export async function buildBlockingTree(
  rootKey: string,
  origin: string,
): Promise<BuildTreeResult> {
  const ctx: BuildContext = {
    rootKey,
    issues: new Map(),
    epicChildKeys: [],
    truncated: false,
    analysis: null,
  };

  const emptyResult = (): BuildTreeResult => ({
    rootKey,
    tree: null,
    ready: [],
    criticalPath: [],
    issuesByKey: {},
    epicChildKeys: [],
    nodeCount: ctx.issues.size,
    truncated: ctx.truncated,
  });

  try {
    await prefetchGraph(ctx, origin);
    await prefetchOutwardTargets(ctx, origin);
    ctx.analysis = analyzeGraph(ctx.issues, rootKey);
    const tree = buildNode(ctx, rootKey, "root", 0, new Set());
    const issuesByKey = buildIssuesByKey(ctx.issues, ctx.analysis);

    return {
      rootKey,
      tree,
      ready: ctx.analysis.ready,
      criticalPath: ctx.analysis.criticalPath,
      issuesByKey,
      epicChildKeys: [...ctx.epicChildKeys],
      nodeCount: ctx.issues.size,
      truncated: ctx.truncated,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return {
      ...emptyResult(),
      error: message,
    };
  }
}
