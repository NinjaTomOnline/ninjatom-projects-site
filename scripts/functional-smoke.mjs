#!/usr/bin/env node

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { capturePage } from "./chrome-capture.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const outDir = join(root, "artifacts", "functional-smoke");
await mkdir(outDir, { recursive: true });
const server = createServer(serveStatic);

try {
  const port = await listen(server);
  const result = await capturePage({
    url: `http://127.0.0.1:${port}/?visual-test=1`,
    outputPath: join(outDir, "functional-state.png"),
    width: 1440,
    height: 1000,
    evaluate: `(async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const cards = () => [...document.querySelectorAll('.project-card')];
      const cardNames = () => cards().map((card) => card.querySelector('h3')?.textContent?.trim()).filter(Boolean);
      const forbiddenNames = ['Reload' + 'Smith', 'Mission Control ' + 'Watch', 'Raspberry Pi ' + 'Mission Control'];

      const jsonLd = JSON.parse(document.querySelector('#structured-data').textContent);
      const graph = Array.isArray(jsonLd['@graph']) ? jsonLd['@graph'] : [];
      const collectionPage = graph.find((item) => item['@type'] === 'CollectionPage');
      const itemList = collectionPage?.mainEntity;
      const custom3dJsonLdType = itemList?.itemListElement?.find((entry) => entry.item?.name === 'Custom3D.Art')?.item?.['@type'];

      const search = document.querySelector('#project-search');
      search.value = 'MealBot Express';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(50);
      const searchNames = cardNames();

      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-filter="Games"]').click();
      await delay(50);
      const gameNames = cardNames();
      const gameCategories = cards().map((card) => card.querySelector('.category-tag')?.textContent?.trim());

      document.querySelector('[data-filter="All"]').click();
      await delay(50);
      const defaultNames = cardNames();
      const mealBotButton = document.querySelector('button[data-project-slug="mealbot-express-site"]');
      mealBotButton.focus();
      const detailButtonKeyboardFocus = document.activeElement === mealBotButton;
      mealBotButton.click();
      await delay(220);
      const drawerOpened = !document.querySelector('#project-drawer').hidden && document.querySelector('#drawer-title')?.textContent === 'MealBot Express';
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await delay(220);
      const drawerClosed = document.querySelector('#project-drawer').hidden;
      const drawerFocusRestored = document.activeElement === mealBotButton;

      document.querySelector('.skip-link').focus();
      const skipLinkKeyboardFocus = document.activeElement?.classList.contains('skip-link');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await delay(50);
      const commandOpened = !document.querySelector('#command-palette').hidden && document.activeElement?.id === 'command-input';
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await delay(220);
      const commandClosed = document.querySelector('#command-palette').hidden;

      const feedText = await fetch('feed.xml').then((response) => response.text());
      const feed = new DOMParser().parseFromString(feedText, 'application/xml');
      const sharePageOk = (await fetch('projects/mealbot-express-site.html')).ok;
      const custom3dPageOk = (await fetch('projects/custom3d-art.html')).ok;
      const publicText = [document.body.textContent, feedText, JSON.stringify(jsonLd)].join(' ');
      const forbiddenPublicNames = forbiddenNames.filter((name) => publicText.includes(name));
      const inquiryLink = document.querySelector('#work-with-us a[href^="mailto:"]')?.href || '';
      const custom3dLink = document.querySelector('#work-with-us a[href^="https://custom3d.art"]')?.href || '';

      return {
        jsonLdTypes: graph.map((item) => item['@type']),
        itemCount: itemList?.numberOfItems,
        itemEntries: itemList?.itemListElement?.length,
        custom3dJsonLdType,
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        searchNames,
        defaultNames,
        gameNames,
        gameCategories,
        drawerOpened,
        drawerClosed,
        drawerFocusRestored,
        detailButtonKeyboardFocus,
        skipLinkKeyboardFocus,
        commandOpened,
        commandClosed,
        feedItems: feed.querySelectorAll('item').length,
        feedParseErrors: feed.querySelectorAll('parsererror').length,
        sharePageOk,
        custom3dPageOk,
        forbiddenPublicNames,
        inquiryLink,
        custom3dLink,
      };
    })()`,
  });

  const checks = result.evaluation;
  await capturePage({
    url: `http://127.0.0.1:${port}/?visual-test=1`,
    outputPath: join(outDir, "studio-summary.png"),
    width: 1440,
    height: 900,
    evaluate: `(async () => {
      document.querySelector('#studio-proof').scrollIntoView({ block: 'start' });
      await new Promise((resolve) => setTimeout(resolve, 250));
      return true;
    })()`,
  });
  const failures = [];
  if (!checks.jsonLdTypes.includes("Organization") || !checks.jsonLdTypes.includes("WebSite") || !checks.jsonLdTypes.includes("CollectionPage")) failures.push("JSON-LD graph is incomplete.");
  if (checks.itemCount !== 23 || checks.itemEntries !== 23) failures.push(`JSON-LD item list expected 23 projects, found ${checks.itemCount}/${checks.itemEntries}.`);
  if (checks.canonical !== "https://ninjatomapps.com/") failures.push(`Canonical URL mismatch: ${checks.canonical}`);
  if (checks.custom3dJsonLdType !== "CreativeWork") failures.push(`Custom3D.Art JSON-LD type must be CreativeWork, found ${checks.custom3dJsonLdType}.`);
  if (checks.searchNames.length !== 1 || checks.searchNames[0] !== "MealBot Express") failures.push(`Search returned ${checks.searchNames.join(", ") || "nothing"}.`);
  if (!checks.gameNames.length || checks.gameCategories.some((category) => category !== "Game")) failures.push("Games filter returned a non-game or no projects.");
  if (!checks.drawerOpened || !checks.drawerClosed) failures.push("Project drawer open/Escape-close path failed.");
  if (!checks.drawerFocusRestored || !checks.detailButtonKeyboardFocus || !checks.skipLinkKeyboardFocus) failures.push("Keyboard focus or drawer focus-restoration path failed.");
  if (!checks.commandOpened || !checks.commandClosed) failures.push("Keyboard command palette path failed.");
  if (checks.feedParseErrors || checks.feedItems !== 23) failures.push(`RSS expected 23 valid items, found ${checks.feedItems}.`);
  if (!checks.sharePageOk || !checks.custom3dPageOk) failures.push("Representative generated share page did not load.");
  if (checks.forbiddenPublicNames.length) failures.push(`Owner-designated private names leaked: ${checks.forbiddenPublicNames.join(', ')}.`);
  if (checks.defaultNames.slice(0, 6).join('|') !== ['DoorCodes', 'QuitGentle', 'Zen Wisdom', 'DreamSpell', 'Custom3D.Art', 'MealBot Express'].join('|')) failures.push(`Lifecycle hierarchy mismatch: ${checks.defaultNames.slice(0, 6).join(', ')}.`);
  if (!checks.inquiryLink.includes('subject=NinjaTom%20Apps%20Project%20Inquiry') || checks.custom3dLink !== 'https://custom3d.art/') failures.push("Business-development or Custom3D.Art conversion link failed.");
  if (failures.length) {
    console.error(JSON.stringify(checks, null, 2));
    throw new Error(failures.join("\n"));
  }

  console.log(`Functional smoke passed: ${checks.itemCount} JSON-LD projects, ${checks.feedItems} RSS items, ${checks.gameNames.length} game cards.`);
  console.log("Search, filters, lifecycle order, drawer Escape/focus restoration, keyboard quick-find, skip link, canonical URL, conversion links, private-name absence, and representative share pages passed.");
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
  const requestedPath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname;
  const filePath = resolve(root, normalize(requestedPath).replace(/^\/+/, ""));
  if (!filePath.startsWith(root)) { response.writeHead(403); response.end("Forbidden"); return; }
  try { await access(filePath); } catch { response.writeHead(404); response.end("Not found"); return; }
  response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
  createReadStream(filePath).pipe(response);
}

function contentType(filePath) {
  return ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" })[extname(filePath).toLowerCase()] || "application/octet-stream";
}
