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

export function toIssueSummary(issue: JiraIssue): IssueSummary {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    statusName: issue.fields.status.name,
    statusCategory: statusCategoryFromJira(issue.fields.status.statusCategory),
    assigneeDisplayName: issue.fields.assignee?.displayName ?? null,
    issueTypeName: issue.fields.issuetype.name,
    blocksCount: outwardBlockedKeys(issue).length,
  };
}
