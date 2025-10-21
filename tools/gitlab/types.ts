export interface GitLabMergeRequest {
  iid: number;
  title: string;
  project_id: number;
  state: string;
  author: { name: string } | null;
  created_at: string;
  web_url: string;
}

export interface GitLabProject {
  id: number;
  name: string;
}

export interface GitLabPipeline {
  ref: string;
  status: string;
  duration: number | null;
  finished_at: string | null;
}

export interface GitLabIssue {
  iid: number;
  title: string;
  state: string;
  assignee: { name: string } | null;
  created_at: string;
  web_url: string;
}

export interface GitLabEvent {
  id: number;
  action_name: string;
  target_type?: string;
  target_title?: string;
  target_url?: string;
  target_iid?: number;
  push_data?: {
    ref?: string;
    commit_count?: number;
    commit_from?: string;
    commit_to?: string;
  };
  author?: { name: string };
  author_username?: string;
  project_path?: string;
  project_id?: number;
  created_at: string;
}
