const ISSUE_KEY_PATTERN = /([A-Z][A-Z0-9]+-\d+)/;

/** Extract Jira issue key from a browse URL path or hash. */
export function issueKeyFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const browseMatch = path.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
    if (browseMatch) {
      return browseMatch[1].toUpperCase();
    }
    const selectedMatch = parsed.searchParams.get("selectedIssue");
    if (selectedMatch && ISSUE_KEY_PATTERN.test(selectedMatch)) {
      return selectedMatch.toUpperCase();
    }
  } catch {
    return null;
  }
  return null;
}

export function issueBrowseUrl(key: string): string {
  return `https://your-site.atlassian.net/browse/${key}`;
}
