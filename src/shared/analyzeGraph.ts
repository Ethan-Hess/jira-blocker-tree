import {
  inwardBlockerKeys,
  isIssueDone,
  outwardBlockedKeys,
  toIssueSummary,
} from "./jira/mapIssue";
import type { JiraIssue } from "./jira/types";
import type { ReadyItem } from "./types";

export interface IssueMetrics {
  directBlocksCount: number;
  impactCount: number;
  leverage: number;
  isReady: boolean;
  onCriticalPath: boolean;
  priorityRank: number;
}

export interface AnalyzeGraphResult {
  ready: ReadyItem[];
  criticalPath: string[];
  byKey: Map<string, IssueMetrics>;
}

/** Lower rank = higher priority (Jira default ids when present). */
export function priorityRank(issue: JiraIssue): number {
  const id = issue.fields.priority?.id;
  if (id && /^\d+$/.test(id)) return Number.parseInt(id, 10);
  const name = (issue.fields.priority?.name ?? "").toLowerCase();
  if (name.includes("highest")) return 1;
  if (name === "high") return 2;
  if (name.includes("medium")) return 3;
  if (name === "low") return 4;
  if (name.includes("lowest")) return 5;
  return 99;
}

/** Higher weight = more important Jira priority (for leverage). */
export function priorityWeight(issue: JiraIssue): number {
  const rank = priorityRank(issue);
  if (rank >= 1 && rank <= 5) return 6 - rank;
  return 1;
}

function openInwardBlockerKeys(
  issue: JiraIssue,
  issues: Map<string, JiraIssue>,
): string[] {
  return inwardBlockerKeys(issue).filter((key) => {
    const blocker = issues.get(key);
    return blocker && !isIssueDone(blocker);
  });
}

function computeImpactCount(
  startKey: string,
  issues: Map<string, JiraIssue>,
): number {
  const visited = new Set<string>();
  const queue = [startKey];

  while (queue.length > 0) {
    const key = queue.shift()!;
    if (visited.has(key)) continue;
    visited.add(key);

    const issue = issues.get(key);
    if (!issue || isIssueDone(issue)) continue;

    for (const blockedKey of outwardBlockedKeys(issue)) {
      const blocked = issues.get(blockedKey);
      if (!blocked || isIssueDone(blocked)) continue;
      if (!visited.has(blockedKey)) queue.push(blockedKey);
    }
  }

  visited.delete(startKey);
  return visited.size;
}

function openChainDepth(
  key: string,
  issues: Map<string, JiraIssue>,
  memo: Map<string, number>,
  visiting: Set<string>,
): number {
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  if (visiting.has(key)) return 0;

  visiting.add(key);
  const issue = issues.get(key);
  if (!issue || isIssueDone(issue)) {
    memo.set(key, 0);
    visiting.delete(key);
    return 0;
  }

  const blockers = openInwardBlockerKeys(issue, issues);
  if (blockers.length === 0) {
    memo.set(key, 1);
    visiting.delete(key);
    return 1;
  }

  let maxChild = 0;
  for (const blockerKey of blockers) {
    maxChild = Math.max(
      maxChild,
      openChainDepth(blockerKey, issues, memo, visiting),
    );
  }
  const depth = 1 + maxChild;
  memo.set(key, depth);
  visiting.delete(key);
  return depth;
}

function buildCriticalPath(
  rootKey: string,
  issues: Map<string, JiraIssue>,
): string[] {
  const memo = new Map<string, number>();
  const path: string[] = [rootKey];
  let current = rootKey;

  for (;;) {
    const issue = issues.get(current);
    if (!issue || isIssueDone(issue)) break;

    const blockers = openInwardBlockerKeys(issue, issues);
    if (blockers.length === 0) break;

    blockers.sort((a, b) => {
      const depthA = openChainDepth(a, issues, memo, new Set());
      const depthB = openChainDepth(b, issues, memo, new Set());
      if (depthB !== depthA) return depthB - depthA;

      const issueA = issues.get(a)!;
      const issueB = issues.get(b)!;
      const impactA = computeImpactCount(a, issues);
      const impactB = computeImpactCount(b, issues);
      if (impactB !== impactA) return impactB - impactA;

      const rankA = priorityRank(issueA);
      const rankB = priorityRank(issueB);
      if (rankA !== rankB) return rankA - rankB;

      return a.localeCompare(b);
    });

    const next = blockers[0];
    path.unshift(next);
    current = next;
  }

  return path;
}

export function analyzeGraph(
  issues: Map<string, JiraIssue>,
  rootKey: string,
): AnalyzeGraphResult {
  const criticalPath = buildCriticalPath(rootKey, issues);
  const criticalSet = new Set(criticalPath);

  const byKey = new Map<string, IssueMetrics>();
  const ready: ReadyItem[] = [];

  for (const issue of issues.values()) {
    const directBlocksCount = outwardBlockedKeys(issue).length;
    const impactCount = computeImpactCount(issue.key, issues);
    const open = !isIssueDone(issue);
    const hasOpenBlockers =
      openInwardBlockerKeys(issue, issues).length > 0;
    const isReady = open && !hasOpenBlockers;
    const onCriticalPath = criticalSet.has(issue.key);

    const rank = priorityRank(issue);
    const weight = priorityWeight(issue);
    const metrics: IssueMetrics = {
      directBlocksCount,
      impactCount,
      leverage: impactCount * weight,
      isReady,
      onCriticalPath,
      priorityRank: rank,
    };
    byKey.set(issue.key, metrics);

    if (isReady) {
      ready.push(toIssueSummary(issue, metrics));
    }
  }

  ready.sort((a, b) => {
    if (b.impactCount !== a.impactCount) return b.impactCount - a.impactCount;
    const rankA = byKey.get(a.key)?.priorityRank ?? 99;
    const rankB = byKey.get(b.key)?.priorityRank ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.key.localeCompare(b.key);
  });

  return { ready, criticalPath, byKey };
}
