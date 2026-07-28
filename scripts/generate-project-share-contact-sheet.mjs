#!/usr/bin/env node

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { capturePage } from "./chrome-capture.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const outDir = join(root, "artifacts", "project-share-contact-sheet");
const outputPath = join(outDir, "all-23-project-share-images.png");
const projects = JSON.parse(await readFile(join(root, "projects.json"), "utf8")).projects || [];
const columns = 3;
const tileWidth = 360;
const tileHeight = 189;
const labelHeight = 42;
const gap = 20;
const margin = 30;
const rows = Math.ceil(projects.length / columns);
const width = margin * 2 + columns * tileWidth + (columns - 1) * gap;
const height = margin * 2 + rows * (tileHeight + labelHeight) + (rows - 1) * gap;

await mkdir(outDir, { recursive: true });
const cards = projects.map((project) => {
  const slug = slugify(project.slug || project.repoName || project.name);
  return `<figure><img src="/assets/project-og/${escapeAttr(slug)}.png" alt="${escapeAttr(project.name)} share image"><figcaption>${escapeHtml(project.name)}</figcaption></figure>`;
}).join("");
const page = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#05070d;color:#f7f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  main{display:grid;grid-template-columns:repeat(${columns},${tileWidth}px);gap:${gap}px;padding:${margin}px}
  figure{margin:0;width:${tileWidth}px;height:${tileHeight + labelHeight}px;border:1px solid #283349;border-radius:14px;overflow:hidden;background:#0d1420}
  img{display:block;width:${tileWidth}px;height:${tileHeight}px;object-fit:cover}
  figcaption{height:${labelHeight}px;padding:10px 12px;font-size:15px;font-weight:760;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style></head><body><main>${cards}</main></body></html>`;
const server = createServer(serveStatic);

try {
  const port = await listen(server);
  await capturePage({
    url: `http://127.0.0.1:${port}/__contact-sheet.html`,
    outputPath,
    width,
    height,
    mobile: false,
  });
  console.log(`Project share contact sheet written to ${outputPath} (${projects.length} images, ${width}x${height}).`);
} finally {
  server.close();
}

function listen(httpServer) {
  return new Promise((resolveListen, rejectListen) => {
    httpServer.on("error", rejectListen);
    httpServer.listen(0, "127.0.0.1", () => resolveListen(httpServer.address().port));
  });
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  if (requestUrl.pathname === "/__contact-sheet.html") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(page);
    return;
  }
  const filePath = resolve(root, normalize(requestUrl.pathname).replace(/^\/+/, ""));
  if (!filePath.startsWith(root)) { response.writeHead(403); response.end("Forbidden"); return; }
  try { await access(filePath); } catch { response.writeHead(404); response.end("Not found"); return; }
  response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
  createReadStream(filePath).pipe(response);
}

function contentType(filePath) {
  return ({ ".png": "image/png", ".svg": "image/svg+xml" })[extname(filePath).toLowerCase()] || "application/octet-stream";
}

function slugify(value) {
  return String(value || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
