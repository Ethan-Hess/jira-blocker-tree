import { buildBlockingTree } from "../shared/buildBlockingTree";
import { issueKeyFromUrl } from "../shared/issueKey";
import { isJiraCloudOrigin, jiraOriginFromUrl } from "../shared/jiraOrigin";
import type { BackgroundRequest, BackgroundResponse, BuildTreeResult } from "../shared/types";

const ACTIVE_ISSUE_KEY = "activeIssueKey";
const ACTIVE_ORIGIN_KEY = "activeJiraOrigin";
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  result: BuildTreeResult;
  at: number;
}

const treeCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<BuildTreeResult>>();

function cacheKey(origin: string, issueKey: string): string {
  return `${origin}\0${issueKey}`;
}

async function getTree(
  origin: string,
  issueKey: string,
  force: boolean,
): Promise<BuildTreeResult> {
  if (!isJiraCloudOrigin(origin)) {
    return {
      rootKey: issueKey,
      tree: null,
      ready: [],
      criticalPath: [],
      issuesByKey: {},
      epicChildKeys: [],
      nodeCount: 0,
      truncated: false,
      error: "Open a Jira Cloud tab (https://*.atlassian.net/jira/...).",
    };
  }

  const key = cacheKey(origin, issueKey);

  if (!force) {
    const cached = treeCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.result;
    }
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = buildBlockingTree(issueKey, origin)
    .then((result) => {
      if (!result.error) {
        treeCache.set(key, { result, at: Date.now() });
      }
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  /* older Chrome */
});

chrome.runtime.onMessage.addListener(
  (
    message: BackgroundRequest,
    _sender,
    sendResponse: (
      response:
        | BackgroundResponse
        | { ok: true; issueKey: string | null; origin: string | null },
    ) => void,
  ) => {
    if (message.type === "SET_ACTIVE_ISSUE") {
      const key = message.issueKey;
      const origin = message.origin;
      const store: Record<string, string> = {};
      if (key) store[ACTIVE_ISSUE_KEY] = key;
      if (origin && isJiraCloudOrigin(origin)) store[ACTIVE_ORIGIN_KEY] = origin;
      if (Object.keys(store).length > 0) {
        chrome.storage.session.set(store).catch(() => undefined);
      }
      sendResponse({ ok: true, issueKey: key ?? null, origin: origin ?? null });
      return false;
    }

    if (message.type === "GET_ACTIVE_ISSUE") {
      chrome.storage.session
        .get([ACTIVE_ISSUE_KEY, ACTIVE_ORIGIN_KEY])
        .then((data) => {
          sendResponse({
            ok: true,
            issueKey: (data[ACTIVE_ISSUE_KEY] as string | undefined) ?? null,
            origin: (data[ACTIVE_ORIGIN_KEY] as string | undefined) ?? null,
          });
        })
        .catch(() => sendResponse({ ok: true, issueKey: null, origin: null }));
      return true;
    }

    if (message.type === "BUILD_TREE") {
      getTree(message.origin, message.issueKey, message.force === true)
        .then((data) => sendResponse({ ok: true, data }))
        .catch((e: unknown) => {
          const error = e instanceof Error ? e.message : "Failed to build tree";
          sendResponse({ ok: false, error });
        });
      return true;
    }

    return false;
  },
);

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!tab.url || changeInfo.status !== "complete") return;
  const origin = jiraOriginFromUrl(tab.url);
  if (!origin) return;

  let path: string;
  try {
    path = new URL(tab.url).pathname;
  } catch {
    return;
  }
  if (
    !path.startsWith("/browse/") &&
    !path.startsWith("/jira/") &&
    !path.startsWith("/issues/")
  ) {
    return;
  }

  const issueKey = issueKeyFromUrl(tab.url);
  if (!issueKey) return;

  chrome.storage.session
    .set({ [ACTIVE_ISSUE_KEY]: issueKey, [ACTIVE_ORIGIN_KEY]: origin })
    .catch(() => undefined);

  chrome.runtime
    .sendMessage({ type: "ISSUE_CHANGED", issueKey, origin })
    .catch(() => undefined);
});
