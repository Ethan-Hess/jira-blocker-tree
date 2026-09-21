import type { IssueSummary, TreeNode } from "../shared/types";

export type TreeSortColumn =
  | "issue"
  | "leverage"
  | "priority"
  | "status"
  | "assignee";

export type TreeSortDir = "asc" | "desc";

export interface TreeSortState {
  column: TreeSortColumn;
  dir: TreeSortDir;
}

export const DEFAULT_TREE_SORT: TreeSortState = {
  column: "leverage",
  dir: "desc",
};

function isPlaceholder(node: TreeNode): boolean {
  return node.kind === "cycle" || node.kind === "truncated";
}

function compareIssues(a: IssueSummary, b: IssueSummary, sort: TreeSortState): number {
  let cmp = 0;
  switch (sort.column) {
    case "issue":
      cmp = a.key.localeCompare(b.key);
      break;
    case "leverage":
      cmp = a.leverage - b.leverage;
      break;
    case "priority":
      cmp = a.priorityRank - b.priorityRank;
      break;
    case "status":
      cmp = a.statusName.localeCompare(b.statusName);
      break;
    case "assignee": {
      const nameA = a.assigneeDisplayName ?? "";
      const nameB = b.assigneeDisplayName ?? "";
      cmp = nameA.localeCompare(nameB);
      break;
    }
    default:
      cmp = 0;
  }
  if (cmp === 0) cmp = a.key.localeCompare(b.key);
  return sort.dir === "asc" ? cmp : -cmp;
}

function compareNodes(a: TreeNode, b: TreeNode, sort: TreeSortState): number {
  const aPh = isPlaceholder(a);
  const bPh = isPlaceholder(b);
  if (aPh && !bPh) return 1;
  if (!aPh && bPh) return -1;
  return compareIssues(a.issue, b.issue, sort);
}

export function sortTree(node: TreeNode, sort: TreeSortState): TreeNode {
  const children = [...node.children]
    .sort((a, b) => compareNodes(a, b, sort))
    .map((child) => sortTree(child, sort));
  return { ...node, children };
}

export function toggleTreeSort(
  current: TreeSortState,
  column: TreeSortColumn,
): TreeSortState {
  if (current.column === column) {
    return { column, dir: current.dir === "asc" ? "desc" : "asc" };
  }
  const defaultDir: TreeSortDir =
    column === "leverage" || column === "priority" ? "desc" : "asc";
  return { column, dir: defaultDir };
}
