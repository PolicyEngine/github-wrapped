# GitHub Wrapped

Year in Code: View your PolicyEngine GitHub contributions.

**Live site:** https://policyengine.github.io/github-wrapped/

## Features

- Auto-discovers all PolicyEngine org contributors
- View commits, PRs, reviews, and issues
- Monthly activity charts
- Top repositories by contribution
- PR list with file changes and discussion stats
- Copy summary button for self-reviews

## How It Works

The data fetcher automatically discovers anyone who contributed to PolicyEngine repos in 2025 (5+ commits or PRs). No manual team list required.

## Setup

```bash
npm install
```

## Fetch GitHub Data

Requires a GitHub token for higher rate limits:

```bash
export GITHUB_TOKEN=your_token_here
node scripts/fetch-data.js
```

This generates `public/github-data.json` with contributor activity data.

## Development

```bash
npm run dev
```

## Deployment

Deployed automatically via GitHub Actions to GitHub Pages.

Data is refreshed weekly (Mondays 6am UTC) or can be triggered manually via the "Refresh GitHub Data" workflow.
