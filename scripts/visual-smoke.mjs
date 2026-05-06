#!/usr/bin/env node

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const outDir = resolve(root, "artifacts", "visual-smoke");
const chromePath = await findChrome();

await mkdir(outDir, { recursive: true });
const server = createServer(serveStatic);

try {
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}/`;

  await assertProjectData();
  await capture("desktop-home", baseUrl, "1440,1000", 1440, 1000);
  await capture("mobile-home", baseUrl, "390,844", 390, 844);
  await capture("desktop-projects", `${baseUrl}#projects`, "1440,1200", 1440, 1200);
  await capture("desktop-category-games", `${baseUrl}#category/games`, "1440,1000", 1440, 1000);
  await capture("desktop-project-detail", `${baseUrl}#project/doorcodes-site`, "1440,1000", 1440, 1000);
  await capture("desktop-projected-project-detail", `${baseUrl}#project/zenwisdom-site`, "1440,1000", 1440, 1000);
  await capture("desktop-command-palette", `${baseUrl}?visual-test=1&command=1`, "1440,1000", 1440, 1000);
  await capture("changelog", `${baseUrl}changelog.html`, "1440,900", 1440, 900);
  await capture("status", `${baseUrl}status.html`, "1440,900", 1440, 900);
  await capture("not-found", `${baseUrl}404.html`, "1440,900", 1440, 900);

  console.log(`Visual smoke screenshots written to ${outDir}`);
} finally {
  server.close();
}

async function assertProjectData() {
  const payload = JSON.parse(await readFile(join(root, "projects.json"), "utf8"));
  if (!Array.isArray(payload.projects) || payload.projects.length === 0) {
    throw new Error("projects.json must contain at least one project.");
  }

  const linkedProjects = payload.projects.filter((project) => project.website);
  if (linkedProjects.length < payload.projects.length) {
    throw new Error("Every project should have a website URL before publishing.");
  }
}

async function capture(name, url, windowSize, expectedWidth, expectedHeight) {
  const screenshotPath = join(outDir, `${name}.png`);
  await runChrome([
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--timeout=15000",
    "--virtual-time-budget=5000",
    "--force-device-scale-factor=1",
    `--window-size=${windowSize}`,
    `--screenshot=${screenshotPath}`,
    url,
  ]);

  const info = await readPngInfo(screenshotPath);
  if (info.width !== expectedWidth || info.height !== expectedHeight) {
    throw new Error(`${name} screenshot was ${info.width}x${info.height}, expected ${expectedWidth}x${expectedHeight}.`);
  }

  const fileInfo = await stat(screenshotPath);
  if (fileInfo.size < 25_000) {
    throw new Error(`${name} screenshot is suspiciously small (${fileInfo.size} bytes).`);
  }
}

function runChrome(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(chromePath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`Chrome exited with code ${code}: ${stderr}`));
      }
    });
  });
}

async function readPngInfo(filePath) {
  const buffer = await readFile(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`${filePath} is not a PNG file.`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function listen(httpServer) {
  return new Promise((resolveListen, rejectListen) => {
    httpServer.on("error", rejectListen);
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();
      resolveListen(address.port);
    });
  });
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  const requestedPath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname;
  const filePath = resolve(root, normalize(requestedPath).replace(/^\/+/, ""));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    await access(filePath);
  } catch {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const stream = createReadStream(filePath);
  response.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Cache-Control": "no-store",
  });
  stream.pipe(response);
}

function contentType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Chrome or Chromium was not found. Set CHROME_PATH to run the visual smoke check.");
}
