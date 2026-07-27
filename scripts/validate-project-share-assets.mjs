#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const projects = JSON.parse(await readFile(join(root, "projects.json"), "utf8")).projects || [];
const imageDir = join(root, "assets", "project-og");
const pageDir = join(root, "projects");
const expectedSlugs = new Set(projects.map((project) => slugify(project.slug || project.repoName || project.name)));
const failures = [];

const imageNames = await readdir(imageDir);
const pageNames = await readdir(pageDir);
const svgNames = imageNames.filter((name) => name.endsWith(".svg"));
const pngNames = imageNames.filter((name) => name.endsWith(".png"));
const htmlNames = pageNames.filter((name) => name.endsWith(".html"));

if (svgNames.length !== projects.length) failures.push(`Expected ${projects.length} SVG project images, found ${svgNames.length}.`);
if (pngNames.length !== projects.length) failures.push(`Expected ${projects.length} PNG project images, found ${pngNames.length}.`);
if (htmlNames.length !== projects.length) failures.push(`Expected ${projects.length} project share pages, found ${htmlNames.length}.`);
validateExpectedNames("SVG project images", svgNames, ".svg");
validateExpectedNames("PNG project images", pngNames, ".png");
validateExpectedNames("project share pages", htmlNames, ".html");

for (const name of svgNames.sort()) {
  const source = await readFile(join(imageDir, name), "utf8");
  if (source.includes("Custom3D.Art / GitHub Pages")) failures.push(`${name}: legacy footer remains.`);
  if (!source.includes("NinjaTom Apps / Studio Portfolio")) failures.push(`${name}: studio footer is missing.`);
  const match = source.match(/<metadata id="layout-metadata">([\s\S]*?)<\/metadata>/);
  if (!match) {
    failures.push(`${name}: layout metadata is missing.`);
    continue;
  }

  let layout;
  try {
    layout = JSON.parse(unescapeXml(match[1]));
  } catch (error) {
    failures.push(`${name}: layout metadata is invalid (${error.message}).`);
    continue;
  }

  validateContained(name, "card", layout.card, layout.canvas);
  validateContained(name, "content", layout.content, layout.card);
  validateContained(name, "title", layout.title, layout.content);
  validateContained(name, "tagline", layout.tagline, layout.content);
  validateContained(name, "footer URL", layout.footerUrl, layout.canvas);
  validateContained(name, "footer brand", layout.footerBrand, layout.canvas);

  if (overlaps(layout.title, layout.tagline)) failures.push(`${name}: title and description bounds overlap.`);
  for (const chip of layout.chips || []) {
    validateContained(name, `chip ${chip.label}`, chip, layout.content);
    if (overlaps(layout.title, chip)) failures.push(`${name}: chip ${chip.label} overlaps the title.`);
    if (overlaps(layout.tagline, chip)) failures.push(`${name}: chip ${chip.label} overlaps the description.`);
  }
  for (let index = 0; index < layout.chips.length; index += 1) {
    for (let other = index + 1; other < layout.chips.length; other += 1) {
      if (overlaps(layout.chips[index], layout.chips[other])) {
        failures.push(`${name}: chips ${layout.chips[index].label} and ${layout.chips[other].label} overlap.`);
      }
    }
  }
  if (overlaps(layout.footerUrl, layout.footerBrand)) failures.push(`${name}: footer URL and studio label overlap.`);
  if (layout.chips[0]?.priority !== "primary" || layout.chips[1]?.priority !== "primary") {
    failures.push(`${name}: category and lifecycle chips are not first-priority.`);
  }
}

for (const name of pngNames.sort()) {
  const buffer = await readFile(join(imageDir, name));
  const dimensions = pngDimensions(buffer);
  if (dimensions.width !== 1200 || dimensions.height !== 630) {
    failures.push(`${name}: expected 1200x630, found ${dimensions.width}x${dimensions.height}.`);
  }
}

for (const directory of [imageDir, pageDir]) {
  for (const name of await readdir(directory)) {
    if (!/\.(svg|html)$/i.test(name)) continue;
    const source = await readFile(join(directory, name), "utf8");
    if (source.includes("Custom3D.Art / GitHub Pages")) failures.push(`${name}: legacy footer remains in generated public assets.`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Project share assets passed: ${projects.length} share pages, ${svgNames.length} SVGs, ${pngNames.length} PNGs; no overlaps or boundary violations.`);
}

function validateContained(file, label, inner, outer) {
  if (!inner || !outer) {
    failures.push(`${file}: ${label} bounds are missing.`);
    return;
  }
  const tolerance = 0.5;
  if (
    inner.x < outer.x - tolerance ||
    inner.y < outer.y - tolerance ||
    inner.x + inner.width > outer.x + outer.width + tolerance ||
    inner.y + inner.height > outer.y + outer.height + tolerance
  ) {
    failures.push(`${file}: ${label} exceeds its defined boundary.`);
  }
}

function validateExpectedNames(label, names, extension) {
  const actual = new Set(names.map((name) => name.slice(0, -extension.length)));
  const missing = [...expectedSlugs].filter((slug) => !actual.has(slug));
  const unexpected = [...actual].filter((slug) => !expectedSlugs.has(slug));
  if (missing.length) failures.push(`${label}: missing ${missing.join(", ")}.`);
  if (unexpected.length) failures.push(`${label}: unexpected ${unexpected.join(", ")}.`);
}

function overlaps(left, right) {
  if (!left || !right) return false;
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

function unescapeXml(value) {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    return { width: 0, height: 0 };
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function slugify(value) {
  return String(value || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
