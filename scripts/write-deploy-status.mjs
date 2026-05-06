#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(repoRoot, process.env.DEPLOY_STATUS_OUTPUT || "data/deploy-status.json");
const repository = process.env.GITHUB_REPOSITORY || "NinjaTomOnline/ninjatom-projects-site";
const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
const runId = process.env.GITHUB_RUN_ID || "";
const runNumber = process.env.GITHUB_RUN_NUMBER || "";
const runAttempt = process.env.GITHUB_RUN_ATTEMPT || "";
const sha = process.env.GITHUB_SHA || "";

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  site: "https://ninjatomapps.com/",
  workflow: process.env.GITHUB_WORKFLOW || "Auto index and deploy",
  eventName: process.env.GITHUB_EVENT_NAME || "local",
  repository,
  refName: process.env.GITHUB_REF_NAME || "main",
  runId,
  runNumber,
  runAttempt,
  commit: sha,
  shortCommit: sha ? sha.slice(0, 7) : "",
  actor: process.env.GITHUB_ACTOR || "",
  runUrl: runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : "",
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote deploy status to ${relativeOutputPath(outputPath)}.`);

function relativeOutputPath(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path;
}
