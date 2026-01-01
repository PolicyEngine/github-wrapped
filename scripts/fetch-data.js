#!/usr/bin/env node

/**
 * Fetches GitHub data for ALL PolicyEngine contributors in 2025.
 * Discovers contributors automatically from org activity.
 * Run with: node scripts/fetch-data.js
 * Requires: GITHUB_TOKEN environment variable (for higher rate limits)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GITHUB_ORG = 'PolicyEngine';
const START_DATE = '2025-01-01';
const END_DATE = '2025-12-31';
const MIN_CONTRIBUTIONS = 1; // Include anyone with at least 1 commit or PR

// Merge alternate accounts into primary accounts
// Key = alias, Value = primary account
const ACCOUNT_ALIASES = {
  'eccuraa': 'elenacura',
  'nwoodruff-co': 'nikhilwoodruff'
};

// Accounts to exclude (bots, etc.)
const EXCLUDED_ACCOUNTS = ['PolicyEngine-Bot'];

const TOKEN = process.env.GITHUB_TOKEN;
const headers = {
  'Accept': 'application/vnd.github.v3+json',
  ...(TOKEN && { 'Authorization': `token ${TOKEN}` })
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJSON(url) {
  console.log(`  Fetching: ${url.substring(0, 80)}...`);
  const response = await fetch(url, { headers });

  if (response.status === 403) {
    const resetTime = response.headers.get('x-ratelimit-reset');
    const waitSeconds = resetTime ? Math.max(0, parseInt(resetTime) - Math.floor(Date.now() / 1000)) : 60;
    console.log(`  Rate limited. Waiting ${waitSeconds}s...`);
    await sleep(waitSeconds * 1000 + 1000);
    return fetchJSON(url);
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchAllPages(baseUrl, maxPages = 10) {
  const items = [];
  let page = 1;
  let realTotalCount = 0;

  while (page <= maxPages) {
    const url = `${baseUrl}&page=${page}&per_page=100`;
    const data = await fetchJSON(url);

    if (page === 1 && data.total_count !== undefined) {
      realTotalCount = data.total_count;
    }

    if (!data.items || data.items.length === 0) break;

    items.push(...data.items);

    if (data.items.length < 100) break;
    page++;
    await sleep(500);
  }

  return { items, total_count: realTotalCount || items.length };
}

async function discoverContributors() {
  console.log('\nDiscovering org contributors...');
  const contributors = new Map();

  // Get commits from the org (scan up to 1000, the GitHub API max)
  console.log('  Scanning commits...');
  const commitsUrl = `https://api.github.com/search/commits?q=org:${GITHUB_ORG}+committer-date:${START_DATE}..${END_DATE}`;
  const commitsData = await fetchAllPages(commitsUrl, 10);

  for (const commit of commitsData.items) {
    const author = commit.author;
    const isBot = author?.login?.includes('[bot]') || EXCLUDED_ACCOUNTS.includes(author?.login);
    if (author && author.login && !isBot) {
      // Resolve alias to primary account
      const login = ACCOUNT_ALIASES[author.login] || author.login;
      const existing = contributors.get(login) || { commits: 0, prs: 0, aliases: [] };
      existing.commits++;
      existing.avatar = author.avatar_url;
      if (author.login !== login && !existing.aliases.includes(author.login)) {
        existing.aliases.push(author.login);
      }
      contributors.set(login, existing);
    }
  }

  await sleep(2000);

  // Get PRs from the org (scan up to 1000, the GitHub API max)
  console.log('  Scanning PRs...');
  const prsUrl = `https://api.github.com/search/issues?q=org:${GITHUB_ORG}+type:pr+created:${START_DATE}..${END_DATE}`;
  const prsData = await fetchAllPages(prsUrl, 10);

  for (const pr of prsData.items) {
    const author = pr.user;
    const isPrBot = author?.login?.includes('[bot]') || EXCLUDED_ACCOUNTS.includes(author?.login);
    if (author && author.login && !isPrBot) {
      // Resolve alias to primary account
      const login = ACCOUNT_ALIASES[author.login] || author.login;
      const existing = contributors.get(login) || { commits: 0, prs: 0, aliases: [] };
      existing.prs++;
      existing.avatar = author.avatar_url;
      if (author.login !== login && !existing.aliases.includes(author.login)) {
        existing.aliases.push(author.login);
      }
      contributors.set(login, existing);
    }
  }

  // Filter to contributors with minimum activity
  const activeContributors = [];
  for (const [login, data] of contributors) {
    const total = data.commits + data.prs;
    if (total >= MIN_CONTRIBUTIONS) {
      activeContributors.push({
        github: login,
        name: login, // Will be updated with real name if available
        avatar: data.avatar,
        estimatedActivity: total,
        aliases: data.aliases || []
      });
    }
  }

  // Sort by activity
  activeContributors.sort((a, b) => b.estimatedActivity - a.estimatedActivity);

  console.log(`  Found ${activeContributors.length} active contributors`);
  return activeContributors;
}

async function fetchUserProfile(github) {
  try {
    const url = `https://api.github.com/users/${github}`;
    const user = await fetchJSON(url);
    return {
      name: user.name || github,
      avatar: user.avatar_url,
      bio: user.bio,
      company: user.company,
      location: user.location
    };
  } catch (e) {
    return { name: github };
  }
}

async function fetchPRFiles(owner, repo, prNumber) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    const files = await fetchJSON(url);
    return files;
  } catch (e) {
    return [];
  }
}

async function fetchPRDetails(owner, repo, prNumber) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const pr = await fetchJSON(url);
    return { commits: pr.commits, review_comments: pr.review_comments };
  } catch (e) {
    return { commits: 0, review_comments: 0 };
  }
}

async function fetchMemberData(member) {
  console.log(`\nFetching data for @${member.github}...`);
  const aliases = member.aliases || [];
  const allAccounts = [member.github, ...aliases];

  // Get user profile
  const profile = await fetchUserProfile(member.github);
  member.name = profile.name;
  member.avatar = profile.avatar || member.avatar;
  member.bio = profile.bio;

  await sleep(500);

  // Fetch commits for all accounts (primary + aliases)
  console.log('  Commits...');
  const allCommits = [];
  let totalCommits = 0;
  for (const account of allAccounts) {
    const commitsUrl = `https://api.github.com/search/commits?q=author:${account}+org:${GITHUB_ORG}+committer-date:${START_DATE}..${END_DATE}`;
    const commitsData = await fetchAllPages(commitsUrl, 10);
    allCommits.push(...commitsData.items);
    totalCommits += commitsData.total_count;
    await sleep(500);
  }

  await sleep(500);

  // Fetch PRs authored for all accounts (excluding automated dependency updates)
  console.log('  PRs authored...');
  const allPRs = [];
  let totalPRs = 0;
  for (const account of allAccounts) {
    // Exclude automated "Update PolicyEngine" PRs using NOT keyword
    const prsUrl = `https://api.github.com/search/issues?q=author:${account}+org:${GITHUB_ORG}+type:pr+created:${START_DATE}..${END_DATE}+NOT+%22Update+PolicyEngine%22`;
    const prsData = await fetchAllPages(prsUrl, 10);
    allPRs.push(...prsData.items);
    totalPRs += prsData.total_count;
    await sleep(500);
  }

  await sleep(500);

  // Fetch PRs reviewed for all accounts
  console.log('  PRs reviewed...');
  let totalReviews = 0;
  const allReviews = [];
  for (const account of allAccounts) {
    const reviewsUrl = `https://api.github.com/search/issues?q=reviewed-by:${account}+org:${GITHUB_ORG}+type:pr+created:${START_DATE}..${END_DATE}`;
    const reviewsData = await fetchAllPages(reviewsUrl, 5);
    allReviews.push(...reviewsData.items);
    totalReviews += reviewsData.total_count;
    await sleep(500);
  }

  await sleep(500);

  // Fetch issues created for all accounts
  console.log('  Issues created...');
  let totalIssues = 0;
  const allIssues = [];
  for (const account of allAccounts) {
    const issuesUrl = `https://api.github.com/search/issues?q=author:${account}+org:${GITHUB_ORG}+type:issue+created:${START_DATE}..${END_DATE}`;
    const issuesData = await fetchAllPages(issuesUrl, 5);
    allIssues.push(...issuesData.items);
    totalIssues += issuesData.total_count;
    await sleep(500);
  }

  // Fetch PR details for top 30 PRs
  console.log('  Fetching PR details...');
  const prsWithFiles = [];
  for (const pr of allPRs.slice(0, 30)) {
    const repoName = pr.repository_url.split('/').pop();
    await sleep(300);
    const [files, details] = await Promise.all([
      fetchPRFiles(GITHUB_ORG, repoName, pr.number),
      fetchPRDetails(GITHUB_ORG, repoName, pr.number)
    ]);
    prsWithFiles.push({
      ...pr,
      commits: details.commits,
      review_comments: details.review_comments,
      files: files.map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
      }))
    });
  }

  // Process commits by repo
  const repoCommits = {};
  for (const commit of allCommits) {
    const repo = commit.repository.name;
    repoCommits[repo] = (repoCommits[repo] || 0) + 1;
  }

  // Count unique repos contributed to
  const reposContributed = new Set();
  for (const commit of allCommits) {
    reposContributed.add(commit.repository.name);
  }
  for (const pr of allPRs) {
    reposContributed.add(pr.repository_url.split('/').pop());
  }

  // Process monthly activity
  const monthlyPRs = new Array(12).fill(0);
  const monthlyCommits = new Array(12).fill(0);

  for (const pr of allPRs) {
    const month = new Date(pr.created_at).getMonth();
    monthlyPRs[month]++;
  }

  for (const commit of allCommits) {
    const date = commit.commit?.author?.date || commit.commit?.committer?.date;
    if (date) {
      const month = new Date(date).getMonth();
      monthlyCommits[month]++;
    }
  }

  return {
    member,
    stats: {
      commits: totalCommits,
      prs: totalPRs,
      reviews: totalReviews,
      issues: totalIssues,
      repos: reposContributed.size,
    },
    repoCommits,
    monthlyPRs,
    monthlyCommits,
    prs: prsWithFiles,
    reviews: allReviews.slice(0, 30),
    issues: allIssues.slice(0, 30),
    commits: allCommits.slice(0, 100).map(c => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0],
      date: c.commit.author?.date,
      repo: c.repository.name,
    })),
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('PolicyEngine GitHub Wrapped - Org-Wide Data Fetcher');
  console.log(`Period: ${START_DATE} to ${END_DATE}`);
  console.log(`Token: ${TOKEN ? 'Provided' : 'Not provided (60 req/hr limit)'}`);
  console.log('='.repeat(60));

  if (!TOKEN) {
    console.log('\nWARNING: No GITHUB_TOKEN set. Rate limit is 60 requests/hour.');
    console.log('Set it with: export GITHUB_TOKEN=your_token_here\n');
  }

  // Discover all contributors
  const contributors = await discoverContributors();

  const allData = {
    fetchedAt: new Date().toISOString(),
    period: { start: START_DATE, end: END_DATE },
    org: GITHUB_ORG,
    contributorCount: contributors.length,
    members: {}
  };

  for (const member of contributors) {
    try {
      const data = await fetchMemberData(member);
      allData.members[member.github] = data;
      console.log(`  ✓ ${data.member.name}: ${data.stats.commits} commits, ${data.stats.prs} PRs`);
    } catch (error) {
      console.error(`  ✗ Error fetching ${member.github}: ${error.message}`);
      allData.members[member.github] = { member, error: error.message };
    }

    await sleep(2000);
  }

  // Write to file
  const outputPath = `${__dirname}/../public/github-data.json`;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(allData, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`✓ Data saved to ${outputPath}`);
  console.log(`✓ ${Object.keys(allData.members).length} contributors included`);
  console.log('='.repeat(60));
}

main().catch(console.error);
