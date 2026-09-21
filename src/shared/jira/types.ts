export interface JiraStatusCategory {
  key?: string;
  name?: string;
}

export interface JiraStatus {
  name: string;
  statusCategory?: JiraStatusCategory;
}

export interface JiraUser {
  displayName?: string;
}

export interface JiraIssueType {
  name: string;
}

export interface JiraLinkedIssueFields {
  summary: string;
  status?: { name: string };
}

export interface JiraIssueLink {
  type?: { name?: string; inward?: string; outward?: string };
  inwardIssue?: { key: string; fields?: JiraLinkedIssueFields };
  outwardIssue?: { key: string; fields?: JiraLinkedIssueFields };
}

export interface JiraIssueFields {
  summary: string;
  status: JiraStatus;
  assignee?: JiraUser | null;
  issuetype: JiraIssueType;
  issuelinks?: JiraIssueLink[];
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  isLast?: boolean;
  nextPageToken?: string;
}
