export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    assignee: { displayName: string } | null;
    created: string;
    updated: string;
  };
  self: string;
}

export interface JiraApiIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    assignee: { displayName: string } | null;
    updated: string;
    issuetype?: { name: string };
    labels?: string[];
    project?: { name: string; key: string };
    description?: string | any; // Can be string or Atlassian Document Format object
  };
}
