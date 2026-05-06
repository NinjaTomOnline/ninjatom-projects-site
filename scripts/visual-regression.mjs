#!/usr/bin/env node

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { inflateSync } from "node:zlib";

const root = resolve(new URL("..", import.meta.url).pathname);
const outDir = resolve(root, "artifacts", "visual-regression");
const baselineDir = resolve(root, "tests", "visual-baselines");
const updateBaselines = process.argv.includes("--update-baselines");
const chromePath = await findChrome();
const changedPixelThreshold = Number(process.env.VISUAL_CHANGED_THRESHOLD || 0.18);
const averageChannelThreshold = Number(process.env.VISUAL_AVG_THRESHOLD || 16);

const shots = [
  {
    name: "desktop-home",
    path: "./?visual-test=1",
    windowSize: "1440,1000",
    width: 1440,
    height: 1000,
  },
  {
    name: "tablet-home",
    path: "./?visual-test=1",
    windowSize: "1024,768",
    width: 1024,
    height: 768,
  },
  {
    name: "mobile-home",
    path: "./?visual-test=1",
    windowSize: "390,844",
    width: 390,
    height: 844,
  },
  {
    name: "desktop-projects",
    path: "./?visual-test=1&view=projects",
    windowSize: "1440,1200",
    width: 1440,
    height: 1200,
  },
  {
    name: "desktop-category-games",
    path: "./?visual-test=1#category/games",
    windowSize: "1440,1000",
    width: 1440,
    height: 1000,
  },
  {
    name: "desktop-project-detail",
    path: "./?visual-test=1#project/doorcodes-site",
    windowSize: "1440,1000",
    width: 1440,
    height: 1000,
  },
  {
    name: "desktop-projected-project-detail",
    path: "./?visual-test=1#project/zenwisdom-site",
    windowSize: "1440,1000",
    width: 1440,
    height: 1000,
  },
  {
    name: "desktop-command-palette",
    path: "./?visual-test=1&command=1",
    windowSize: "1440,1000",
    width: 1440,
    height: 1000,
  },
  {
    name: "changelog",
    path: "./changelog.html?visual-test=1",
    windowSize: "1440,900",
    width: 1440,
    height: 900,
  },
  {
    name: "status",
    path: "./status.html?visual-test=1",
    windowSize: "1440,900",
    width: 1440,
    height: 900,
  },
  {
    name: "not-found",
    path: "./404.html?visual-test=1",
    windowSize: "1440,900",
    width: 1440,
    height: 900,
  },
];

await mkdir(outDir, { recursive: true });
await mkdir(baselineDir, { recursive: true });

const server = createServer(serveStatic);

