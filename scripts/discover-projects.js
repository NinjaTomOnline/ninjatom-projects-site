#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_OWNER = "NinjaTomOnline";
const DEFAULT_MASTER_REPO = "ninjatom-projects-site";
const INCLUDE_TOPICS = ["ninjatom-project-site", "app-website"];
const DEFAULT_ACCENT = "#42D9FF";
const COMMON_ICON_PATHS = [
  "apple-touch-icon.png",
  "icon-512.png",
  "icon-192.png",
  "favicon-512.png",
  "favicon.png",
  "assets/apple-touch-icon.png",
  "assets/app-icon.png",
  "assets/icon-512.png",
  "assets/icon-256.png",
  "assets/doorcodes-favicon-512.png",
  "screenshots/app-icon.png",
];
const COMMON_PREVIEW_PATHS = [
  "screenshots/social-card.png",
  "assets/doorcodes-social-preview.png",
  "screenshots/zenwisdom-social-card.png",
  "screenshots/web/iphone-dashboard-dark.png",
  "screenshots/01-onboarding-ready.jpg",
  "screenshots/ipad-gameplay.png",
  "screenshots/iphone-dashboard-dark.png",
];
const COMMON_SCREENSHOT_PATHS = [
  "screenshots/01.png",
  "screenshots/02.png",
  "screenshots/03.png",
  "screenshots/01-onboarding-ready.jpg",
  "screenshots/iphone-dashboard-dark.png",
  "screenshots/web/iphone-dashboard-dark.png",
  "screenshots/ipad-gameplay.png",
  "screenshots/app-store-6-7/01.png",
  "screenshots/app-store-6-7/02.png",
  "screenshots/app-store-6-7/03.png",
  "assets/doorcodes-social-preview.png",
  "screenshots/social-card.png",
  "screenshots/zenwisdom-social-card.png",
];
const FALLBACK_OVERRIDES = {
  "doorcodes-site": {
    name: "DoorCodes",
    tagline: "Access codes, ready on arrival with privacy-safe reminders and Secure Reveal.",
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
    name: "QuitGentle",
    tagline: "Gentle quit-tracking support with calm daily check-ins and progress cues.",
    category: "iOS App",
    accent: "#A78BFA",
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
const feedOutputPath = path.resolve(repoRoot, args.feed || process.env.PROJECTS_FEED_OUTPUT || "feed.xml");
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const contentsExistsCache = new Map();
const repoTreeCache = new Map();

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
    const siteHints = await readSiteHints(repo);
    projects.push(await normalizeProject(repo, topics, manifest, siteHints));
  }

  projects.sort(compareProjects);

  const nextPayload = {
    schemaVersion: 3,
    owner,
    generatedAt: new Date().toISOString(),
    includeRules: {
      repoNameSuffix: "-site",
      topics: INCLUDE_TOPICS,
    },
    projects,
  };
  const nextFeed = buildRssFeed(nextPayload);

  const existingPayload = await readJsonIfExists(outputPath);
  const existingFeed = await readTextIfExists(feedOutputPath);
  if (existingPayload && sameGeneratedContent(existingPayload, nextPayload) && existingFeed === nextFeed) {
    console.log(`No project changes found. Generated files were left untouched.`);
    return;
  }

  if (!existingPayload || !sameGeneratedContent(existingPayload, nextPayload)) {
    await fs.writeFile(outputPath, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
    console.log(`Wrote ${projects.length} projects to ${path.relative(repoRoot, outputPath)}.`);
  }

  if (existingFeed !== nextFeed) {
    await fs.writeFile(feedOutputPath, nextFeed, "utf8");
    console.log(`Wrote RSS feed to ${path.relative(repoRoot, feedOutputPath)}.`);
  }
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

async function normalizeProject(repo, topics, manifest, siteHints = {}) {
  const fallback = FALLBACK_OVERRIDES[repo.name.toLowerCase()] || {};
  const inferredName = humanizeRepoName(repo.name);
  const website = firstValidUrl(
    manifest?.website,
    repo.homepage,
    siteHints.cnameUrl,
    `https://${owner.toLowerCase()}.github.io/${repo.name}/`,
  );
  const icon = await firstAvailableIcon(repo, website, [
    manifest?.icon,
    ...siteHints.iconCandidates,
    ...COMMON_ICON_PATHS,
  ]);
  const previewImage = await firstAvailableAsset(repo, website, [
    manifest?.previewImage,
    ...siteHints.previewCandidates,
    ...COMMON_PREVIEW_PATHS,
  ]);
  const manifestScreenshots = normalizeManifestScreenshots(manifest?.screenshots);
  const screenshots = await firstAvailableScreenshots(
    repo,
    website,
    [
      ...manifestScreenshots.map((screenshot) => screenshot.src),
      manifest?.previewImage,
      ...siteHints.screenshotCandidates,
      ...siteHints.previewCandidates,
      ...COMMON_SCREENSHOT_PATHS,
      ...COMMON_PREVIEW_PATHS,
    ],
    manifestScreenshots,
    previewImage,
    cleanString(manifest?.previewImageAlt),
  );
  const resolvedPreviewImage = previewImage || screenshots[0]?.src || "";
  const name = cleanString(manifest?.name) || fallback.name || inferredName;
  const category = cleanString(manifest?.category) || fallback.category || inferCategory(repo, topics);
  const status = cleanString(manifest?.status) || (repo.archived ? "Archived" : "Live");
  const launchedAt = cleanDateString(
    manifest?.launchedAt,
    manifest?.launchDate,
    manifest?.publishedAt,
    manifest?.releaseDate,
    repo.created_at,
  );
  const version = cleanString(manifest?.version);
  const launchNotes =
    cleanString(manifest?.launchNotes) ||
    defaultLaunchNotes({
      name,
      category,
      status,
      manifestFound: Boolean(manifest),
    });
  const versionHighlights = normalizeStringList(manifest?.versionHighlights, [
    `${status} ${category} project website`,
    manifest ? "Curated by site-manifest.json" : "Auto-discovered from public GitHub Pages",
    screenshots.length
      ? `${screenshots.length} gallery image${screenshots.length === 1 ? "" : "s"} available`
      : "Project preview available",
  ]);

  return {
    name,
    tagline:
      cleanString(manifest?.tagline) ||
      fallback.tagline ||
      cleanString(repo.description) ||
      `A public project website from ${owner}.`,
    category,
    status,
    website,
    supportUrl: firstValidUrl(manifest?.supportUrl),
    privacyUrl: firstValidUrl(manifest?.privacyUrl),
    appStoreUrl: firstValidUrl(manifest?.appStoreUrl, ...siteHints.appStoreCandidates),
    icon,
    previewImage: resolvedPreviewImage,
    previewImageAlt: cleanString(manifest?.previewImageAlt),
    screenshots,
    launchedAt,
    version,
    launchNotes,
    versionHighlights,
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
    stargazersCount: Number.isFinite(Number(repo.stargazers_count)) ? Number(repo.stargazers_count) : 0,
    forksCount: Number.isFinite(Number(repo.forks_count)) ? Number(repo.forks_count) : 0,
    updatedAt: repo.pushed_at || repo.updated_at || "",
  };
}

async function readSiteHints(repo) {
  const [cname, webManifest, indexHtml, repoImageHints] = await Promise.all([
    readRepoText(repo, "CNAME"),
    readRepoJson(repo, "site.webmanifest"),
    readRepoText(repo, "index.html"),
    readRepoImageHints(repo),
  ]);

  return {
    cnameUrl: cnameToUrl(cname),
    iconCandidates: [
      ...iconCandidatesFromWebManifest(webManifest),
      ...iconCandidatesFromHtml(indexHtml),
      ...repoImageHints.iconCandidates,
    ],
    appStoreCandidates: appStoreCandidatesFromHtml(indexHtml),
    previewCandidates: [
      ...previewCandidatesFromHtml(indexHtml),
      ...repoImageHints.previewCandidates,
    ],
    screenshotCandidates: [
      ...screenshotCandidatesFromWebManifest(webManifest),
      ...screenshotCandidatesFromHtml(indexHtml),
      ...repoImageHints.screenshotCandidates,
    ],
  };
}

async function readRepoImageHints(repo) {
  const paths = await readRepoTreePaths(repo);
  return {
    iconCandidates: rankedRepoImageCandidates(paths, "icon"),
    previewCandidates: rankedRepoImageCandidates(paths, "preview"),
    screenshotCandidates: rankedRepoImageCandidates(paths, "screenshot"),
  };
}

async function readRepoTreePaths(repo) {
  const branch = repo.default_branch || "main";
  const cacheKey = `${repo.name}@${branch}`;
  if (repoTreeCache.has(cacheKey)) return repoTreeCache.get(cacheKey);

  try {
    const payload = await fetchJson(
      `https://api.github.com/repos/${owner}/${repo.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );
    const paths = Array.isArray(payload.tree)
      ? payload.tree
          .filter((item) => item?.type === "blob" && typeof item.path === "string")
          .map((item) => item.path)
      : [];
    repoTreeCache.set(cacheKey, paths);
    return paths;
  } catch (error) {
    console.warn(`Could not scan image assets for ${repo.name}: ${error.message}`);
    repoTreeCache.set(cacheKey, []);
    return [];
  }
}

function rankedRepoImageCandidates(paths, kind) {
  return paths
    .map((assetPath, index) => ({
      assetPath,
      index,
      score: repoImageScore(assetPath, kind),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.assetPath)
    .slice(0, kind === "screenshot" ? 24 : 10);
}

function repoImageScore(assetPath, kind) {
  const normalized = String(assetPath || "").toLowerCase();
  if (!/\.(avif|webp|png|jpe?g|svg)$/.test(normalized)) return 0;
  if (/(^|\/)(node_modules|vendor|dist|build)\//.test(normalized)) return 0;

  if (kind === "icon") {
    if (/(app-icon|brand-icon|apple-touch|icon-(192|256|512)|favicon)/.test(normalized)) return 100;
    return 0;
  }

  if (kind === "preview") {
    if (/(social-card|social-preview|preview)/.test(normalized)) return 120;
    if (/(hero|og-image|twitter-card)/.test(normalized)) return 100;
    if (/screenshots\/(web\/)?(iphone|ipad|desktop|storefront)/.test(normalized)) return 72;
    return 0;
  }

  if (isNonScreenshotAsset(normalized)) return 0;
  if (/screenshots\/(app-store|6\.9-inch|6-7|web)/.test(normalized)) return 150;
  if (/screenshots\/(iphone|ipad|desktop|storefront)/.test(normalized)) return 138;
  if (/screenshots\//.test(normalized)) return 126;
  if (/(screen|mockup|gallery|capture)/.test(normalized)) return 92;
  if (/(social-card|social-preview|preview|hero)/.test(normalized)) return 48;
  return 0;
}

async function firstAvailableIcon(repo, website, candidates) {
  return firstAvailableAsset(repo, website, candidates);
}

async function firstAvailableAsset(repo, website, candidates) {
  const seen = new Set();

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;

    const trimmed = candidate.trim();
    const resolved = resolveAgainstWebsite(website, trimmed);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);

    if (isAbsoluteHttpUrl(trimmed)) return resolved;
    if (await contentsExists(repo, normalizeRepoPath(trimmed))) return resolved;
  }

  return "";
}

async function firstAvailableScreenshots(
  repo,
  website,
  candidates,
  manifestScreenshots = [],
  fallbackPreview = "",
  fallbackAlt = "",
) {
  const seen = new Set();
  const seenKeys = new Set();
  const screenshots = [];
  const metadataBySource = new Map();

  for (const item of manifestScreenshots) {
    if (item.src) metadataBySource.set(item.src, item);
    const resolved = resolveAgainstWebsite(website, item.src);
    if (resolved) metadataBySource.set(resolved, item);
  }

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;

    const trimmed = candidate.trim();
    if (isNonScreenshotAsset(trimmed)) continue;

    const resolved = resolveAgainstWebsite(website, trimmed);
    if (!resolved || seen.has(resolved)) continue;
    const dedupeKey = screenshotDedupeKey(resolved);
    if (dedupeKey && seenKeys.has(dedupeKey)) continue;

    if (!isAbsoluteHttpUrl(trimmed) && !(await contentsExists(repo, normalizeRepoPath(trimmed)))) {
      continue;
    }

    seen.add(resolved);
    if (dedupeKey) seenKeys.add(dedupeKey);
    const metadata = metadataBySource.get(trimmed) || metadataBySource.get(resolved) || {};
    screenshots.push({
      src: resolved,
      alt: cleanString(metadata.alt) || fallbackAlt || "",
      caption: cleanString(metadata.caption),
    });

    if (screenshots.length >= 6) break;
  }

  const fallbackKey = screenshotDedupeKey(fallbackPreview);
  if (fallbackPreview && !seen.has(fallbackPreview) && (!fallbackKey || !seenKeys.has(fallbackKey))) {
    const dedupeKey = fallbackKey;
    if (dedupeKey) seenKeys.add(dedupeKey);
    screenshots.unshift({
      src: fallbackPreview,
      alt: fallbackAlt,
      caption: "Preview",
    });
  }

  return screenshots.slice(0, 6);
}

function normalizeManifestScreenshots(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return { src: item.trim(), alt: "", caption: "" };
      }

      if (!item || typeof item !== "object") return null;
      const src = cleanString(item.src || item.url || item.image);
      if (!src) return null;

      return {
        src,
        alt: cleanString(item.alt),
        caption: cleanString(item.caption || item.title),
      };
    })
    .filter(Boolean);
}

function iconCandidatesFromWebManifest(webManifest) {
  if (!webManifest || !Array.isArray(webManifest.icons)) return [];

  return webManifest.icons
    .filter((icon) => icon && typeof icon.src === "string")
    .sort((a, b) => iconSizeScore(b) - iconSizeScore(a))
    .map((icon) => icon.src);
}

function screenshotCandidatesFromWebManifest(webManifest) {
  if (!webManifest || !Array.isArray(webManifest.screenshots)) return [];

  return webManifest.screenshots
    .filter((screenshot) => screenshot && typeof screenshot.src === "string")
    .map((screenshot) => screenshot.src);
}

function iconSizeScore(icon) {
  const sizes = typeof icon.sizes === "string" ? icon.sizes.match(/\d+/g) : null;
  if (!sizes) return 0;
  return Math.max(...sizes.map((size) => Number(size)).filter(Number.isFinite), 0);
}

function iconCandidatesFromHtml(html) {
  if (typeof html !== "string" || !html.trim()) return [];

  const candidates = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag[0]);
    const rel = attrs.rel?.toLowerCase() || "";
    if (attrs.href && rel.includes("icon")) candidates.push(attrs.href);
  }

  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag[0]);
    const className = attrs.class?.toLowerCase() || "";
    if (attrs.src && /\b(app-icon|brand-icon)\b/.test(className)) candidates.push(attrs.src);
  }

  return candidates;
}

function appStoreCandidatesFromHtml(html) {
  if (typeof html !== "string" || !html.trim()) return [];

  return Array.from(
    new Set(
      Array.from(html.matchAll(/https:\/\/apps\.apple\.com[^"'<> )]+/gi)).map((match) =>
        match[0].replace(/[.,;]+$/, ""),
      ),
    ),
  );
}

function previewCandidatesFromHtml(html) {
  if (typeof html !== "string" || !html.trim()) return [];

  const candidates = [];
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag[0]);
    const property = attrs.property?.toLowerCase() || attrs.name?.toLowerCase() || "";
    if (attrs.content && ["og:image", "twitter:image", "twitter:image:src"].includes(property)) {
      candidates.push(attrs.content);
    }
  }

  return candidates;
}

function screenshotCandidatesFromHtml(html) {
  if (typeof html !== "string" || !html.trim()) return [];

  const candidates = [];
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag[0]);
    const searchable = `${attrs.class || ""} ${attrs.id || ""} ${attrs.alt || ""} ${attrs.src || ""}`.toLowerCase();
    if (
      attrs.src &&
      !isNonScreenshotAsset(attrs.src) &&
      /(screenshot|screen|preview|mockup|phone|hero|gallery|social-card)/.test(searchable)
    ) {
      candidates.push(attrs.src);
    }
  }

  return Array.from(new Set(candidates));
}

function isNonScreenshotAsset(value) {
  const normalized = String(value || "").toLowerCase();
  if (/screenshots\/app-store/.test(normalized)) return false;
  return /(badge|download-on-app-store|app-store-badge|favicon|apple-touch|app-icon|brand-icon|logo|icon-\d+)/.test(
    normalized,
  );
}

function screenshotDedupeKey(value) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    const parts = pathname.split("/").filter(Boolean);
    return parts.at(-1) || pathname;
  } catch {
    return String(value || "").toLowerCase();
  }
}

function parseAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([^\s=<>"']+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    attrs[match[1].toLowerCase()] = match[3] ?? match[4] ?? "";
  }
  return attrs;
}

async function readRepoJson(repo, filePath) {
  const text = await readRepoText(repo, filePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn(`Invalid ${filePath} in ${repo.name}: ${error.message}`);
    return null;
  }
}

async function readRepoText(repo, filePath) {
  const ref = repo.default_branch ? `?ref=${encodeURIComponent(repo.default_branch)}` : "";
  const response = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo.name}/contents/${encodeURIComponentPath(filePath)}${ref}`,
    {
      headers: {
        Accept: "application/vnd.github.raw+json",
      },
    },
  );

  if (response.status === 404) return "";
  if (!response.ok) {
    console.warn(`Could not read ${filePath} from ${repo.name}: ${response.status}`);
    return "";
  }

  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && parsed.encoding === "base64" && parsed.content) {
      return Buffer.from(parsed.content, "base64").toString("utf8");
    }
  } catch {
    // Raw text responses are expected for normal files.
  }
  return text;
}

async function contentsExists(repo, filePath) {
  if (!filePath) return false;
  const key = `${repo.name}:${filePath}`;
  if (contentsExistsCache.has(key)) return contentsExistsCache.get(key);

  const ref = repo.default_branch ? `?ref=${encodeURIComponent(repo.default_branch)}` : "";
  const response = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo.name}/contents/${encodeURIComponentPath(filePath)}${ref}`,
  );
  const exists = response.ok;
  contentsExistsCache.set(key, exists);
  return exists;
}

function cnameToUrl(cname) {
  if (typeof cname !== "string") return "";
  const host = cname.trim().split(/\s+/)[0];
  if (!host || host.includes("/")) return "";
  return `https://${host}/`;
}

