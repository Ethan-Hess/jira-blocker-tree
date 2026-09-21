import type { BackgroundRequest, BackgroundResponse, BuildTreeResult } from "./types";

export async function requestBuildTree(
  issueKey: string,
  force = false,
): Promise<BuildTreeResult> {
  const response = (await chrome.runtime.sendMessage({
    type: "BUILD_TREE",
    issueKey,
    force,
  } satisfies BackgroundRequest)) as BackgroundResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function getActiveIssueKey(): Promise<string | null> {
  const response = (await chrome.runtime.sendMessage({
    type: "GET_ACTIVE_ISSUE",
  })) as { ok: true; issueKey: string | null };
  return response.issueKey;
}
