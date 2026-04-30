#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_OWNER = "NinjaTomOnline";
const DEFAULT_MASTER_REPO = "ninjatom-projects-site";
const INCLUDE_TOPICS = ["ninjatom-project-site", "app-website"];
const DEFAULT_ACCENT = "#42D9FF";
const FALLBACK_OVERRIDES = {
  "doorcodes-site": {
    name: "DoorCodes Vault",
    tagline: "Save door codes and surface them when you arrive.",
    category: "iOS App",
    accent: "#38BDF8",
    featured: true,
    sortOrder: 10,
  },
  "swiftterm-site": {
    name: "SwiftTerm",
    tagline: "A polished terminal companion for fast command notes and workflows.",
    category: "Tool",
    accent: "#59F2C7",
    featured: true,
    sortOrder: 20,
  },
  "zenwisdom-site": {
    name: "Zen Wisdom",
    tagline: "Quiet daily reflections designed for calmer routines.",
    category: "iOS App",
    accent: "#A78BFA",
    sortOrder: 30,
  },
  "dontspeed-site": {
    name: "DontSpeed",
    tagline: "A speed-awareness app website built for simple, focused driving safety.",
    category: "iOS App",
    accent: "#FF6FA8",
    sortOrder: 40,
  },
  "flowguru-site": {
    name: "FlowGuru",
    tagline: "Creative flow tools and focus systems for getting unstuck.",
    category: "Tool",
    accent: "#FFCF70",
    sortOrder: 50,
  },
  "rooftoprush-site": {
    name: "Rooftop Rush",
    tagline: "A fast arcade project site with skyline energy.",
    category: "Game",
    accent: "#42D9FF",
    sortOrder: 110,
  },
  "retrocopter-site": {
    name: "Retrocopter",
    tagline: "A retro arcade flight project site.",
    category: "Game",
    accent: "#59F2C7",
    sortOrder: 120,
  },
  "deadheaddetective-site": {
    name: "Deadhead Detective",
    tagline: "A mystery-driven game project site.",
    category: "Game",
    accent: "#A78BFA",
    sortOrder: 130,
  },
  "masterspaces-site": {
    name: "MasterSpaces",
    tagline: "A project site for organizing spaces, ideas, and workflows.",
    category: "Tool",
    accent: "#7DD3FC",
    sortOrder: 210,
  },
  "cushionops-site": {
    name: "CushionOps",
    tagline: "A focused operations tool project site.",
    category: "Tool",
    accent: "#FFCF70",
    sortOrder: 220,
  },
  "ashtag-site": {
    name: "Ashtag",
    tagline: "A compact project site for tag-driven organization.",
    category: "Tool",
    accent: "#FF6FA8",
    sortOrder: 230,
  },
  "dreamspell-site": {
    name: "Dreamspell",
    tagline: "A creative project site with a reflective, imaginative tone.",
    category: "Creative / Custom3D",
    accent: "#A78BFA",
    sortOrder: 310,
  },
  "shramana-site": {
    name: "Shramana",
    tagline: "A contemplative creative project site.",
    category: "Creative / Custom3D",
    accent: "#59F2C7",
    sortOrder: 320,
  },
};

const repoRoot = path.resolve(__dirname, "..");
const args = parseArgs(process.argv.slice(2));
const owner = args.owner || process.env.PROJECT_OWNER || DEFAULT_OWNER;
const masterRepo =
  args.repo ||
  process.env.MASTER_REPO ||
  process.env.GITHUB_REPOSITORY?.split("/")[1] ||
  DEFAULT_MASTER_REPO;
const outputPath = path.resolve(repoRoot, args.output || process.env.PROJECTS_OUTPUT || "projects.json");
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  console.log(`Discovering public project websites for ${owner}...`);
  const repos = await fetchPublicRepos(owner);
  const projects = [];

  for (const repo of repos) {
    if (repo.name.toLowerCase() === masterRepo.toLowerCase()) continue;

    const topics = await getTopics(repo);
    if (!shouldIncludeRepo(repo, topics)) continue;

    const manifest = await readManifest(repo);
    projects.push(normalizeProject(repo, topics, manifest));
  }

  projects.sort(compareProjects);

  const nextPayload = {
    schemaVersion: 1,
    owner,
    generatedAt: new Date().toISOString(),
    includeRules: {
      repoNameSuffix: "-site",
      topics: INCLUDE_TOPICS,
    },
    projects,
  };

  const existingPayload = await readJsonIfExists(outputPath);
  if (existingPayload && sameGeneratedContent(existingPayload, nextPayload)) {
    console.log(`No project changes found. ${path.relative(repoRoot, outputPath)} was left untouched.`);
    return;
  }

  await fs.writeFile(outputPath, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${projects.length} projects to ${path.relative(repoRoot, outputPath)}.`);
}

async function fetchPublicRepos(account) {
  const repos = [];
  let page = 1;

  while (true) {
    const url = new URL(`https://api.github.com/users/${account}/repos`);
    url.searchParams.set("type", "public");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const chunk = await fetchJson(url);
    if (!Array.isArray(chunk)) {
      throw new Error("GitHub API returned an unexpected repositories response.");
    }

    repos.push(...chunk);
    if (chunk.length < 100) break;
    page += 1;
  }

  return repos;
}

