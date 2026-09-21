export type StatusCategoryKey = "new" | "indeterminate" | "done" | "unknown";

export interface IssueSummary {
  key: string;
  summary: string;
  statusName: string;
  statusCategory: StatusCategoryKey;
  assigneeDisplayName: string | null;
  issueTypeName: string;
  priorityName: string | null;
  priorityId: string | null;
  updated: string | null;
  directBlocksCount: number;
  impactCount: number;
  leverage: number;
  priorityRank: number;
  blockerKeys: string[];
  blockedKeys: string[];
  isReady: boolean;
  onCriticalPath: boolean;
}

export type TreeNodeKind = "root" | "epicChild" | "blocker" | "cycle" | "truncated";

export interface TreeNode {
  issue: IssueSummary;
  kind: TreeNodeKind;
  children: TreeNode[];
  message?: string;
}

export interface ReadyItem extends IssueSummary {}

export interface BuildTreeResult {
  rootKey: string;
  tree: TreeNode | null;
  ready: ReadyItem[];
  criticalPath: string[];
  issuesByKey: Record<string, IssueSummary>;
  epicChildKeys: string[];
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
