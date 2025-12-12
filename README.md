# GitHub Wrapped

Year in Code: PolicyEngine team GitHub activity viewer for self-reviews.

## Features

- View commits, PRs, reviews, and issues scoped to PolicyEngine org
- Monthly activity charts
- Top repositories by contribution
- PR list with file changes and discussion stats
- Copy summary button for self-review forms

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

This generates `public/github-data.json` with team activity data.

## Development

```bash
npm run dev
```

## Build & Deploy

```bash
npm run build
```

The `dist/` folder can be deployed to GitHub Pages or any static host.

## Team Configuration

Edit `scripts/fetch-data.js` to update the team list:

```javascript
const TEAM = [
  { name: 'Max Ghenis', github: 'MaxGhenis', role: 'CEO' },
  // ...
];
```

## Date Range

Update `START_DATE` and `END_DATE` in `scripts/fetch-data.js` for different periods.
