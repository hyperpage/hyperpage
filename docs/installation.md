# Installation & Setup

This guide covers the detailed installation process, system requirements, and configuration for Hyperpage.

## Prerequisites

- **Node.js 18+** installed (recommended: 20+ for best performance)
- **npm 9+** package manager
- Access to your development tool accounts (GitHub, GitLab, Jira, etc.)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hyperpage/hyperpage.git
   cd hyperpage
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Copy environment template:**
   ```bash
   cp .env.local.sample .env.local
   ```

## Configuration

Edit `.env.local` to configure your tool integrations. The system uses environment variables to enable/disable tools and provide authentication.

### Core Configuration

```env
# Enable/disable tool integrations
ENABLE_JIRA=false          # Enable JIRA integration
ENABLE_GITHUB=false        # Enable GitHub integration
ENABLE_GITLAB=false        # Enable GitLab integration
ENABLE_CODE_REVIEWS=false  # Show code review widgets
ENABLE_CICD=false          # Show CI/CD pipeline widgets
ENABLE_TICKETING=false     # Show unified ticketing widgets
```

### Tool-Specific Configuration

#### GitHub Integration
```env
ENABLE_GITHUB=true
GITHUB_TOKEN=github_pat_...             # Personal access token
GITHUB_USERNAME=your_github_username
```

To create a GitHub Personal Access Token:
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with these permissions:
   - `repo` (Full control of private repositories)
   - `read:org` (Read org and team membership, if using organization repos)
3. Copy the token and add it to your `.env.local`

#### GitLab Integration
```env
ENABLE_GITLAB=true
GITLAB_WEB_URL=https://gitlab.com       # Your GitLab instance URL
GITLAB_TOKEN=your_personal_access_token
```

To create a GitLab Personal Access Token:
1. Go to GitLab → User Settings → Access Tokens
2. Create token with `api` scope
3. Copy the token to your environment file

#### Jira Integration
```env
ENABLE_JIRA=true
JIRA_WEB_URL=https://your-domain.atlassian.net  # Your Jira instance URL
JIRA_EMAIL=your_email@company.com               # Your Atlassian account email
JIRA_API_TOKEN=ATATT3x...                       # Personal access token
```

To create a Jira API Token:
1. Go to Atlassian Account → Security → API tokens
2. Create new token
3. Copy the token to your environment file

### URL Auto-Derivation

The system automatically derives API URLs from web URLs using consistent patterns:

- **Jira**: `webUrl + '/rest/api/3'` → `https://domain.atlassian.net/rest/api/3`
- **GitLab**: `webUrl + '/api/v4'` → `https://gitlab.com/api/v4`
- **GitHub**: Always uses `https://api.github.com` (independent of web URL)

Only web URLs need to be configured in environment variables.

## Development Setup

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Access the portal:**
   Open [http://localhost:3000](http://localhost:3000) in your browser

3. **Enable tools:**
   - Edit `.env.local` to set `ENABLE_TOOL=true` for desired integrations
   - Restart the development server
   - Tool widgets will appear on the portal automatically

## Production Build

1. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

2. **Or use the production script:**
   ```bash
   npm run build:start
   ```

## Troubleshooting

### Common Issues

**"Tool not appearing on portal"**
- Verify `ENABLE_TOOL=true` in `.env.local`
- Restart the development server after configuration changes
- Check that all required environment variables are set

**"API authentication errors"**
- Verify your API tokens are valid and have correct permissions
- Check that tool URLs match your instance (especially for self-hosted GitLab/Jira)
- Review console logs for detailed error messages

**"Build failures"**
- Ensure you're using Node.js 18+
- Try clearing node_modules: `rm -rf node_modules && npm install`
- Check for TypeScript compilation errors

### Security Notes

- Environment variables with API tokens are only accessible server-side
- Credentials are never exposed to client-side code
- All tool configurations pass security audit standards
- See `docs/deployment.md` for security considerations in production

## Next Steps

Once installed and configured:
- See [`docs/usage.md`](usage.md) for comprehensive portal features and navigation
- Read [`docs/testing.md`](testing.md) for testing strategy and quality assurance
- Check [`docs/api.md`](api.md) for technical integration details
- Review [`docs/architecture.md`](architecture.md) for system design patterns
