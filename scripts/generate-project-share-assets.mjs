#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://ninjatomapps.com/";
const projectsPath = resolve(repoRoot, "projects.json");
const imageDir = resolve(repoRoot, "assets", "project-og");
const pageDir = resolve(repoRoot, "projects");
const chromePath = await findChrome();
const projectsPayload = JSON.parse(await readFile(projectsPath, "utf8"));
const projects = Array.isArray(projectsPayload.projects) ? projectsPayload.projects : [];
const brandMarkDataUri = `data:image/png;base64,${(await readFile(resolve(repoRoot, "assets", "ninjatom-head-mark.png"))).toString("base64")}`;

await mkdir(imageDir, { recursive: true });
await mkdir(pageDir, { recursive: true });

let pngCount = 0;
for (const project of projects) {
  const normalized = normalizeProject(project);
  const svgPath = join(imageDir, `${normalized.slug}.svg`);
  const pngPath = join(imageDir, `${normalized.slug}.png`);
  await writeFile(svgPath, projectSvg(normalized));

  const pngRendered = chromePath ? await renderSvgToPng(svgPath, pngPath) : false;
  if (pngRendered) pngCount += 1;

  await writeFile(
    join(pageDir, `${normalized.slug}.html`),
    projectPage(normalized, pngRendered ? "png" : "svg"),
  );
}

await removeOrphanedGeneratedFiles();

console.log(
  `Generated ${projects.length} project share page${projects.length === 1 ? "" : "s"} and ${pngCount} PNG Open Graph image${pngCount === 1 ? "" : "s"}.`,
);

async function removeOrphanedGeneratedFiles() {
  const expected = new Set(projects.map((project) => slugify(project.slug || project.repoName || project.name)));
  for (const [directory, extensions] of [
    [pageDir, [".html"]],
    [imageDir, [".svg", ".png"]],
  ]) {
    for (const name of await readdir(directory)) {
      const extension = extensions.find((candidate) => name.endsWith(candidate));
      if (!extension) continue;
      const slug = name.slice(0, -extension.length);
      if (!expected.has(slug)) await rm(join(directory, name));
    }
  }
}

function normalizeProject(project) {
  const slug = slugify(project.slug || project.repoName || project.name);
  const name = stringOr(project.name, "NinjaTom Project");
  const category = stringOr(project.category, "Project");
  const status = stringOr(project.productStatus || project.status, "Active Development");
  const accent = validAccent(project.accent) || accentFromText(name);

  return {
    slug,
    name,
    category,
    status,
    tagline: stringOr(project.tagline, "Apps, games, tools, and creative technology from NinjaTom Apps."),
    website: stringOr(project.website || project.repositoryUrl, siteUrl),
    repositoryUrl: stringOr(project.repositoryUrl, ""),
    accent,
    topics: Array.isArray(project.topics) ? project.topics.filter(isPublicFacingTopic).slice(0, 4) : [],
    updatedAt: stringOr(project.updatedAt || project.launchedAt, ""),
  };
}

