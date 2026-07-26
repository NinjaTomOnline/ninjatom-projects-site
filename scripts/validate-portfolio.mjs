#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const curation = JSON.parse(await readFile(resolve(root, "scripts/portfolio-curation.json"), "utf8"));
const payload = JSON.parse(await readFile(resolve(root, "projects.json"), "utf8"));
const checkLinks = process.argv.includes("--links");
const errors = [];

const allowedStatuses = new Set(curation.statusTaxonomy || []);
const entries = Array.isArray(curation.entries) ? curation.entries.filter((entry) => entry.include !== false) : [];
const projects = Array.isArray(payload.projects) ? payload.projects : [];
const seenNames = new Set();
const seenRepoNames = new Set();

if (!entries.length) errors.push("Curation must include at least one portfolio entry.");
if (projects.length !== entries.length) errors.push(`Generated project count ${projects.length} does not match curation count ${entries.length}.`);

for (const entry of entries) {
  validateIdentity(entry.name, entry.repoName || entry.matchRepoNames?.[0], "curation");
  if (!allowedStatuses.has(entry.productStatus)) errors.push(`${entry.name}: invalid productStatus ${entry.productStatus}.`);
  if (!text(entry.websiteStatus)) errors.push(`${entry.name}: websiteStatus is required.`);
  if (!entry.matchRepoNames?.length && !isHttps(entry.website)) errors.push(`${entry.name}: standalone curation website must be HTTPS.`);
  if (entry.website && !isHttps(entry.website)) errors.push(`${entry.name}: curation website must be HTTPS.`);
  if (/github\.com\/NinjaTomOnline\//i.test(entry.website) && !entry.matchRepoNames?.length) {
    errors.push(`${entry.name}: standalone entries must not expose repository URLs as their website.`);
  }
}

seenNames.clear();
seenRepoNames.clear();
for (const project of projects) {
  validateIdentity(project.name, project.repoName, "projects.json");
  if (!allowedStatuses.has(project.productStatus)) errors.push(`${project.name}: generated productStatus is invalid.`);
  if (project.status !== project.productStatus) errors.push(`${project.name}: status must mirror productStatus for compatibility.`);
  if (!text(project.websiteStatus)) errors.push(`${project.name}: generated websiteStatus is required.`);
  if (!isHttps(project.website)) errors.push(`${project.name}: generated website must be HTTPS.`);
  if (/^(Live|Private staging|Release Candidate)$/i.test(project.status)) errors.push(`${project.name}: legacy ambiguous status remains.`);
  if (!text(project.previewImageAlt)) errors.push(`${project.name}: previewImageAlt is required.`);
  if (!project.curationFound) errors.push(`${project.name}: every published entry must be curated.`);
  if (!project.appStoreUrl && (project.projectedReleaseDate || project.progressPercent !== undefined)) {
    if (!(project.projectedReleaseDate && Number.isFinite(Number(project.progressPercent)))) {
      errors.push(`${project.name}: projections require both an explicit date and progress value.`);
    }
  }
}

const mealBot = projects.find((project) => project.name === "MealBot Express");
if (!mealBot) {
  errors.push("MealBot Express is missing.");
} else {
  const positioning = `${mealBot.tagline} ${mealBot.launchNotes}`.toLowerCase();
  for (const phrase of ["four-world", "free-roam", "couch", "online multiplayer", "university campus", "night city", "jersey shore", "player-voted"]) {
    if (!positioning.includes(phrase)) errors.push(`MealBot Express positioning is missing: ${phrase}.`);
  }
  if (mealBot.productStatus !== "Active Development" || !mealBot.featured) {
    errors.push("MealBot Express must be a featured Active Development project.");
  }
}

for (const obsoleteName of ["AshTag", "Mealbot Express", "DontSpeed", "Minddeck", "Rooftop Rush", "Wearethewatchers"]) {
  if (projects.some((project) => project.name === obsoleteName)) errors.push(`Obsolete public name remains: ${obsoleteName}.`);
}

const appStoreProjects = projects.filter((project) => project.appStoreUrl);
for (const expected of ["DoorCodes", "QuitGentle", "Zen Wisdom", "DreamSpell"]) {
  if (!appStoreProjects.some((project) => project.name === expected)) errors.push(`${expected}: verified App Store link missing.`);
}

if (checkLinks) {
  const links = new Map();
  for (const project of projects) {
    for (const [kind, url] of [
      ["website", project.website],
      ["support", project.supportUrl],
      ["privacy", project.privacyUrl],
      ["App Store", project.appStoreUrl],
      ["icon", project.icon],
      ["preview", project.previewImage],
      ...((project.screenshots || []).map((shot) => ["screenshot", typeof shot === "string" ? shot : shot.src])),
    ]) {
      if (!isHttps(url) || isInternalPortfolioRoute(url)) continue;
      links.set(url, `${project.name} ${kind}`);
    }
  }

  const queue = [...links.entries()];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const [url, label] = queue.shift();
      try {
        const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
        await response.body?.cancel();
        if (!response.ok) errors.push(`${label}: ${response.status} ${url}`);
      } catch (error) {
        errors.push(`${label}: ${error.message} ${url}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`Checked ${links.size} external URLs.`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Portfolio validation passed: ${projects.length} curated projects, ${appStoreProjects.length} verified App Store links.`);

function validateIdentity(name, repoName, source) {
  const nameKey = text(name).toLowerCase();
  const repoKey = text(repoName).toLowerCase();
  if (!nameKey || !repoKey) errors.push(`${source}: every entry needs name and stable repoName/matchRepoNames.`);
  if (seenNames.has(nameKey)) errors.push(`${source}: duplicate name ${name}.`);
  if (seenRepoNames.has(repoKey)) errors.push(`${source}: duplicate stable identity ${repoName}.`);
  seenNames.add(nameKey);
  seenRepoNames.add(repoKey);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isHttps(value) {
  return /^https:\/\//i.test(text(value));
}

function isInternalPortfolioRoute(value) {
  try {
    const url = new URL(value);
    return url.hostname === "ninjatomapps.com" && url.hash.startsWith("#project/");
  } catch {
    return false;
  }
}
