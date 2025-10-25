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

interface AtlassianDocument {
  type: string;
  content?: AtlassianNode[];
}

export interface AtlassianNode {
  type: string; // e.g., 'paragraph'
  content?: AtlassianContent[];
}

interface AtlassianContent {
  type: string; // e.g., 'text'
  text?: string;
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
    description?: string | AtlassianDocument; // Can be string or Atlassian Document Format object
  };
}
