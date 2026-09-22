import type { BackgroundRequest, BackgroundResponse, BuildTreeResult } from "./types";

export async function requestBuildTree(
  issueKey: string,
  origin: string,
  force = false,
): Promise<BuildTreeResult> {
  const response = (await chrome.runtime.sendMessage({
    type: "BUILD_TREE",
    issueKey,
    origin,
    force,
  } satisfies BackgroundRequest)) as BackgroundResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function getActiveIssue(): Promise<{
  issueKey: string | null;
  origin: string | null;
}> {
  const response = (await chrome.runtime.sendMessage({
    type: "GET_ACTIVE_ISSUE",
  })) as { ok: true; issueKey: string | null; origin: string | null };
  return { issueKey: response.issueKey, origin: response.origin };
}

/** @deprecated Prefer getActiveIssue(); kept for call sites that only need the key. */
export async function getActiveIssueKey(): Promise<string | null> {
  const { issueKey } = await getActiveIssue();
  return issueKey;
}
