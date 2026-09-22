const ATLASSIAN_HOST = /^[a-z0-9-]+\.atlassian\.net$/i;

/** True when origin is a Jira Cloud site on *.atlassian.net. */
export function isJiraCloudOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && ATLASSIAN_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/** Extract https://tenant.atlassian.net from a page or tab URL, or null. */
export function jiraOriginFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !ATLASSIAN_HOST.test(parsed.hostname)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}
