const STATUS_REPO = "NinjaTomOnline/ninjatom-projects-site";
const WORKFLOW_URL = `https://api.github.com/repos/${STATUS_REPO}/actions/workflows/auto-index-deploy.yml/runs?branch=main&per_page=1`;

const statusElements = {
  deploy: document.querySelector("#status-deploy"),
  workflow: document.querySelector("#status-workflow"),
  repoIndex: document.querySelector("#status-repo-index"),
  feed: document.querySelector("#status-feed"),
  copyCatalog: document.querySelector("#status-copy-catalog"),
};

initStatusPage();

function initStatusPage() {
  loadDeployStatus();
  loadWorkflowStatus();
  loadRepoIndexStatus();
  loadFeedStatus();
  statusElements.copyCatalog?.addEventListener("click", copyRepoIndexJson);
}

async function loadDeployStatus() {
  try {
    const status = await fetchJson("data/deploy-status.json");
    const runLink = status.runUrl
      ? `<a href="${escapeAttr(status.runUrl)}" rel="noopener noreferrer">Open run</a>`
      : "";
    updateCard(
      statusElements.deploy,
      "OK",
      `Generated ${formatDateTime(status.generatedAt) || "recently"}.`,
      [
        status.workflow ? escapeHtml(status.workflow) : "",
        status.shortCommit ? `commit ${escapeHtml(status.shortCommit)}` : "",
        runLink,
      ]
        .filter(Boolean)
        .join(" / "),
    );
  } catch (error) {
    updateCard(statusElements.deploy, "Needs data", "The deploy-status artifact was not available.", escapeHtml(error.message));
  }
}

async function loadWorkflowStatus() {
  try {
    const payload = await fetchJson(WORKFLOW_URL);
    const run = payload.workflow_runs?.[0];
    if (!run) throw new Error("No workflow runs were returned.");

    const label = run.conclusion ? `${run.status} / ${run.conclusion}` : run.status;
    updateCard(
      statusElements.workflow,
      label,
      `Latest run ${formatRelative(run.updated_at) || formatDateTime(run.updated_at)}.`,
      `<a href="${escapeAttr(run.html_url)}" rel="noopener noreferrer">Run #${escapeHtml(run.run_number)}</a>`,
    );
  } catch (error) {
    updateCard(statusElements.workflow, "Unavailable", "GitHub workflow status could not be loaded.", escapeHtml(error.message));
  }
}

async function loadRepoIndexStatus() {
  try {
    const payload = await fetchJson("data/projects.json");
    const repoCount = payload.count || payload.repositories?.length || 0;
    const latestRepo = [...(payload.repositories || [])].sort(
      (a, b) => dateValue(b.pushed_at) - dateValue(a.pushed_at),
    )[0];
    updateCard(
      statusElements.repoIndex,
      `${repoCount} repos`,
      `Generated ${formatDateTime(payload.generatedAt) || "recently"}.`,
      latestRepo ? `Newest push: ${escapeHtml(latestRepo.full_name || latestRepo.name)}.` : "No repositories listed.",
    );
  } catch (error) {
    updateCard(statusElements.repoIndex, "Unavailable", "Repo index JSON could not be loaded.", escapeHtml(error.message));
  }
}

async function loadFeedStatus() {
  try {
    const text = await fetchText("feed.xml");
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const items = [...doc.querySelectorAll("item")];
    const latest = doc.querySelector("channel > lastBuildDate")?.textContent || items[0]?.querySelector("pubDate")?.textContent || "";
    updateCard(
      statusElements.feed,
      `${items.length} items`,
      `Latest feed build ${formatDateTime(latest) || "available"}.`,
      `<a href="feed.xml">Open feed.xml</a>`,
    );
  } catch (error) {
    updateCard(statusElements.feed, "Unavailable", "RSS feed could not be loaded.", escapeHtml(error.message));
  }
}

async function copyRepoIndexJson() {
  const button = statusElements.copyCatalog;
  if (!button) return;

  const originalText = button.textContent;
  try {
    const text = await fetchText("data/projects.json");
    await writeTextToClipboard(JSON.stringify(JSON.parse(text), null, 2));
    button.textContent = "Copied Repo Index";
  } catch (error) {
    console.warn("Unable to copy repo index JSON.", error);
    button.textContent = "Copy failed";
  } finally {
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1400);
  }
}

function updateCard(card, headline, body, detail = "") {
  if (!card) return;

  const strong = card.querySelector("strong");
  const paragraph = card.querySelector("p");
  if (strong) strong.textContent = headline;
  if (paragraph) paragraph.innerHTML = `${escapeHtml(body)}${detail ? `<br><span>${detail}</span>` : ""}`;
  card.classList.toggle("status-card-warning", /fail|error|unavailable|needs/i.test(headline));
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function writeTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelative(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const delta = Date.now() - date.getTime();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (delta < hour) return "less than 1h ago";
  if (delta < day) return `${Math.max(1, Math.floor(delta / hour))}h ago`;
  return `${Math.max(1, Math.floor(delta / day))}d ago`;
}

function dateValue(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