function projectSvg(project) {
  const titleSize = titleFontSize(project.name);
  const titleLineHeight = titleSize + 8;
  const taglineSize = 24;
  const taglineLineHeight = 34;
  const contentX = 226;
  const contentWidth = 790;
  const titleY = 74;
  const titleLines = wrapTextByWidth(project.name, titleSize, contentWidth, 2);
  const taglineY = titleY + (titleLines.length - 1) * titleLineHeight + 50;
  const taglineLines = wrapTextByWidth(project.tagline, taglineSize, contentWidth, 2);
  const chipY = 248;
  const chipLabels = [...new Set([project.category, project.status, ...project.topics].filter(Boolean))];
  const chips = layoutChips(chipLabels, { maxWidth: contentWidth, maxRows: 2 });
  const footerUrl = fitTextToWidth(`ninjatomapps.com/projects/${project.slug}.html`, 21, 560);
  const footerBrand = "NinjaTom Apps / Studio Portfolio";
  const layout = {
    canvas: { x: 0, y: 0, width: 1200, height: 630 },
    card: { x: 70, y: 174, width: 1060, height: 338 },
    content: { x: 70 + contentX, y: 174 + 14, width: contentWidth, height: 324 },
    title: textBounds(titleLines, 70 + contentX, 174 + titleY, titleSize, titleLineHeight),
    tagline: textBounds(taglineLines, 70 + contentX, 174 + taglineY, taglineSize, taglineLineHeight),
    chips: chips.map((chip) => ({
      label: chip.label,
      x: 70 + contentX + chip.x,
      y: 174 + chipY + chip.y,
      width: chip.width,
      height: chip.height,
      priority: chip.priority,
    })),
    footerUrl: textBounds([footerUrl], 72, 578, 21, 26),
    footerBrand: {
      ...textBounds([footerBrand], 1128 - estimateTextWidth(footerBrand, 23), 578, 23, 28),
      anchor: "end",
    },
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(project.name)} | NinjaTom Apps</title>
  <desc id="desc">${escapeXml(project.tagline)}</desc>
  <metadata id="layout-metadata">${escapeXml(JSON.stringify(layout))}</metadata>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#05070d"/>
      <stop offset="0.52" stop-color="#07111d"/>
      <stop offset="1" stop-color="#0b0820"/>
    </linearGradient>
    <radialGradient id="glow" cx="74%" cy="18%" r="62%">
      <stop offset="0" stop-color="${escapeXml(project.accent)}" stop-opacity="0.48"/>
      <stop offset="0.42" stop-color="${escapeXml(project.accent)}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${escapeXml(project.accent)}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="22" flood-color="#000000" flood-opacity="0.42"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <path d="M760 86c146-42 284-4 372 92" fill="none" stroke="${escapeXml(project.accent)}" stroke-opacity="0.28" stroke-width="2"/>
  <path d="M700 534c168 32 308-4 426-108" fill="none" stroke="#2ad4ff" stroke-opacity="0.15" stroke-width="2"/>
  <g transform="translate(72 64)">
    <image x="0" y="3" width="112" height="74" preserveAspectRatio="xMidYMid meet" href="${brandMarkDataUri}"/>
    <text x="132" y="55" fill="#f7f4f0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="38" font-weight="820">NinjaTom <tspan fill="${escapeXml(project.accent)}">Apps</tspan></text>
  </g>
  <g filter="url(#softShadow)" transform="translate(70 174)">
    <rect x="0" y="0" width="1060" height="338" rx="34" fill="#0d1420" fill-opacity="0.88" stroke="#a6badc" stroke-opacity="0.18"/>
    <rect x="34" y="34" width="156" height="156" rx="30" fill="${escapeXml(project.accent)}" fill-opacity="0.16" stroke="${escapeXml(project.accent)}" stroke-opacity="0.42"/>
    <text x="112" y="126" text-anchor="middle" fill="#f7f4f0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="64" font-weight="900">${escapeXml(initials(project.name))}</text>
    <text x="${contentX}" y="${titleY}" fill="#f7f4f0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="${titleSize}" font-weight="900" letter-spacing="0">${titleLines.map((line, index) => `<tspan x="${contentX}" dy="${index === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`).join("")}</text>
    <text x="${contentX}" y="${taglineY}" fill="#b8c0cf" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="${taglineSize}" font-weight="520">${taglineLines.map((line, index) => `<tspan x="${contentX}" dy="${index === 0 ? 0 : taglineLineHeight}">${escapeXml(line)}</tspan>`).join("")}</text>
    <g transform="translate(${contentX} ${chipY})">
      ${chips.map((chip) => chipSvg(chip, project.accent)).join("")}
    </g>
  </g>
  <text x="72" y="578" fill="#7f8797" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="21" font-weight="680">${escapeXml(footerUrl)}</text>
  <text x="1128" y="578" text-anchor="end" fill="#dcd3ff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="23" font-weight="760">${footerBrand}</text>
</svg>
`;
}

function projectPage(project, imageExtension) {
  const pageUrl = new URL(`projects/${project.slug}.html`, siteUrl).href;
  const drawerUrl = new URL(`#project/${project.slug}`, siteUrl).href;
  const imageUrl = new URL(`assets/project-og/${project.slug}.${imageExtension}`, siteUrl).href;
  const imageType = imageExtension === "png" ? "image/png" : "image/svg+xml";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(project.name)} | NinjaTom Apps</title>
    <meta name="description" content="${escapeAttr(project.tagline)}">
    <link rel="canonical" href="${escapeAttr(pageUrl)}">
    <meta property="og:title" content="${escapeAttr(project.name)} | NinjaTom Apps">
    <meta property="og:description" content="${escapeAttr(project.tagline)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeAttr(pageUrl)}">
    <meta property="og:site_name" content="NinjaTom Apps">
    <meta property="og:image" content="${escapeAttr(imageUrl)}">
    <meta property="og:image:secure_url" content="${escapeAttr(imageUrl)}">
    <meta property="og:image:type" content="${imageType}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeAttr(project.name)} project card for NinjaTom Apps.">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(project.name)} | NinjaTom Apps">
    <meta name="twitter:description" content="${escapeAttr(project.tagline)}">
    <meta name="twitter:image" content="${escapeAttr(imageUrl)}">
    <meta http-equiv="refresh" content="0; url=${escapeAttr(drawerUrl)}">
    <script>window.location.replace(${JSON.stringify(drawerUrl)});</script>
  </head>
  <body>
    <p><a href="${escapeAttr(drawerUrl)}">Open ${escapeHtml(project.name)} on NinjaTom Apps</a></p>
  </body>
