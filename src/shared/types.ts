export type StatusCategoryKey = "new" | "indeterminate" | "done" | "unknown";

export interface IssueSummary {
  key: string;
  summary: string;
  statusName: string;
  statusCategory: StatusCategoryKey;
  assigneeDisplayName: string | null;
  issueTypeName: string;
  blocksCount: number;
}

export type TreeNodeKind = "root" | "epicChild" | "blocker" | "cycle" | "truncated";

export interface TreeNode {
  issue: IssueSummary;
  kind: TreeNodeKind;
  children: TreeNode[];
  message?: string;
}

export interface BuildTreeResult {
  rootKey: string;
  tree: TreeNode | null;
  error?: string;
  nodeCount: number;
  truncated: boolean;
}

export type BackgroundRequest =
  | { type: "BUILD_TREE"; issueKey: string; force?: boolean }
  | { type: "GET_ACTIVE_ISSUE" }
  | { type: "SET_ACTIVE_ISSUE"; issueKey: string };

export type BackgroundResponse =
  | { ok: true; data: BuildTreeResult }
  | { ok: false; error: string };
