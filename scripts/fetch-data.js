#!/usr/bin/env node

/**
 * Fetches all GitHub data for PolicyEngine team members for 2025.
 * Run with: node scripts/fetch-data.js
 * Requires: GITHUB_TOKEN environment variable (for higher rate limits)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GITHUB_ORG = 'PolicyEngine';
const START_DATE = '2025-01-01';
const END_DATE = '2025-12-08';

const TEAM = [
  { name: 'Max Ghenis', github: 'MaxGhenis', role: 'CEO' },
  { name: 'Nikhil Woodruff', github: 'nikhilwoodruff', role: 'CTO' },
  { name: 'Pavel Makarchuk', github: 'PavelMakarchuk', role: 'Director of Growth' },
  { name: 'Vahid Ahmadi', github: 'vahid-ahmadi', role: 'UK Research Associate' },
  { name: 'Daphne Hansell', github: 'daphnehanse11', role: 'Health Policy Analyst' },
  { name: 'Sakshi Kekre', github: 'SakshiKekre', role: 'Software Engineer' },
];

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

    // Capture the real total from GitHub's response (first page has it)
    if (page === 1 && data.total_count !== undefined) {
      realTotalCount = data.total_count;
    }

    if (!data.items || data.items.length === 0) break;

    items.push(...data.items);

    if (data.items.length < 100) break;
    page++;
    await sleep(500); // Be nice to the API
  }

  return { items, total_count: realTotalCount || items.length };
}

async function fetchPRFiles(owner, repo, prNumber) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    const files = await fetchJSON(url);
    return files;
  } catch (e) {
    console.log(`    Could not fetch files for PR #${prNumber}: ${e.message}`);
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
  console.log(`\nFetching data for ${member.name} (@${member.github})...`);

  // Fetch commits (search API)
  console.log('  Commits...');
  const commitsUrl = `https://api.github.com/search/commits?q=author:${member.github}+org:${GITHUB_ORG}+committer-date:${START_DATE}..${END_DATE}`;
  const commitsData = await fetchAllPages(commitsUrl, 10);

  await sleep(1000);

  // Fetch PRs authored
  console.log('  PRs authored...');
  const prsUrl = `https://api.github.com/search/issues?q=author:${member.github}+org:${GITHUB_ORG}+type:pr+created:${START_DATE}..${END_DATE}`;
  const prsData = await fetchAllPages(prsUrl, 10);

  await sleep(1000);

  // Fetch PRs reviewed
  console.log('  PRs reviewed...');
  const reviewsUrl = `https://api.github.com/search/issues?q=reviewed-by:${member.github}+org:${GITHUB_ORG}+type:pr+created:${START_DATE}..${END_DATE}`;
  const reviewsData = await fetchAllPages(reviewsUrl, 5);

  await sleep(1000);

  // Fetch issues created
  console.log('  Issues created...');
  const issuesUrl = `https://api.github.com/search/issues?q=author:${member.github}+org:${GITHUB_ORG}+type:issue+created:${START_DATE}..${END_DATE}`;
  const issuesData = await fetchAllPages(issuesUrl, 5);

  // For each PR, fetch the files changed and commit count
  console.log('  Fetching PR details...');
  const prsWithFiles = [];
  for (const pr of prsData.items.slice(0, 50)) { // Limit to 50 most recent PRs
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
  for (const commit of commitsData.items) {
    const repo = commit.repository.name;
    repoCommits[repo] = (repoCommits[repo] || 0) + 1;
  }

  // Process monthly activity
  const monthlyPRs = new Array(12).fill(0);
  const monthlyCommits = new Array(12).fill(0);

  for (const pr of prsData.items) {
    const month = new Date(pr.created_at).getMonth();
    monthlyPRs[month]++;
  }

  for (const commit of commitsData.items) {
    const date = commit.commit?.author?.date || commit.commit?.committer?.date;
    if (date) {
      const month = new Date(date).getMonth();
      monthlyCommits[month]++;
    }
  }

  return {
    member,
    stats: {
      commits: commitsData.total_count,
      prs: prsData.total_count,
      reviews: reviewsData.total_count,
      issues: issuesData.total_count,
    },
    repoCommits,
    monthlyPRs,
    monthlyCommits,
    prs: prsWithFiles,
    reviews: reviewsData.items.slice(0, 30),
    issues: issuesData.items.slice(0, 30),
    commits: commitsData.items.slice(0, 100).map(c => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0],
      date: c.commit.author?.date,
      repo: c.repository.name,
    })),
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('PolicyEngine GitHub Data Fetcher');
  console.log(`Period: ${START_DATE} to ${END_DATE}`);
  console.log(`Token: ${TOKEN ? 'Provided (higher rate limits)' : 'Not provided (60 req/hr limit)'}`);
  console.log('='.repeat(60));

  if (!TOKEN) {
    console.log('\nWARNING: No GITHUB_TOKEN set. Rate limit is 60 requests/hour.');
    console.log('Set it with: export GITHUB_TOKEN=your_token_here\n');
  }

  const allData = {
    fetchedAt: new Date().toISOString(),
    period: { start: START_DATE, end: END_DATE },
    org: GITHUB_ORG,
    members: {}
  };

  for (const member of TEAM) {
    try {
      const data = await fetchMemberData(member);
      allData.members[member.github] = data;
      console.log(`  ✓ ${member.name}: ${data.stats.commits} commits, ${data.stats.prs} PRs`);
    } catch (error) {
      console.error(`  ✗ Error fetching ${member.name}: ${error.message}`);
      allData.members[member.github] = { member, error: error.message };
    }

    await sleep(2000); // Pause between members
  }

  // Write to file
  const outputPath = `${__dirname}/../public/github-data.json`;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(allData, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`✓ Data saved to ${outputPath}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
