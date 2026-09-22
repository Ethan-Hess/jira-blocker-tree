/** Extract Jira issue key from a browse URL path or selectedIssue query. */
export function issueKeyFromUrl(url: string): string | null {
  const ISSUE_KEY_PATTERN = /([A-Z][A-Z0-9]+-\d+)/i;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const browseMatch = path.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
    if (browseMatch) {
      return browseMatch[1].toUpperCase();
    }
    const issuesMatch = path.match(/\/issues\/([A-Z][A-Z0-9]+-\d+)/i);
    if (issuesMatch) {
      return issuesMatch[1].toUpperCase();
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

/** Stable deep link; Jira Cloud redirects from /browse/KEY. */
export function issueBrowseUrl(origin: string, key: string): string {
  return `${origin}/browse/${key}`;
}