function resolveAgainstWebsite(website, candidate) {
  if (isAbsoluteHttpUrl(candidate)) return firstValidUrl(candidate);
  if (!website) return "";
  try {
    return new URL(candidate.replace(/^\.\//, ""), website).href;
  } catch {
    return "";
  }
}

function isAbsoluteHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function normalizeRepoPath(value) {
  return value
    .trim()
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .split(/[?#]/)[0];
}

function encodeURIComponentPath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
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

function buildRssFeed(payload) {
  const siteUrl = "https://ninjatomapps.com/";
  const sortedProjects = payload.projects
    .slice()
    .sort((a, b) => projectDateValue(b) - projectDateValue(a));
  const lastBuildTimestamp = sortedProjects.reduce(
    (latest, project) => Math.max(latest, projectDateValue(project)),
    0,
  );
  const items = sortedProjects
    .map((project) => {
      const link = project.website || project.repositoryUrl || siteUrl;
      const guid = `${siteUrl}#project/${encodeURIComponent(project.repoName || project.name)}`;
      const pubDate = new Date(projectDateValue(project) || lastBuildTimestamp || 0).toUTCString();
      const description = `${project.tagline || ""} ${project.launchNotes || ""}`.trim();

      return [
        "    <item>",
        `      <title>${escapeXml(project.name)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="false">${escapeXml(guid)}</guid>`,
        `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
        `      <category>${escapeXml(project.category || "Project")}</category>`,
        `      <description>${escapeXml(description)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>NinjaTom Apps Project Updates</title>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}feed.xml" rel="self" type="application/rss+xml"/>
    <description>New and updated NinjaTom Apps, tools, games, and Custom3D.Art project websites.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(lastBuildTimestamp || 0).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function cleanDateString(...values) {
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    const date = new Date(value.trim());
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return "";
}

function normalizeStringList(value, fallback = []) {
  const source = Array.isArray(value) ? value : [];
  const cleaned = source
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return (cleaned.length ? cleaned : fallback).slice(0, 6);
}

function defaultLaunchNotes(project) {
  const source = project.manifestFound ? "its site manifest" : "public GitHub Pages metadata";
  return `${project.name} is listed as ${project.status} in the ${project.category} catalog, refreshed automatically from ${source}.`;
}

function dateValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function projectDateValue(project) {
  return dateValue(project?.updatedAt) || dateValue(project?.launchedAt);
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    console.warn(`Could not read existing ${filePath}: ${error.message}`);
    return "";
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