try {
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}/`;

  for (const shot of shots) {
    const url = new URL(shot.path, baseUrl).href;
    const screenshotPath = join(outDir, `${shot.name}.png`);
    const baselinePath = join(baselineDir, `${shot.name}.png`);
    await capture(shot.name, url, shot.windowSize, shot.width, shot.height, screenshotPath);

    if (updateBaselines) {
      await copyFile(screenshotPath, baselinePath);
      console.log(`Updated baseline ${relativePath(baselinePath)}.`);
    } else {
      await compareToBaseline(shot.name, screenshotPath, baselinePath);
    }
  }

  console.log(
    updateBaselines
      ? `Visual baselines updated in ${relativePath(baselineDir)}.`
      : "Visual regression baselines matched.",
  );
} finally {
  server.close();
}

async function capture(name, url, windowSize, expectedWidth, expectedHeight, screenshotPath) {
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

  const info = await readPng(screenshotPath);
  if (info.width !== expectedWidth || info.height !== expectedHeight) {
    throw new Error(`${name} screenshot was ${info.width}x${info.height}, expected ${expectedWidth}x${expectedHeight}.`);
  }

  const fileInfo = await stat(screenshotPath);
  if (fileInfo.size < 25_000) {
    throw new Error(`${name} screenshot is suspiciously small (${fileInfo.size} bytes).`);
  }
}

async function compareToBaseline(name, screenshotPath, baselinePath) {
  try {
    await access(baselinePath);
  } catch {
    throw new Error(`Missing visual baseline for ${name}. Run: node scripts/visual-regression.mjs --update-baselines`);
  }

  const actual = await readPng(screenshotPath);
  const expected = await readPng(baselinePath);
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(
      `${name} baseline dimensions changed: actual ${actual.width}x${actual.height}, expected ${expected.width}x${expected.height}.`,
    );
  }

  const pixelCount = actual.width * actual.height;
  let changedPixels = 0;
  let totalDelta = 0;

  for (let index = 0; index < actual.pixels.length; index += 4) {
    const dr = Math.abs(actual.pixels[index] - expected.pixels[index]);
    const dg = Math.abs(actual.pixels[index + 1] - expected.pixels[index + 1]);
    const db = Math.abs(actual.pixels[index + 2] - expected.pixels[index + 2]);
    const da = Math.abs(actual.pixels[index + 3] - expected.pixels[index + 3]);
    const maxDelta = Math.max(dr, dg, db, da);
    totalDelta += dr + dg + db + da;
    if (maxDelta > 28) changedPixels += 1;
  }

  const changedRatio = changedPixels / pixelCount;
  const averageChannelDelta = totalDelta / (pixelCount * 4);
  if (changedRatio > changedPixelThreshold || averageChannelDelta > averageChannelThreshold) {
    throw new Error(
      `${name} visual regression exceeded threshold: ${(changedRatio * 100).toFixed(3)}% changed, average channel delta ${averageChannelDelta.toFixed(3)}.`,
    );
  }

  console.log(
    `${name} matched baseline (${(changedRatio * 100).toFixed(3)}% changed, avg channel delta ${averageChannelDelta.toFixed(3)}).`,
  );
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

async function readPng(filePath) {
  const buffer = await readFile(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`${filePath} is not a PNG file.`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8) {
    throw new Error(`${filePath} uses unsupported PNG bit depth ${bitDepth}.`);
  }

  const bytesPerPixel = bytesPerPixelFor(colorType);
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const scanlineLength = width * bytesPerPixel;
  const raw = new Uint8Array(height * scanlineLength);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * scanlineLength;
    const previousRowStart = rowStart - scanlineLength;

    for (let x = 0; x < scanlineLength; x += 1) {
      const left = x >= bytesPerPixel ? raw[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? raw[previousRowStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? raw[previousRowStart + x - bytesPerPixel] : 0;
      const value = inflated[sourceOffset];
      sourceOffset += 1;

      raw[rowStart + x] = unfilter(filter, value, left, up, upLeft);
    }
  }

  return {
    width,
    height,
    pixels: toRgba(raw, width, height, colorType, bytesPerPixel),
  };
}

function bytesPerPixelFor(colorType) {
  switch (colorType) {
    case 0:
      return 1;
    case 2:
      return 3;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      throw new Error(`Unsupported PNG color type ${colorType}.`);
  }
}

function unfilter(filter, value, left, up, upLeft) {
  switch (filter) {
    case 0:
      return value;
    case 1:
      return (value + left) & 0xff;
    case 2:
      return (value + up) & 0xff;
    case 3:
      return (value + Math.floor((left + up) / 2)) & 0xff;
    case 4:
      return (value + paeth(left, up, upLeft)) & 0xff;
    default:
      throw new Error(`Unsupported PNG filter ${filter}.`);
  }
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  return upDistance <= upLeftDistance ? up : upLeft;
}

function toRgba(raw, width, height, colorType, bytesPerPixel) {
  const rgba = new Uint8Array(width * height * 4);

  for (let rawIndex = 0, rgbaIndex = 0; rawIndex < raw.length; rawIndex += bytesPerPixel, rgbaIndex += 4) {
    if (colorType === 0) {
      rgba[rgbaIndex] = raw[rawIndex];
      rgba[rgbaIndex + 1] = raw[rawIndex];
      rgba[rgbaIndex + 2] = raw[rawIndex];
      rgba[rgbaIndex + 3] = 255;
    } else if (colorType === 2) {
      rgba[rgbaIndex] = raw[rawIndex];
      rgba[rgbaIndex + 1] = raw[rawIndex + 1];
      rgba[rgbaIndex + 2] = raw[rawIndex + 2];
      rgba[rgbaIndex + 3] = 255;
    } else if (colorType === 4) {
      rgba[rgbaIndex] = raw[rawIndex];
      rgba[rgbaIndex + 1] = raw[rawIndex];
      rgba[rgbaIndex + 2] = raw[rawIndex];
      rgba[rgbaIndex + 3] = raw[rawIndex + 1];
    } else {
      rgba[rgbaIndex] = raw[rawIndex];
      rgba[rgbaIndex + 1] = raw[rawIndex + 1];
      rgba[rgbaIndex + 2] = raw[rawIndex + 2];
      rgba[rgbaIndex + 3] = raw[rawIndex + 3];
    }
  }

  return rgba;
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

  throw new Error("Chrome or Chromium was not found. Set CHROME_PATH to run the visual regression check.");
}

function relativePath(filePath) {
  return filePath.replace(`${root}/`, "");
}
