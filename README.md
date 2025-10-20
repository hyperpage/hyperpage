# Hyperpage

A comprehensive data aggregation dashboard that consolidates information from multiple external tools (GitHub, GitLab, Jira, etc.) into a unified, interactive interface. Built with Next.js, TypeScript, and Tailwind CSS.

## Overview

Hyperpage solves the challenge of scattered development data across multiple platforms. For development teams and project managers, it provides a single pane of glass to monitor code reviews, CI/CD pipelines, tickets, and activity feeds from your entire toolchain.

Connect multiple tools and instantly gain unified visibility into:
- **Code Reviews**: GitHub PRs and GitLab MRs in one view
- **CI/CD Pipelines**: Consolidated pipeline status and workflows
- **Issue Tracking**: Jira tickets alongside GitHub/GitLab issues
- **Activity Feeds**: Real-time updates from all connected platforms

## Quick Start

```bash
# Clone and install
git clone https://github.com/hyperpage/hyperpage.git
cd hyperpage
npm install

# Configure environment
cp .env.local.sample .env.local
# Edit .env.local to enable your tools (see docs/installation.md)

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view your dashboard.

## Usage Examples

**Enable GitHub Integration:**
```env
ENABLE_GITHUB=true
GITHUB_TOKEN=github_pat_...
```

**Add Jira for Ticketing:**
```env
ENABLE_JIRA=true
JIRA_WEB_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your_email@company.com
JIRA_API_TOKEN=ATATT3x...
```

**View Unified Code Reviews:**
Once configured, the dashboard automatically aggregates PRs/MRs from all enabled platforms in the Code Reviews tab.

## Project Structure

```
hyperpage/
├── app/              # Next.js app directory
├── components/       # Shared UI components
├── tools/           # Tool integrations
├── docs/            # Detailed documentation
└── .clinerules/     # Development guidelines
```

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines and workflow.
