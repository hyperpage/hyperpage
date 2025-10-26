import { CommitContentItem, ToolConfig } from "../tool-types";
import { GitHubPushCommit, GitHubComparisonCommit, GitHubEvent } from "./types";

/**
 * Shared utility for processing GitHub push events and extracting commit data
 * This eliminates code duplication between commits and activity handlers
 */
export async function processGitHubPushEvent(
  event: GitHubEvent,
  config: ToolConfig,
  options: {
    commitLimit?: number; // How many commits to include (default: 2 for commits handler, 3 for activity)
    messageTruncation?: number; // Max length for commit messages (default: 60 for commits, 150 for activity)
  } = {}
): Promise<{
  messages: CommitContentItem[];
  count: number;
}> {
  const { commitLimit = 2, messageTruncation = 60 } = options;
  const eventTime = new Date(event.created_at);
  const repository = `${event.repo.name}`;
  const apiUrl = config.formatApiUrl?.("https://github.com");
  const token = process.env.GITHUB_TOKEN;

  const pushPayload = event.payload as {
    ref?: string;
    commits?: unknown[];
    before?: string;
    head?: string;
    size?: number;
  };

  const commitMessages: CommitContentItem[] = [];

  if (pushPayload.commits && pushPayload.commits.length > 0) {
    // Use the actual commits from the push event
    (pushPayload.commits as GitHubPushCommit[]).slice(0, commitLimit).forEach((pushCommit) => {
      const fullSha = pushCommit.sha;
      const shortSha = fullSha?.substring(0, 7) || 'unknown';
      const message = pushCommit.message || `Commit ${shortSha}`;
      const truncatedMessage = message.length > messageTruncation
        ? message.substring(0, messageTruncation) + '...'
        : message;

      commitMessages.push({
        type: 'commit',
        text: truncatedMessage,
        url: fullSha ? `https://github.com/${repository}/commit/${fullSha}` : undefined,
        displayId: shortSha !== 'unknown' ? shortSha : undefined,
        author: pushCommit.author?.name || event.actor.login,
        timestamp: eventTime.toISOString()
      });
    });
  } else if (pushPayload.before && pushPayload.head) {
    // Fetch commits using GitHub compare API when payload doesn't include them
    try {
      const [owner, repo] = repository.split('/');
      const compareUrl = `${apiUrl}/repos/${owner}/${repo}/compare/${pushPayload.before}...${pushPayload.head}`;

      const compareResponse = await fetch(compareUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (compareResponse.ok) {
        const compareData = await compareResponse.json();
        const commits = compareData.commits || [];

        (commits as GitHubComparisonCommit[]).slice(0, commitLimit).forEach((commit) => {
          const fullSha = commit.sha;
          const shortSha = fullSha?.substring(0, 7) || 'unknown';
          const message = commit.commit?.message || `Commit ${shortSha}`;
          const truncatedMessage = message.length > messageTruncation
            ? message.substring(0, messageTruncation) + '...'
            : message;

          commitMessages.push({
            type: 'commit',
            text: truncatedMessage,
            url: fullSha ? `https://github.com/${repository}/commit/${fullSha}` : undefined,
            displayId: shortSha !== 'unknown' ? shortSha : undefined,
            author: commit.commit?.author?.name || commit.commit?.committer?.name || commit.author?.login || event.actor.login,
            timestamp: commit.commit?.committer?.date || eventTime.toISOString()
          });
        });
      }
    } catch (error) {
      console.warn(`Failed to fetch push comparison for ${repository}:`, error);
    }
  }

  // Always include at least one entry even if no commit details
  if (commitMessages.length === 0) {
    const branch = typeof pushPayload.ref === "string"
      ? pushPayload.ref.split("/").pop()
      : "unknown";
    commitMessages.push({
      type: 'commit',
      text: `Code push to ${repository}/${branch}`,
      author: event.actor.login,
      timestamp: eventTime.toISOString()
    });
  }

  return {
    messages: commitMessages,
    count: commitMessages.length
  };
}
