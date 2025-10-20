# Hyperpage

A comprehensive data aggregation dashboard that consolidates information from multiple external tools (GitHub, GitLab, Jira, etc.) into a unified, interactive interface. Built with Next.js, TypeScript, and Tailwind CSS.

## 🧪 **Quality Assurance**

**Production Ready** • **100% Test Success Rate** • **Zero Build Errors**

- ✅ **69/69 unit tests passing** with comprehensive coverage
- ✅ **Production build** completes without errors
- ✅ **TypeScript strict mode** with zero violations
- ✅ **Enterprise-grade** code quality and stability

Latest testing improvements include hardened React hook implementations, proper async state management, and comprehensive mock infrastructure for reliable CI/CD pipelines.

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

## Documentation

- **[Installation & Setup](docs/installation.md)**: Detailed setup instructions and configuration
- **[Usage Guide](docs/usage.md)**: Dashboard features and navigation
- **[Testing Guide](docs/testing.md)**: Testing strategy and quality assurance
- **[API Documentation](docs/api.md)**: Technical API reference
- **[System Architecture](docs/architecture.md)**: Core design and integration patterns
- **[Roadmap](docs/roadmap.md)**: Planned enhancements and features
- **[Deployment](docs/deployment.md)**: Production deployment and security

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines and workflow.
