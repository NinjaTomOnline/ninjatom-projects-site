import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

export async function capturePage({ url, outputPath, width, height, mobile = width <= 500, evaluate = "" }) {
  const chromePath = await findChrome();
  const profileDir = await mkdtemp(join(tmpdir(), "ninjatom-cdp-capture-"));
  const child = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-sandbox",
    "--hide-scrollbars",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    const port = await waitForDevToolsPort(profileDir, child, stderr);
    const pages = await retry(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) throw new Error(`DevTools page list returned ${response.status}.`);
      return response.json();
    });
    const page = pages.find((entry) => entry.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("Chrome did not expose a debuggable page.");

    const cdp = await connectCdp(page.webSocketDebuggerUrl);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
        screenWidth: width,
        screenHeight: height,
      });
      await cdp.send("Emulation.setVisibleSize", { width, height });

      const loaded = cdp.waitFor("Page.loadEventFired", 15_000);
      await cdp.send("Page.navigate", { url });
      await loaded;
      await cdp.send("Runtime.evaluate", {
        expression: `new Promise((resolve) => {
          const started = Date.now();
          const ready = () => {
            const isPortfolio = location.pathname.endsWith('/') || location.pathname.endsWith('/index.html');
            const hasContent = !isPortfolio || document.querySelectorAll('.project-card').length > 0;
            if (document.readyState === 'complete' && hasContent) return resolve(true);
            if (Date.now() - started > 8000) return resolve(false);
            setTimeout(ready, 100);
          };
          ready();
        })`,
        awaitPromise: true,
        returnByValue: true,
      });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 350));

      const metrics = await cdp.send("Runtime.evaluate", {
        expression: "({innerWidth, innerHeight, scrollWidth: document.documentElement.scrollWidth})",
        returnByValue: true,
      });
      const viewport = metrics.result?.value;
      if (viewport?.innerWidth !== width || viewport?.innerHeight !== height) {
        throw new Error(`CDP viewport was ${viewport?.innerWidth}x${viewport?.innerHeight}, expected ${width}x${height}.`);
      }
      if (mobile && viewport?.scrollWidth > width + 1) {
        throw new Error(`Page has horizontal overflow: ${viewport.scrollWidth}px content in a ${width}px viewport.`);
      }

      let evaluation;
      if (evaluate) {
        const evaluated = await cdp.send("Runtime.evaluate", {
          expression: evaluate,
          awaitPromise: true,
          returnByValue: true,
        });
        if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.text || "Browser evaluation failed.");
        evaluation = evaluated.result?.value;
      }

      const screenshot = await cdp.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
      await cdp.send("Browser.close").catch(() => {});
      return { viewport, evaluation };
    } finally {
      cdp.close();
    }
  } finally {
    await stopProcess(child);
    await rm(profileDir, { recursive: true, force: true });
  }
}

async function waitForDevToolsPort(profileDir, child, stderr) {
  const file = join(profileDir, "DevToolsActivePort");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Chrome exited before DevTools started: ${stderr}`);
    try {
      const [port] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {
      // DevToolsActivePort is not ready yet.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for Chrome DevTools. ${stderr}`);
}

async function retry(operation) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { return await operation(); } catch (error) { lastError = error; }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw lastError;
}

function connectCdp(url) {
  return new Promise((resolveConnect, rejectConnect) => {
    const socket = new WebSocket(url);
    let nextId = 1;
    const pending = new Map();
    const listeners = new Map();

    const api = {
      send(method, params = {}) {
        return new Promise((resolveSend, rejectSend) => {
          const id = nextId++;
          pending.set(id, { resolve: resolveSend, reject: rejectSend });
          socket.send(JSON.stringify({ id, method, params }));
        });
      },
      waitFor(method, timeoutMs) {
        return new Promise((resolveEvent, rejectEvent) => {
          const timer = setTimeout(() => {
            listeners.delete(method);
            rejectEvent(new Error(`Timed out waiting for ${method}.`));
          }, timeoutMs);
          listeners.set(method, (params) => {
            clearTimeout(timer);
            listeners.delete(method);
            resolveEvent(params);
          });
        });
      },
      close() { socket.close(); },
    };

    socket.onopen = () => resolveConnect(api);
    socket.onerror = () => rejectConnect(new Error("Could not connect to Chrome DevTools WebSocket."));
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
        return;
      }
      listeners.get(message.method)?.(message.params);
    };
    socket.onclose = () => {
      for (const request of pending.values()) request.reject(new Error("Chrome DevTools connection closed."));
      pending.clear();
    };
  });
}

async function stopProcess(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => child.once("close", resolveExit)),
    new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
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
    try { await access(candidate); return candidate; } catch { /* Try next. */ }
  }
  throw new Error("Chrome or Chromium was not found. Set CHROME_PATH to run visual checks.");
}