async function getTopics(repo) {
  if (Array.isArray(repo.topics)) {
    return repo.topics.map((topic) => topic.toLowerCase());
  }

  try {
    const payload = await fetchJson(`https://api.github.com/repos/${owner}/${repo.name}/topics`);
    return Array.isArray(payload.names) ? payload.names.map((topic) => topic.toLowerCase()) : [];
  } catch (error) {
    console.warn(`Could not read topics for ${repo.name}: ${error.message}`);
    return [];
  }
}

function shouldIncludeRepo(repo, topics) {
  const name = repo.name.toLowerCase();
  return name.endsWith("-site") || topics.some((topic) => INCLUDE_TOPICS.includes(topic));
}

async function readManifest(repo) {
  const url = `https://api.github.com/repos/${owner}/${repo.name}/contents/site-manifest.json`;
  const ref = repo.default_branch ? `?ref=${encodeURIComponent(repo.default_branch)}` : "";
  const response = await githubFetch(`${url}${ref}`, {
    headers: {
      Accept: "application/vnd.github.raw+json",
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    console.warn(`Could not read site-manifest.json from ${repo.name}: ${response.status}`);
    return null;
  }

  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && parsed.encoding === "base64" && parsed.content) {
      return JSON.parse(Buffer.from(parsed.content, "base64").toString("utf8"));
    }
    return parsed;
  } catch (error) {
    console.warn(`Invalid site-manifest.json in ${repo.name}: ${error.message}`);
    return null;
  }
}

function normalizeProject(repo, topics, manifest) {
  const fallback = FALLBACK_OVERRIDES[repo.name.toLowerCase()] || {};
  const inferredName = humanizeRepoName(repo.name);
  const website = firstValidUrl(
    manifest?.website,
    repo.homepage,
    `https://${owner.toLowerCase()}.github.io/${repo.name}/`,
  );

  return {
    name: cleanString(manifest?.name) || fallback.name || inferredName,
    tagline:
      cleanString(manifest?.tagline) ||
      fallback.tagline ||
      cleanString(repo.description) ||
      `A public project website from ${owner}.`,
    category: cleanString(manifest?.category) || fallback.category || inferCategory(repo, topics),
    status: cleanString(manifest?.status) || (repo.archived ? "Archived" : "Live"),
    website,
    supportUrl: firstValidUrl(manifest?.supportUrl),
    privacyUrl: firstValidUrl(manifest?.privacyUrl),
    appStoreUrl: firstValidUrl(manifest?.appStoreUrl),
    icon: firstValidUrl(manifest?.icon),
    accent: validAccent(manifest?.accent) || fallback.accent || inferredAccent(repo.name),
    featured: manifest?.featured === undefined ? Boolean(fallback.featured) : Boolean(manifest.featured),
    sortOrder: Number.isFinite(Number(manifest?.sortOrder))
      ? Number(manifest.sortOrder)
      : Number.isFinite(Number(fallback.sortOrder))
        ? Number(fallback.sortOrder)
        : 1000,
    repoName: repo.name,
    repositoryUrl: repo.html_url,
    topics,
    manifestFound: Boolean(manifest),
    updatedAt: repo.pushed_at || repo.updated_at || "",
  };
}

function inferCategory(repo, topics) {
  const searchable = `${repo.name} ${repo.description || ""} ${topics.join(" ")}`.toLowerCase();

  if (searchable.includes("game")) return "Game";
  if (searchable.includes("custom3d") || searchable.includes("custom-3d") || searchable.includes("3d")) {
    return "Creative / Custom3D";
  }
  if (searchable.includes("tool") || searchable.includes("terminal") || searchable.includes("utility")) {
    return "Tool";
  }
  if (searchable.includes("web")) return "Web App";
  if (/(ios|iphone|ipad|watchos|app)/.test(searchable)) return "iOS App";
  return "Project";
}

function humanizeRepoName(repoName) {
  const known = {
    doorcodes: "DoorCodes",
    dontspeed: "DontSpeed",
    swiftterm: "SwiftTerm",
    zenwisdom: "Zen Wisdom",
    flowguru: "FlowGuru",
    custom3d: "Custom3D",
    ninjatom: "NinjaTom",
  };

  const stem = repoName.replace(/-site$/i, "");
  return stem
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => known[word.toLowerCase()] || word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function inferredAccent(repoName) {
  const palette = ["#42D9FF", "#59F2C7", "#A78BFA", "#FF6FA8", "#FFCF70", "#7DD3FC"];
  const hash = Array.from(repoName).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function compareProjects(a, b) {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

function sameGeneratedContent(existingPayload, nextPayload) {
  const comparableExisting = stripVolatile(existingPayload);
  const comparableNext = stripVolatile(nextPayload);
  return JSON.stringify(comparableExisting) === JSON.stringify(comparableNext);
}

function stripVolatile(payload) {
  return {
    schemaVersion: payload.schemaVersion,
    owner: payload.owner,
    includeRules: payload.includeRules,
    projects: Array.isArray(payload.projects) ? payload.projects : [],
  };
}

async function fetchJson(url) {
  const response = await githubFetch(url);
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

async function githubFetch(url, options = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": `${DEFAULT_MASTER_REPO}-discovery`,
    ...options.headers,
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    console.warn(`Could not read existing ${filePath}: ${error.message}`);
    return null;
  }
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function firstValidUrl(...values) {
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    try {
      const url = new URL(value.trim());
      if (["http:", "https:"].includes(url.protocol)) return url.href;
    } catch {
      // Try the next value.
    }
  }
  return "";
}

function validAccent(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : "";
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;

    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      index += 1;
    } else {
      parsed[key] = true;
    }
  }
  return parsed;
}
