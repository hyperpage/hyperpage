export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  user: { login: string; avatar_url?: string };
  created_at: string;
  updated_at: string;
  html_url: string;
  head: { ref: string };
  base: { repo: { name: string } };
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  assignee: { login: string } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  labels?: Array<{ name: string; color?: string }>;
}

export interface GitHubSearchItem {
  number: number;
  title: string;
  state: string;
  created_at: string;
  html_url: string;
  repository_url: string;
}

export interface GitHubRepository {
  owner: { login: string };
  name: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubEvent {
  id: string;
  type: string;
  actor: { login: string };
  repo: { name: string };
  payload: {
    action?: string;
    pull_request?: {
      number: number;
      title?: string;
      state?: string;
      html_url: string;
      commits?: number;
    };
    issue?: {
      number: number;
      title?: string;
      state?: string;
      html_url: string;
    };
    ref?: string;
    commits?: unknown[];
    before?: string;
    head?: string;
    size?: number;
  };
  created_at: string;
}
