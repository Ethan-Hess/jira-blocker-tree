import { buildBlockingTree } from "../shared/buildBlockingTree";
import { issueKeyFromUrl } from "../shared/issueKey";
import type { BackgroundRequest, BackgroundResponse, BuildTreeResult } from "../shared/types";

const ACTIVE_ISSUE_KEY = "activeIssueKey";
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  result: BuildTreeResult;
  at: number;
}

const treeCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<BuildTreeResult>>();

async function getTree(
  issueKey: string,
  force: boolean,
): Promise<BuildTreeResult> {
  if (!force) {
    const cached = treeCache.get(issueKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.result;
    }
  }

  const existing = inFlight.get(issueKey);
  if (existing) return existing;

  const promise = buildBlockingTree(issueKey)
    .then((result) => {
      if (!result.error) {
        treeCache.set(issueKey, { result, at: Date.now() });
      }
      return result;
    })
    .finally(() => {
      inFlight.delete(issueKey);
    });

  inFlight.set(issueKey, promise);
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
      response: BackgroundResponse | { ok: true; issueKey: string | null },
    ) => void,
  ) => {
    if (message.type === "SET_ACTIVE_ISSUE") {
      const key = message.issueKey;
      if (key) {
        chrome.storage.session
          .set({ [ACTIVE_ISSUE_KEY]: key })
          .catch(() => undefined);
      }
      sendResponse({ ok: true, issueKey: key ?? null });
      return false;
    }

    if (message.type === "GET_ACTIVE_ISSUE") {
      chrome.storage.session
        .get(ACTIVE_ISSUE_KEY)
        .then((data) => {
          sendResponse({
            ok: true,
            issueKey: (data[ACTIVE_ISSUE_KEY] as string | undefined) ?? null,
          });
        })
        .catch(() => sendResponse({ ok: true, issueKey: null }));
      return true;
    }

    if (message.type === "BUILD_TREE") {
      getTree(message.issueKey, message.force === true)
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
  const issueKey = issueKeyFromUrl(tab.url);
  if (!issueKey) return;

  chrome.storage.session
    .set({ [ACTIVE_ISSUE_KEY]: issueKey })
    .catch(() => undefined);

  chrome.runtime
    .sendMessage({ type: "ISSUE_CHANGED", issueKey })
    .catch(() => undefined);
});
