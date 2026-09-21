import { ISSUE_FIELDS, JIRA_ORIGIN } from "../constants";
import type { JiraIssue, JiraSearchResponse } from "./types";

const API_HEADERS: HeadersInit = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Atlassian-Token": "no-check",
};

/** Jira rejects very large `key in (...)` clauses, so page the keys. */
const KEY_BATCH_SIZE = 50;

async function jiraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${JIRA_ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...API_HEADERS,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Jira API ${response.status}: ${body.slice(0, 200) || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchIssue(key: string): Promise<JiraIssue> {
  return jiraFetch<JiraIssue>(
    `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${ISSUE_FIELDS}`,
  );
}

export async function searchIssuesByJql(jql: string): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  do {
    const body: Record<string, unknown> = {
      jql,
      fields: ISSUE_FIELDS.split(","),
      maxResults: 100,
    };
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    const page = await jiraFetch<JiraSearchResponse>("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify(body),
    });

    issues.push(...(page.issues ?? []));
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
  } while (nextPageToken);

  return issues;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Load many issues in as few round trips as possible. One JQL search per batch
 * of keys, batches run in parallel.
 */
export async function fetchIssuesByKeys(keys: string[]): Promise<JiraIssue[]> {
  if (keys.length === 0) return [];

  const batches = chunk(keys, KEY_BATCH_SIZE);
  const results = await Promise.all(
    batches.map((batch) => {
      const list = batch.map((key) => `"${key.replace(/"/g, '\\"')}"`).join(",");
      return searchIssuesByJql(`key in (${list})`);
    }),
  );

  return results.flat();
}

export async function fetchEpicChildren(epicKey: string): Promise<JiraIssue[]> {
  const escaped = epicKey.replace(/"/g, '\\"');
  return searchIssuesByJql(`parentEpic = "${escaped}" ORDER BY rank ASC`);
}
