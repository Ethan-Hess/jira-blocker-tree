import { MAX_TREE_DEPTH, MAX_TREE_NODES } from "./constants";
import { fetchEpicChildren, fetchIssue, fetchIssuesByKeys } from "./jira/client";
import { inwardBlockerKeys, toIssueSummary } from "./jira/mapIssue";
import type { JiraIssue } from "./jira/types";
import type { BuildTreeResult, TreeNode, TreeNodeKind } from "./types";

interface BuildContext {
  rootKey: string;
  issues: Map<string, JiraIssue>;
  epicChildKeys: string[];
  truncated: boolean;
}

function placeholderNode(
  key: string,
  kind: TreeNodeKind,
  message: string,
): TreeNode {
  return {
    issue: {
      key,
      summary: message,
      statusName: "",
      statusCategory: "unknown",
      assigneeDisplayName: null,
      issueTypeName: "",
      blocksCount: 0,
    },
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
    issue: toIssueSummary(issue),
    kind,
    children,
  };
}

/**
 * Breadth-first by level: every issue in a level is fetched in one batched
 * round trip rather than one request per issue.
 */
async function prefetchGraph(ctx: BuildContext): Promise<void> {
  const [root, epicChildren] = await Promise.all([
    fetchIssue(ctx.rootKey),
    fetchEpicChildren(ctx.rootKey).catch(() => [] as JiraIssue[]),
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

    const loaded = await fetchIssuesByKeys(keys);
    frontier = [];
    for (const issue of loaded) {
      if (ctx.issues.has(issue.key)) continue;
      ctx.issues.set(issue.key, issue);
      frontier.push(issue);
    }

    if (frontier.length === 0) break;
  }
}

export async function buildBlockingTree(
  rootKey: string,
): Promise<BuildTreeResult> {
  const ctx: BuildContext = {
    rootKey,
    issues: new Map(),
    epicChildKeys: [],
    truncated: false,
  };

  try {
    await prefetchGraph(ctx);
    const tree = buildNode(ctx, rootKey, "root", 0, new Set());

    return {
      rootKey,
      tree,
      nodeCount: ctx.issues.size,
      truncated: ctx.truncated,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return {
      rootKey,
      tree: null,
      error: message,
      nodeCount: ctx.issues.size,
      truncated: ctx.truncated,
    };
  }
}