</html>
`;
}

async function renderSvgToPng(svgPath, pngPath) {
  const wrapperPath = `${svgPath}.render.html`;
  try {
    const svgMarkup = (await readFile(svgPath, "utf8")).replace(/^<\?xml[^>]*>\s*/i, "");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{width:1200px;height:630px;margin:0;overflow:hidden;background:#05070d;}svg{display:block;width:1200px;height:630px;}</style></head><body>${svgMarkup}</body></html>`;
    await writeFile(wrapperPath, html);
    await rm(pngPath, { force: true });
    await runChrome([
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--run-all-compositor-stages-before-draw",
      "--default-background-color=000000",
      "--force-device-scale-factor=1",
      "--window-size=1200,630",
      `--screenshot=${pngPath}`,
      pathToFileURL(wrapperPath).href,
    ]);
    await access(pngPath);
    return true;
  } catch (error) {
    console.warn(`Warning: unable to render ${svgPath} to PNG: ${error.message}`);
    return false;
  } finally {
    await rm(wrapperPath, { force: true });
  }
}

function runChrome(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(chromePath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      code === 0 ? resolveRun() : rejectRun(new Error(stderr || `Chrome exited with code ${code}`));
    });
  });
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
      // Keep looking.
    }
  }

  console.warn("Warning: Chrome/Chromium was not found. SVG project share images will still be generated.");
  return "";
}

function chipSvg(chip, accent) {
  return `<g data-chip-label="${escapeAttr(chip.label)}" data-chip-x="${chip.x}" data-chip-y="${chip.y}" data-chip-width="${chip.width}" data-chip-height="${chip.height}" transform="translate(${chip.x} ${chip.y})"><rect width="${chip.width}" height="${chip.height}" rx="10" fill="${escapeXml(accent)}" fill-opacity="0.14" stroke="${escapeXml(accent)}" stroke-opacity="0.35"/><text x="17" y="22" fill="#f7f4f0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="820">${escapeXml(chip.label)}</text></g>`;
}

function layoutChips(labels, { maxWidth, maxRows }) {
  const chips = [];
  let x = 0;
  let row = 0;
  const gapX = 12;
  const gapY = 10;
  const height = 34;

  for (const [index, rawLabel] of labels.entries()) {
    const primary = index < 2;
    const widthLimit = primary ? maxWidth : 246;
    const label = fitTextToWidth(rawLabel, 16, widthLimit - 34);
    const width = Math.min(widthLimit, Math.max(88, Math.ceil(estimateTextWidth(label, 16) + 34)));
    if (x && x + width > maxWidth) {
      row += 1;
      x = 0;
    }
    if (row >= maxRows) break;
    chips.push({ label, x, y: row * (height + gapY), width, height, priority: primary ? "primary" : "topic" });
    x += width + gapX;
  }
  return chips;
}

function wrapTextByWidth(value, fontSize, maxWidth, maxLines) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (estimateTextWidth(next, fontSize) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  const clipped = lines.slice(0, maxLines).map((line) => fitTextToWidth(line, fontSize, maxWidth));
  if (lines.length > maxLines) clipped[clipped.length - 1] = fitTextToWidth(`${clipped[clipped.length - 1]}...`, fontSize, maxWidth);
  return clipped.length ? clipped : [""];
}

function titleFontSize(value) {
  const length = String(value || "").length;
  if (length > 38) return 42;
  if (length > 26) return 48;
  if (length > 18) return 54;
  return 60;
}

function estimateTextWidth(value, fontSize) {
  let units = 0;
  for (const character of String(value || "")) {
    if (/\s/.test(character)) units += 0.34;
    else if (/[ilI1|.,'`!:;]/.test(character)) units += 0.3;
    else if (/[MW@#%&]/.test(character)) units += 0.9;
    else if (/[A-Z0-9]/.test(character)) units += 0.66;
    else units += 0.56;
  }
  return Math.ceil(units * fontSize * 1.08);
}

function fitTextToWidth(value, fontSize, maxWidth) {
  const text = String(value || "");
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  let clipped = text;
  while (clipped.length && estimateTextWidth(`${clipped}...`, fontSize) > maxWidth) clipped = clipped.slice(0, -1);
  return `${clipped.trimEnd()}...`;
}

function textBounds(lines, x, baselineY, fontSize, lineHeight) {
  const width = Math.max(...lines.map((line) => estimateTextWidth(line, fontSize)), 0);
  const top = baselineY - fontSize;
  const bottom = baselineY + (lines.length - 1) * lineHeight + Math.ceil(fontSize * 0.24);
  return { x, y: top, width, height: bottom - top };
}

function isPublicFacingTopic(value) {
  const topic = String(value || "").trim().toLowerCase();
  return topic && !["html", "css", "javascript", "app-website", "project-site", "ninjatom-project-site", "github-pages"].includes(topic);
}

function slugify(value) {
  return String(value || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initials(value) {
  return String(value || "NT")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function validAccent(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : "";
}

function accentFromText(value) {
  const palette = ["#9B5CFF", "#2AD4FF", "#59F2C7", "#FF4FAB", "#FFBE5C", "#8FC6FF"];
  const hash = createHash("sha1").update(String(value || "")).digest()[0];
  return palette[hash % palette.length];
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtml(value) {
  return escapeXml(value).replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
