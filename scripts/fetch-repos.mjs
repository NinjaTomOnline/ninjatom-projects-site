#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const owner = process.env.GITHUB_ORG || "NinjaTomOnline";
const token = process.env.ORG_PAT || process.env.GITHUB_TOKEN || "";
const includeForks = parseBoolean(process.env.INCLUDE_FORKS);
const outputPath = resolve(repoRoot, process.env.PROJECTS_OUTPUT || "data/projects.json");
const apiRoot = "https://api.github.com";
const apiHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "ninjatom-projects-site-auto-index",
};

if (token) {
  apiHeaders.Authorization = `Bearer ${token}`;
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

async function main() {
  console.log(`Fetching public repositories for ${owner}. Forks included: ${includeForks ? "yes" : "no"}.`);

  const { repositories, source } = await listPublicRepositories(owner);
  const filtered = repositories.filter((repo) => includeForks || !repo.fork);
  const projects = [];

  for (const repo of filtered) {
    const topics = await fetchTopics(repo);
    projects.push(normalizeRepository(repo, topics));
  }

  projects.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return dateValue(b.pushed_at) - dateValue(a.pushed_at);
  });

  const payload = {
    schemaVersion: 1,
    owner,
    generatedAt: new Date().toISOString(),
    source,
    includeForks,
    count: projects.length,
    repositories: projects,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${projects.length} repositories to ${relativeOutputPath(outputPath)}.`);
}

async function listPublicRepositories(account) {
  const attempts = [
    {
      source: "organization",
      path: `/orgs/${encodeURIComponent(account)}/repos`,
      params: { type: "public", sort: "pushed", direction: "desc" },
    },
    {
      source: "user",
      path: `/users/${encodeURIComponent(account)}/repos`,
      params: { type: "owner", sort: "pushed", direction: "desc" },
    },
  ];

  let notFoundError;
  for (const attempt of attempts) {
    try {
      return {
        repositories: await paginate(attempt.path, attempt.params),
        source: `github-rest-${attempt.source}-repositories`,
      };
    } catch (error) {
      if (error.status !== 404) throw error;
      notFoundError = error;
    }
  }

  throw notFoundError || new Error(`Unable to find GitHub account ${account}.`);
}

async function paginate(path, params = {}) {
  const items = [];
  let url = new URL(path, apiRoot);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("per_page", "100");

  while (url) {
    const { data, response } = await githubJson(url);
    if (!Array.isArray(data)) {
      throw new Error(`Expected an array response from ${url.pathname}.`);
    }

    items.push(...data);
    url = nextPageUrl(response.headers.get("link"));
  }

  return items;
}

async function fetchTopics(repo) {
  try {
    const { data } = await githubJson(new URL(`/repos/${repo.full_name}/topics`, apiRoot));
    return Array.isArray(data.names) ? data.names : [];
  } catch (error) {
    console.warn(`Warning: unable to fetch topics for ${repo.full_name}: ${error.message}`);
    return [];
  }
}

async function githubJson(url) {
  const response = await fetch(url, { headers: apiHeaders });
  if (!response.ok) {
    throw await githubError(response, url);
  }

  return {
    data: await response.json(),
    response,
  };
}

async function githubError(response, url) {
  const body = await safeText(response);
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");
  const resetText = reset ? new Date(Number(reset) * 1000).toISOString() : "unknown";
  const rateText = remaining === "0" ? ` Rate limit resets at ${resetText}.` : "";
  const message = [
    `GitHub API ${response.status} for ${url.pathname}${url.search}.`,
    `Remaining rate limit: ${remaining ?? "unknown"}.`,
    rateText,
    body ? `Response: ${body.slice(0, 360)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const error = new Error(message);
  error.status = response.status;
  return error;
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function nextPageUrl(linkHeader) {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2] === "next") return new URL(match[1]);
  }

  return null;
}

function normalizeRepository(repo, topics) {
  return {
    name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description || "",
    homepage: repo.homepage || "",
    topics,
    language: repo.language || "",
    archived: Boolean(repo.archived),
    pushed_at: repo.pushed_at || "",
    stargazers_count: Number.isFinite(repo.stargazers_count) ? repo.stargazers_count : 0,
  };
}

function parseBoolean(value) {
  return /^(1|true|yes)$/i.test(String(value || ""));
}

function dateValue(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function relativeOutputPath(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path;
}
