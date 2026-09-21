import { BLOCKS_LINK_TYPE } from "../constants";
import type { IssueSummary, StatusCategoryKey } from "../types";
import type { JiraIssue, JiraIssueLink } from "./types";

function statusCategoryFromJira(statusCategory?: {
  key?: string;
  name?: string;
}): StatusCategoryKey {
  const key = statusCategory?.key?.toLowerCase();
  if (key === "new" || key === "indeterminate" || key === "done") {
    return key;
  }
  const name = statusCategory?.name?.toLowerCase() ?? "";
  if (name.includes("done")) return "done";
  if (name.includes("progress")) return "indeterminate";
  if (name.includes("to do") || name.includes("todo")) return "new";
  return "unknown";
}

function isBlocksLink(link: JiraIssueLink): boolean {
  return link.type?.name === BLOCKS_LINK_TYPE;
}

export function isIssueDone(issue: JiraIssue): boolean {
  return statusCategoryFromJira(issue.fields.status.statusCategory) === "done";
}

export function inwardBlockerKeys(issue: JiraIssue): string[] {
  const links = issue.fields.issuelinks ?? [];
  return links
    .filter((link) => isBlocksLink(link) && link.inwardIssue?.key)
    .map((link) => link.inwardIssue!.key);
}

export function outwardBlockedKeys(issue: JiraIssue): string[] {
  const links = issue.fields.issuelinks ?? [];
  return links
    .filter((link) => isBlocksLink(link) && link.outwardIssue?.key)
    .map((link) => link.outwardIssue!.key);
}

const EMPTY_METRICS = {
  directBlocksCount: 0,
  impactCount: 0,
  leverage: 0,
  priorityRank: 99,
  isReady: false,
  onCriticalPath: false,
};

export function toIssueSummary(
  issue: JiraIssue,
  metrics: Partial<typeof EMPTY_METRICS> = {},
): IssueSummary {
  const blockedKeys = outwardBlockedKeys(issue);
  const blockerKeys = inwardBlockerKeys(issue);
  return {
    key: issue.key,
    summary: issue.fields.summary,
    statusName: issue.fields.status.name,
    statusCategory: statusCategoryFromJira(issue.fields.status.statusCategory),
    assigneeDisplayName: issue.fields.assignee?.displayName ?? null,
    issueTypeName: issue.fields.issuetype.name,
    priorityName: issue.fields.priority?.name ?? null,
    priorityId: issue.fields.priority?.id ?? null,
    updated: issue.fields.updated ?? null,
    directBlocksCount: metrics.directBlocksCount ?? blockedKeys.length,
    impactCount: metrics.impactCount ?? 0,
    leverage: metrics.leverage ?? 0,
    priorityRank: metrics.priorityRank ?? 99,
    blockerKeys,
    blockedKeys,
    isReady: metrics.isReady ?? false,
    onCriticalPath: metrics.onCriticalPath ?? false,
  };
}

export function placeholderIssueSummary(
  key: string,
  summary: string,
): IssueSummary {
  return {
    key,
    summary,
    statusName: "",
    statusCategory: "unknown",
    assigneeDisplayName: null,
    issueTypeName: "",
    priorityName: null,
    priorityId: null,
    updated: null,
    blockerKeys: [],
    blockedKeys: [],
    ...EMPTY_METRICS,
  };
}
