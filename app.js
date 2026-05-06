const FILTERS = {
  All: () => true,
  "iOS Apps": (project) => categoryIncludes(project, ["ios", "iphone", "ipad", "watchos"]),
  "Web Apps": (project) => categoryIncludes(project, ["web", "website", "saas"]),
  Games: (project) => categoryIncludes(project, ["game", "games"]),
  Tools: (project) => categoryIncludes(project, ["tool", "utility", "productivity"]),
  "Creative / Custom3D": (project) =>
    categoryIncludes(project, ["creative", "custom3d", "custom 3d", "3d", "art"]),
  "Recently Launched": (project) => isRecentlyLaunched(project),
};
const FILTERS_BY_SLUG = Object.fromEntries(Object.keys(FILTERS).map((filter) => [categorySlug(filter), filter]));

const INITIAL_VISIBLE_COUNT = 12;
const CANONICAL_SITE_URL = "https://ninjatomapps.com/";
const ORGANIZATION_ID = `${CANONICAL_SITE_URL}#organization`;
const WEBSITE_ID = `${CANONICAL_SITE_URL}#website`;
const urlParams = new URLSearchParams(window.location.search);
const visualTestMode = urlParams.has("visual-test");
const visualView = urlParams.get("view");
const visualScrollTarget = urlParams.get("scroll");
const visualCommand = urlParams.get("command");
let didApplyVisualScroll = false;
let didApplyHashScroll = false;
let activeProject = null;
let lastFocusedElement = null;
let lastCommandFocusedElement = null;
let commandItems = [];
let activeCommandIndex = 0;

if (visualTestMode) {
  document.body.dataset.visualTest = "true";
  if (visualView) {
    document.body.dataset.visualView = visualView;
  }
}

const FALLBACK_PROJECTS = [
  {
    name: "DoorCodes",
    tagline: "Access codes, ready on arrival with privacy-safe reminders and Secure Reveal.",
    category: "iOS App",
    status: "Live",
    website: "https://doorcodesapp.com/",
    supportUrl: "https://doorcodesapp.com/support.html",
    privacyUrl: "https://doorcodesapp.com/privacy.html",
    appStoreUrl: "https://apps.apple.com/us/app/doorcodes-vault/id6761863570",
    icon: "https://doorcodesapp.com/assets/doorcodes-favicon-512.png",
    previewImage: "https://doorcodesapp.com/assets/doorcodes-social-preview.png",
    previewImageAlt: "DoorCodes website preview for the upgraded access-code app site.",
    launchedAt: "2026-04-30T00:00:00Z",
    version: "Live",
    launchNotes: "DoorCodes is live with a polished project site, App Store link, support, privacy, and launch artwork.",
    versionHighlights: [
      "App Store listing connected",
      "Support and privacy pages available",
      "Premium screenshot gallery ready",
    ],
    accent: "#38BDF8",
    featured: true,
    sortOrder: 10,
  },
  {
    name: "SwiftTerm",
    tagline: "A polished terminal companion for fast command notes and workflows.",
    category: "Tool",
    status: "Live",
    website: "https://swiftterm.app",
    supportUrl: "",
    privacyUrl: "",
    appStoreUrl: "",
    icon: "",
    launchedAt: "2026-04-30T00:00:00Z",
    version: "Preview",
    launchNotes: "SwiftTerm has a live project site and technical preview material ready for the hub.",
    versionHighlights: ["Project site indexed", "Technical preview artwork available"],
    accent: "#59F2C7",
    featured: true,
    sortOrder: 20,
  },
  {
    name: "Zen Wisdom",
    tagline: "Quiet daily reflections designed for calmer routines.",
    category: "iOS App",
    status: "Live",
    website: "https://zenwisdom.app",
    supportUrl: "",
    privacyUrl: "",
    appStoreUrl: "",
    icon: "",
    launchedAt: "2026-04-30T00:00:00Z",
    version: "Live",
    launchNotes: "Zen Wisdom is indexed as a calm reflection app with launch artwork and support links.",
    versionHighlights: ["Daily reflections positioned", "Screenshot gallery available"],
    accent: "#A78BFA",
    featured: false,
    sortOrder: 30,
  },
];

const state = {
  projects: [],
  filter: "All",
  query: "",
  sort: "studio",
  visibleCount: INITIAL_VISIBLE_COUNT,
};

const elements = {
  grid: document.querySelector("#project-grid"),
  statePanel: document.querySelector("#state-panel"),
  dataNote: document.querySelector("#data-note"),
  search: document.querySelector("#project-search"),
  sort: document.querySelector("#project-sort"),
  filterTabs: document.querySelector("#filter-tabs"),
  resultCount: document.querySelector("#result-count"),
  loadMoreWrap: document.querySelector("#load-more-wrap"),
  loadMore: document.querySelector("#load-more"),
  heroShowcase: document.querySelector("#hero-showcase"),
  latestStrip: document.querySelector("#latest-strip"),
  studioNotes: document.querySelector("#studio-notes"),
  studioNotesGrid: document.querySelector("#studio-notes-grid"),
  discoveryStrip: document.querySelector("#discovery-strip"),
  discoveryCount: document.querySelector("#discovery-count"),
  discoveryManifests: document.querySelector("#discovery-manifests"),
  discoveryGenerated: document.querySelector("#discovery-generated"),
  drawer: document.querySelector("#project-drawer"),
  drawerContent: document.querySelector("#drawer-content"),
  commandPalette: document.querySelector("#command-palette"),
  commandInput: document.querySelector("#command-input"),
  commandResults: document.querySelector("#command-results"),
  copyCatalog: document.querySelector("#copy-catalog-json"),
};

init();

async function init() {
  bindEvents();
  decorateFilterTabs();
  showState("loading", "Loading projects...");

  try {
    const payload = await loadProjects();
    state.projects = payload.projects.map((project) => normalizeProject(project, payload));
    renderHeroShowcase(state.projects);
    renderLatestUpdates(state.projects);
    renderStudioNotes(state.projects);
    renderProjects();
    buildCommandItems();
    setDataNote(payload);
    updateDiscoverySummary(payload);
    renderStructuredData(state.projects);
    applyHashRoute();
    applyVisualCommandPalette();
  } catch (error) {
    console.warn("Falling back to sample project data.", error);
    state.projects = FALLBACK_PROJECTS.map((project) => normalizeProject(project, { sample: true }));
    renderHeroShowcase(state.projects);
    renderLatestUpdates(state.projects);
    renderStudioNotes(state.projects);
    renderProjects();
    buildCommandItems();
    elements.dataNote.textContent = "Previewing sample data";
    updateDiscoverySummary({ sample: true });
    renderStructuredData(state.projects);
    applyHashRoute();
    applyVisualCommandPalette();
  }
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    state.visibleCount = INITIAL_VISIBLE_COUNT;
    renderProjects();
  });

  document.addEventListener("keydown", (event) => {
    if (elements.commandPalette && !elements.commandPalette.hidden) {
      handleCommandKeydown(event);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
      return;
    }

    if (event.key === "Escape" && elements.drawer && !elements.drawer.hidden) {
      closeProjectDrawer();
      return;
    }

    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const tagName = document.activeElement?.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA" || document.activeElement?.isContentEditable) return;
    event.preventDefault();
    elements.search.focus();
  });

  elements.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.visibleCount = INITIAL_VISIBLE_COUNT;
    renderProjects();
  });

  elements.commandInput?.addEventListener("input", () => {
    activeCommandIndex = 0;
    renderCommandResults();
  });

  elements.copyCatalog?.addEventListener("click", copyCatalogJson);

  elements.filterTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    setActiveFilter(button.dataset.filter, { updateHash: true });
  });

  document.addEventListener("click", (event) => {
    const detailsTrigger = event.target.closest("button[data-project-slug]");
    if (detailsTrigger) {
      event.preventDefault();
      openProjectBySlug(detailsTrigger.dataset.projectSlug, { updateHash: true });
      return;
    }

    if (event.target.closest("[data-drawer-close]")) {
      closeProjectDrawer();
      return;
    }

    if (event.target.closest("[data-command-close]")) {
      closeCommandPalette();
    }
  });

  window.addEventListener("hashchange", () => {
    applyHashRoute();
  });

  elements.loadMore.addEventListener("click", () => {
    const filtered = getFilteredProjects();
    state.visibleCount =
      state.visibleCount >= filtered.length ? INITIAL_VISIBLE_COUNT : filtered.length;
    renderProjects();
  });
}

async function loadProjects() {
  const [primaryResult, orgIndexResult] = await Promise.allSettled([
    loadProjectPayload("projects.json"),
    loadOrgIndexPayload("data/projects.json"),
  ]);

  const orgIndex = orgIndexResult.status === "fulfilled" ? orgIndexResult.value : null;
  if (orgIndexResult.status === "rejected" && orgIndexResult.reason?.status !== 404) {
    console.warn("Unable to load data/projects.json.", orgIndexResult.reason);
  }

  if (primaryResult.status === "fulfilled") {
    return mergeOrgRepositoryData(primaryResult.value, orgIndex);
  }

  if (orgIndex) {
    return orgIndexToProjectPayload(orgIndex);
  }

  throw primaryResult.reason || new Error("Unable to load project data.");
}

async function loadProjectPayload(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw statusError(`Unable to load ${path}: ${response.status}`, response.status);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.projects)) {
    throw new Error(`${path} must contain a projects array.`);
  }

  return payload;
}

async function loadOrgIndexPayload(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw statusError(`Unable to load ${path}: ${response.status}`, response.status);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.repositories)) {
    throw new Error(`${path} must contain a repositories array.`);
  }

  return payload;
}

function mergeOrgRepositoryData(payload, orgIndex) {
  if (!orgIndex?.repositories?.length) return payload;

  const repositoriesByName = new Map();
  const repositoriesByUrl = new Map();
  for (const repo of orgIndex.repositories) {
    repositoriesByName.set(String(repo.name || "").toLowerCase(), repo);
    repositoriesByUrl.set(String(repo.html_url || "").replace(/\/$/, "").toLowerCase(), repo);
  }

  return {
    ...payload,
    orgIndexGeneratedAt: orgIndex.generatedAt,
    orgIndexCount: orgIndex.count || orgIndex.repositories.length,
    projects: payload.projects.map((project) => {
      const repoUrl = String(project.repositoryUrl || "").replace(/\/$/, "").toLowerCase();
      const repo = repositoriesByName.get(String(project.repoName || "").toLowerCase()) || repositoriesByUrl.get(repoUrl);
      if (!repo) return project;

      return {
        ...project,
        repoIndex: repoIndexFromRepository(repo),
        fullName: project.fullName || repo.full_name,
        repositoryUrl: project.repositoryUrl || repo.html_url,
        description: project.description || repo.description,
        website: project.website || repo.homepage,
        topics: Array.isArray(repo.topics) && repo.topics.length ? repo.topics : project.topics,
        language: project.language || repo.language,
        archived: project.archived ?? repo.archived,
        updatedAt: project.updatedAt || repo.pushed_at,
        stargazersCount: project.stargazersCount ?? repo.stargazers_count,
        license: project.license || repo.license,
        defaultBranch: project.defaultBranch || repo.default_branch,
        openIssuesCount: project.openIssuesCount ?? repo.open_issues_count,
        latestRelease: project.latestRelease || repo.latest_release,
      };
    }),
  };
}

function orgIndexToProjectPayload(orgIndex) {
  return {
    schemaVersion: orgIndex.schemaVersion || 1,
    owner: orgIndex.owner,
    generatedAt: orgIndex.generatedAt,
    includeRules: ["data/projects.json GitHub organization repository index"],
    projects: orgIndex.repositories.map(repoToProject),
  };
}

function repoToProject(repo, index) {
  const name = humanizeRepoName(repo.name);
  const homepage = validUrl(repo.homepage);
  const language = stringOr(repo.language, "");
  const archived = Boolean(repo.archived);

  return {
    name,
    tagline: stringOr(repo.description, `Public ${language || "GitHub"} project from NinjaTomOnline.`),
    category: categoryFromRepository(repo),
    status: archived ? "Archived" : "Live",
    website: homepage,
    repositoryUrl: validUrl(repo.html_url),
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    language,
    archived,
    featured: false,
    sortOrder: 500 + index,
    repoName: repo.name,
    fullName: repo.full_name,
    repoIndex: repoIndexFromRepository(repo),
    stargazersCount: numberOr(repo.stargazers_count, 0),
    license: repo.license || "",
    defaultBranch: repo.default_branch || "",
    openIssuesCount: numberOr(repo.open_issues_count, 0),
    latestRelease: repo.latest_release || null,
    updatedAt: stringOr(repo.pushed_at, ""),
    manifestFound: false,
  };
}

function categoryFromRepository(repo) {
  const text = [
    repo.name,
    repo.description || "",
    (repo.topics || []).join(" "),
    repo.language || "",
  ]
    .join(" ")
    .toLowerCase();
  if (/(ios|iphone|ipad|swiftui)/.test(text)) return "iOS App";
  if (/(game|sprite|phaser|unity)/.test(text)) return "Games";
  if (/(custom3d|creative|3d|art|mesh|voxel)/.test(text)) return "Creative / Custom3D";
  if (/(tool|utility|cli|automation|script)/.test(text)) return "Tools";
  return "Web Apps";
}

function humanizeRepoName(value) {
  return stringOr(value, "Untitled Project")
    .replace(/-site$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeProject(project, context = {}) {
  const name = stringOr(project.name, "Untitled Project");
  const category = stringOr(project.category, "Project");
  const status = stringOr(project.status, "Live");
  const repoName = stringOr(project.repoName, "");
  const website = validUrl(project.website);
  const supportUrl = validUrl(project.supportUrl);
  const privacyUrl = validUrl(project.privacyUrl);
  const appStoreUrl = validUrl(project.appStoreUrl);
  const repositoryUrl = validUrl(project.repositoryUrl);
  const previewImage = validUrl(project.previewImage);
  const previewImageAlt = stringOr(project.previewImageAlt, `${name} preview`);
  const topics = normalizeTextList(project.topics);
  const language = stringOr(project.language, "");
  const archived = Boolean(project.archived);
  const repoIndex = normalizeRepoIndex(project.repoIndex, {
    name: repoName,
    full_name: project.fullName || project.full_name,
    html_url: project.repositoryUrl,
    description: project.description,
    homepage: project.website,
    topics,
    language,
    archived,
    pushed_at: project.updatedAt,
    stargazers_count: project.stargazersCount ?? project.stars,
    license: project.license,
    default_branch: project.defaultBranch,
    open_issues_count: project.openIssuesCount,
    latest_release: project.latestRelease,
  });
  const version = stringOr(project.version, "");
  const launchedAt = stringOr(project.launchedAt || project.launchDate, "");
  const launchNotes = stringOr(project.launchNotes, defaultLaunchNotes(project));
  const latestRelease = normalizeLatestRelease(project.latestRelease || repoIndex.latest_release);
  const updatedAt = stringOr(project.updatedAt, "");
  const screenshots = normalizeScreenshots(project.screenshots, {
    name,
    previewImage,
    previewImageAlt,
  });
  const resolvedPreviewImage = previewImage || screenshots[0]?.src || "";
  const projectionContext = {
    generatedAt: context.generatedAt || context.orgIndexGeneratedAt,
    sample: context.sample,
  };
  const releaseProjection = createReleaseProjection(
    {
      name,
      category,
      status,
      website,
      supportUrl,
      privacyUrl,
      appStoreUrl,
      repositoryUrl,
      icon: validUrl(project.icon),
      previewImage: resolvedPreviewImage,
      screenshots,
      accent: validAccent(project.accent),
      repoName,
      fullName: stringOr(project.fullName || project.full_name, ""),
      manifestFound: Boolean(project.manifestFound),
      stargazersCount: numberOr(project.stargazersCount ?? project.stars, 0),
      forksCount: numberOr(project.forksCount ?? project.forks, 0),
      openIssuesCount: numberOr(project.openIssuesCount ?? repoIndex.open_issues_count, 0),
      latestRelease,
      updatedAt,
      language,
      archived,
      launchedAt,
      version,
      topics,
      projectedReleaseDate: stringOr(project.projectedReleaseDate || project.estimatedReleaseDate || project.targetReleaseDate, ""),
      progressPercent: project.progressPercent ?? project.progress ?? project.completionPercent,
      releaseProjectionNote: stringOr(project.releaseProjectionNote || project.progressNote, ""),
    },
    projectionContext,
  );
  const versionHighlights = normalizeTextList(project.versionHighlights, [
    `${status} ${category} project website`,
    project.manifestFound ? "Curated by site-manifest.json" : "Auto-discovered from public GitHub Pages",
    screenshots.length
      ? `${screenshots.length} gallery image${screenshots.length === 1 ? "" : "s"} available`
      : "Project preview available",
  ]);

  return {
    name,
    description: stringOr(project.description, ""),
    tagline: stringOr(project.tagline || project.description, "A public NinjaTomOnline project website."),
    category,
    status,
    website,
    supportUrl,
    privacyUrl,
    appStoreUrl,
    repositoryUrl,
    icon: validUrl(project.icon),
    previewImage: resolvedPreviewImage,
    previewImageAlt,
    screenshots,
    accent: validAccent(project.accent),
    featured: Boolean(project.featured),
    sortOrder: Number.isFinite(Number(project.sortOrder)) ? Number(project.sortOrder) : 1000,
    repoName,
    fullName: stringOr(project.fullName || project.full_name, ""),
    repoIndex,
    slug: categorySlug(repoName || name),
    manifestFound: Boolean(project.manifestFound),
    stargazersCount: numberOr(project.stargazersCount ?? project.stars, 0),
    forksCount: numberOr(project.forksCount ?? project.forks, 0),
    license: stringOr(project.license || repoIndex.license, ""),
    defaultBranch: stringOr(project.defaultBranch || repoIndex.default_branch, ""),
    openIssuesCount: numberOr(project.openIssuesCount ?? repoIndex.open_issues_count, 0),
    latestRelease,
    updatedAt,
    language,
    archived,
    launchedAt,
    version,
    launchNotes,
    versionHighlights,
    releaseProjection,
    topics,
    searchText: [
      name,
      project.tagline,
      project.description,
      launchNotes,
      version,
      versionHighlights.join(" "),
      category,
      status,
      language,
      archived ? "archived" : "",
      project.repoName,
      project.fullName,
      project.website,
      project.license,
      project.defaultBranch,
      latestRelease?.name,
      latestRelease?.tag_name,
      releaseProjection.label,
      releaseProjection.dateLabel,
      releaseProjection.badge,
      topics.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

function renderHeroShowcase(projects) {
  const selected = selectHeroProjects(projects);
  const positions = ["top", "middle", "side", "bottom"];
  const fragment = document.createDocumentFragment();
  elements.heroShowcase.querySelectorAll(".hero-product").forEach((node) => node.remove());

  for (const [index, project] of selected.entries()) {
    const card = document.createElement("a");
    card.className = `hero-product hero-product-${positions[index] || "side"}`;
    card.href = project.website || project.repositoryUrl || "#";
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.setAttribute("aria-label", `${project.name} project site`);
    card.style.setProperty("--accent", project.accent);
    card.style.setProperty("--float-delay", `${index * -1.4}s`);
    attachHeroMotion(card);

    const copy = document.createElement("span");
    copy.className = "hero-product-copy";

    const title = document.createElement("strong");
    title.textContent = project.name;

    const tagline = document.createElement("span");
    tagline.textContent = shortText(project.tagline, 74);

    copy.append(title, tagline);

    const media = document.createElement("span");
    media.className = "hero-product-media";
    media.appendChild(createDefaultPreview(project, true));
    const heroImage = heroShowcaseImage(project);
    if (heroImage && !visualTestMode) {
      const image = document.createElement("img");
      image.src = heroImage;
      image.alt = "";
      image.decoding = "async";
      image.addEventListener("error", () => {
        image.remove();
      });
      media.appendChild(image);
    }

    card.append(copy, media);
    fragment.appendChild(card);
  }

  elements.heroShowcase.appendChild(fragment);
}

function heroShowcaseImage(project) {
  const isSwiftTerm = project.slug === "swiftterm-site" || categorySlug(project.name) === "swiftterm";
  if (isSwiftTerm) {
    const productComposite = project.screenshots.find((screenshot) =>
      /swiftterm-hero-console\.png/i.test(screenshot.src),
    );
    if (productComposite?.src) return productComposite.src;

    const ipadWorkspace = project.screenshots.find((screenshot) =>
      /swiftterm-ipad-workspace\.png/i.test(screenshot.src),
    );
    if (ipadWorkspace?.src) return ipadWorkspace.src;

    const productScreenshot = project.screenshots.find((screenshot) =>
      screenshot.src && !/swiftterm-(social-preview|iphone-terminal|iphone-files)\.(png|svg)/i.test(screenshot.src),
    );
    if (productScreenshot?.src) return productScreenshot.src;
  }

  return project.previewImage;
}

function selectHeroProjects(projects) {
  const sorted = sortProjects([...projects], "studio");
  const withPreview = sorted.filter((project) => project.previewImage);
  const creative = sorted.find((project) => FILTERS["Creative / Custom3D"](project));
  const game = sorted.find((project) => FILTERS.Games(project));
  const picks = [sorted[0], withPreview[1], creative, game, sorted[1], withPreview[0]].filter(Boolean);
  const unique = [];

  for (const project of picks) {
    if (!unique.some((item) => item.name === project.name)) unique.push(project);
    if (unique.length === 4) break;
  }

  for (const project of sorted) {
    if (!unique.some((item) => item.name === project.name)) unique.push(project);
    if (unique.length === 4) break;
  }

  return unique;
}

function renderLatestUpdates(projects) {
  if (!elements.latestStrip) return;

  const latest = selectLatestUpdates(projects);
  if (!latest.length) {
    elements.latestStrip.hidden = true;
    elements.latestStrip.replaceChildren();
    return;
  }

  const header = document.createElement("div");
  header.className = "latest-strip-heading";

  const label = document.createElement("span");
  label.textContent = "Latest Updates";

  const summary = document.createElement("strong");
  summary.textContent = `${latest.length} fresh project signal${latest.length === 1 ? "" : "s"}`;
  header.append(label, summary);

  const track = document.createElement("div");
  track.className = "latest-strip-track";

  for (const project of latest) {
    const item = document.createElement("button");
    item.className = "latest-update";
    item.type = "button";
    item.dataset.projectSlug = project.slug;
    item.style.setProperty("--accent", project.accent);
    item.setAttribute("aria-label", `Open ${project.name} details`);

    const icon = createProjectIcon(project);
    icon.classList.add("latest-icon");

    const copy = document.createElement("span");
    copy.className = "latest-copy";

    const title = document.createElement("strong");
    title.textContent = project.name;

    const meta = document.createElement("span");
    meta.textContent = latestUpdateLabel(project);

    copy.append(title, meta);
    item.append(icon, copy);
    track.appendChild(item);
  }

  elements.latestStrip.replaceChildren(header, track);
  elements.latestStrip.hidden = false;
}

function renderStudioNotes(projects) {
  if (!elements.studioNotes || !elements.studioNotesGrid) return;

  const notes = selectStudioNotes(projects);
  if (!notes.length) {
    elements.studioNotes.hidden = true;
    elements.studioNotesGrid.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const project of notes) {
    const note = document.createElement("button");
    note.className = "studio-note";
    note.type = "button";
    note.dataset.projectSlug = project.slug;
    note.style.setProperty("--accent", project.accent);
    note.setAttribute("aria-label", `Open ${project.name} details`);

    const meta = document.createElement("span");
    meta.className = "studio-note-meta";
    meta.append(createPlatformIcon(project), document.createTextNode(`${project.category} / ${project.status}`));

    const title = document.createElement("strong");
    title.textContent = project.name;

    const copy = document.createElement("p");
    copy.textContent = shortText(project.launchNotes || project.tagline, 118);

    note.append(meta, title, copy);
    fragment.appendChild(note);
  }

  elements.studioNotesGrid.replaceChildren(fragment);
  elements.studioNotes.hidden = false;
}

function selectStudioNotes(projects) {
  return sortProjects([...projects], "studio")
    .filter((project) => project.launchNotes || project.tagline)
    .slice(0, 3);
}

function selectLatestUpdates(projects) {
  return [...projects]
    .filter((project) => project.updatedAt || project.launchedAt)
    .sort((a, b) => {
      const latestDelta = latestProjectDateValue(b) - latestProjectDateValue(a);
      if (latestDelta !== 0) return latestDelta;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);
}

function latestProjectDateValue(project) {
  return Math.max(dateValue(project.updatedAt), dateValue(project.launchedAt));
}

function latestUpdateLabel(project) {
  if (isRecentlyLaunched(project)) return `Launched ${formatDate(project.launchedAt) || "recently"}`;
  return formatRelative(project.updatedAt) || formatDate(project.updatedAt) || "Recently refreshed";
}

function renderProjects() {
  const filteredProjects = getFilteredProjects();
  elements.grid.replaceChildren();

  if (!state.projects.length) {
    elements.resultCount.textContent = "0 projects";
    showState("empty", "No project websites found yet.");
    updateLoadMore(0);
    return;
  }

  if (!filteredProjects.length) {
    elements.resultCount.textContent = `0 of ${state.projects.length} projects`;
    showState("empty", "No projects match this search.");
    updateLoadMore(0);
    return;
  }

  hideState();
  const visibleProjects = filteredProjects.slice(0, state.visibleCount);
  const fragment = document.createDocumentFragment();
  for (const [index, project] of visibleProjects.entries()) {
    fragment.appendChild(createProjectCard(project, index));
  }

  elements.grid.appendChild(fragment);
  initCardReveals();
  elements.resultCount.textContent =
    filteredProjects.length === state.projects.length
      ? `${state.projects.length} projects`
      : `${filteredProjects.length} of ${state.projects.length} projects`;
  updateLoadMore(filteredProjects.length);
  applyInitialHashScroll();
  applyVisualScrollTarget();
}

function getFilteredProjects() {
  const filterFn = FILTERS[state.filter] || FILTERS.All;
  return sortProjects(
    state.projects.filter((project) => {
      const matchesFilter = filterFn(project);
      const matchesQuery = !state.query || project.searchText.includes(state.query);
      return matchesFilter && matchesQuery;
    }),
    state.sort,
  );
}

function setActiveFilter(filter, options = {}) {
  const nextFilter = FILTERS[filter] ? filter : "All";
  const shouldRender = options.forceRender || state.filter !== nextFilter;
  state.filter = nextFilter;
  state.visibleCount = INITIAL_VISIBLE_COUNT;
  updateFilterTabs();

  if (shouldRender) renderProjects();

  if (options.updateHash) {
    const nextHash = filterHash(nextFilter);
    if (window.location.hash !== nextHash) {
      history.pushState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  }
}

function updateFilterTabs() {
  if (!elements.filterTabs) return;

  for (const tab of elements.filterTabs.querySelectorAll(".filter-tab")) {
    const isActive = tab.dataset.filter === state.filter;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-pressed", String(isActive));
  }
}

function sortProjects(projects, mode = "studio") {
  return projects.sort((a, b) => {
    if (mode === "updated") {
      const updatedDelta = dateValue(b.updatedAt) - dateValue(a.updatedAt);
      if (updatedDelta !== 0) return updatedDelta;
    }

    if (mode === "name") {
      return a.name.localeCompare(b.name);
    }

    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

function createProjectCard(project, index = 0) {
  const card = document.createElement("article");
  card.className = "project-card";
  card.style.setProperty("--accent", project.accent);
  card.style.setProperty("--reveal-delay", `${Math.min(index, 8) * 35}ms`);
  attachTilt(card);
  enableProjectCardLink(card, project.website || project.repositoryUrl);

  const preview = document.createElement("a");
  preview.className = "project-preview";
  preview.href = project.website || project.repositoryUrl || "#";
  preview.target = "_blank";
  preview.rel = "noopener noreferrer";
  const cardMedia = selectCardPreview(project);

  if (cardMedia.src && !visualTestMode) {
    preview.appendChild(createDefaultPreview(project));
    if (isVectorPreview(cardMedia.src)) preview.classList.add("vector-preview");

    const image = document.createElement("img");
    image.src = cardMedia.src;
    image.alt = cardMedia.alt || project.previewImageAlt;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      preview.classList.add("fallback-preview");
      image.remove();
    });
    preview.appendChild(image);
  } else {
    preview.classList.add("fallback-preview");
    preview.appendChild(createDefaultPreview(project));
  }
  preview.appendChild(createStatusBadge(project.status));
  preview.appendChild(createReleaseBadge(project));
  if (isRecentlyUpdated(project)) {
    preview.appendChild(createFreshBadge());
  }
  if (project.screenshots.length > 1) {
    preview.appendChild(createGalleryBadge(project.screenshots.length));
  }

  const icon = createProjectIcon(project);

  const body = document.createElement("div");
  body.className = "card-body";

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";

  const title = document.createElement("h3");
  title.textContent = project.name;

  const category = createTag(project.category, "category-tag");
  titleRow.append(title, category);

  const tagline = document.createElement("p");
  tagline.className = "card-tagline";
  tagline.textContent = project.tagline;

  const releaseMeta = createReleaseMeta(project);
  const repoMeta = createRepoMeta(project);

  const links = document.createElement("div");
  links.className = "card-links";
  links.appendChild(createDetailButton(project, true));
  appendLink(links, "App Store", project.appStoreUrl);
  appendLink(links, "Support", project.supportUrl);
  appendLink(links, "Privacy", project.privacyUrl);
  appendLink(links, "Repo", project.repositoryUrl);

  const footer = document.createElement("div");
  footer.className = "card-footer";
  appendFooterLink(footer, "Live Site", project.website, "globe");
  appendFooterMetric(footer, project.stargazersCount, "star", "stars");
  appendFooterMetric(footer, project.forksCount, "fork", "forks");
  appendFooterMeta(footer, formatRelative(project.updatedAt), "clock");

  body.append(titleRow, tagline);
  if (releaseMeta) body.appendChild(releaseMeta);
  if (repoMeta) body.appendChild(repoMeta);
  if (links.children.length) body.appendChild(links);
  body.appendChild(footer);
  card.append(preview, icon, body);
  return card;
}

function enableProjectCardLink(card, destination) {
  if (!destination) return;

  card.classList.add("project-card-clickable");
  card.addEventListener("click", (event) => {
    if (shouldIgnoreProjectCardClick(event)) return;
    window.open(destination, "_blank", "noopener,noreferrer");
  });
}

function shouldIgnoreProjectCardClick(event) {
  if (event.defaultPrevented) return true;
  if (typeof event.button === "number" && event.button !== 0) return true;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;

  const target = event.target;
  return target instanceof Element && Boolean(
    target.closest("a, button, input, select, textarea, summary, [role='button'], [role='link']"),
  );
}

function decorateFilterTabs() {
  if (!elements.filterTabs) return;

  for (const tab of elements.filterTabs.querySelectorAll(".filter-tab")) {
    if (tab.querySelector(".platform-icon")) continue;
    const label = tab.dataset.filter || tab.textContent;
    tab.prepend(createPlatformIcon({ category: label, name: label }));
  }
}

function selectCardPreview(project) {
  const candidates = [
    { src: project.previewImage, alt: project.previewImageAlt },
    ...project.screenshots.map((screenshot) => ({
      src: screenshot.src,
      alt: screenshot.alt || screenshot.caption || project.previewImageAlt,
    })),
  ].filter((candidate) => candidate.src);

  return (
    candidates.find((candidate) => isStrongScreenshot(candidate.src)) ||
    candidates.find((candidate) => !isVectorPreview(candidate.src)) ||
    candidates[0] ||
    { src: "", alt: "" }
  );
}

function isStrongScreenshot(src) {
  const value = String(src || "").toLowerCase();
  if (!value || isVectorPreview(value)) return false;
  if (/(social-card|social-preview|social\.png|preview\.png|favicon|app-icon|icon-)/.test(value)) return false;
  return /(screenshot|screenshots|iphone|ipad|dashboard|gameplay|workspace|terminal|drive|today|home|library|panel|onboarding|level|calendar|map)/.test(value);
}

function isVectorPreview(src) {
  return /\.svg(?:[?#].*)?$/i.test(String(src || ""));
}

function createProjectIcon(project) {
  const icon = document.createElement("span");
  icon.className = "project-icon";
  icon.style.setProperty("--accent", project.accent);

  if (project.icon && !visualTestMode) {
    const image = document.createElement("img");
    image.src = project.icon;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      icon.textContent = initials(project.name);
      icon.classList.add("initials-icon");
    });
    icon.appendChild(image);
  } else {
    icon.textContent = initials(project.name);
    icon.classList.add("initials-icon");
  }

  return icon;
}

function createDefaultPreview(project, compact = false) {
  const preview = document.createElement("span");
  preview.className = `preview-art preview-${categorySlug(project.category)}${compact ? " compact" : ""}`;
  preview.style.setProperty("--accent", project.accent);

  const chrome = document.createElement("span");
  chrome.className = "preview-chrome";
  chrome.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));

  const scene = document.createElement("span");
  scene.className = "preview-scene";

  const title = document.createElement("strong");
  title.textContent = project.name;

  const lines = document.createElement("span");
  lines.className = "preview-lines";
  for (let index = 0; index < 4; index += 1) {
    lines.appendChild(document.createElement("span"));
  }

  const accentShape = document.createElement("span");
  accentShape.className = "preview-accent";

  scene.append(title, lines, accentShape);
  preview.append(chrome, scene);
  return preview;
}

function createTag(label, className = "") {
  const tag = document.createElement("span");
  tag.className = `tag ${className} ${categorySlug(label)}`.trim();
  if (className.includes("category-tag")) {
    tag.append(createPlatformIcon({ category: label }), document.createTextNode(label));
  } else {
    tag.textContent = label;
  }
  return tag;
}

function createStatusBadge(label) {
  const status = document.createElement("span");
  status.className = `status-badge ${categorySlug(label)}`;
  status.textContent = label;
  return status;
}

function createReleaseBadge(project) {
  const projection = project.releaseProjection;
  const badge = document.createElement("span");
  badge.className = `release-badge ${projection.kind}`;
  badge.textContent = projection.badge;
  badge.title = projection.dateLabel;
  return badge;
}

function createReleaseMeta(project) {
  const projection = project.releaseProjection;
  if (!projection) return null;

  const meta = document.createElement("div");
  meta.className = `release-meta ${projection.kind}`;
  meta.appendChild(createIcon(projection.kind === "app-store" ? "phone" : "calendar"));

  const copy = document.createElement("span");
  const label = document.createElement("strong");
  label.textContent = projection.label;
  const detail = document.createElement("span");
  detail.textContent = projection.kind === "projected"
    ? `${projection.dateLabel} / ${projection.progress}% progress`
    : projection.dateLabel;

  copy.append(label, detail);
  meta.appendChild(copy);
  return meta;
}

function createFreshBadge() {
  const badge = document.createElement("span");
  badge.className = "fresh-badge";
  badge.textContent = "Recently updated";
  return badge;
}

function createGalleryBadge(count) {
  const badge = document.createElement("span");
  badge.className = "gallery-badge";
  badge.textContent = `${count} shots`;
  return badge;
}

function createRepoMeta(project) {
  const items = [];
  if (project.language) items.push({ label: project.language, tone: "language" });
  for (const topic of project.topics.slice(0, 2)) {
    items.push({ label: topic, tone: "topic" });
  }
  if (project.archived) items.push({ label: "Archived", tone: "archived" });
  if (!items.length) return null;

  const meta = document.createElement("div");
  meta.className = "repo-meta";
  meta.setAttribute("aria-label", `${project.name} repository metadata`);

  for (const item of items.slice(0, 4)) {
    const chip = document.createElement("span");
    chip.className = `repo-chip ${item.tone}`;
    chip.textContent = item.label;
    meta.appendChild(chip);
  }

  return meta;
}

function createDetailButton(project, compact = false) {
  const button = document.createElement("button");
  button.className = compact ? "card-link detail-link" : "card-link detail-link featured-detail";
  button.type = "button";
  button.dataset.projectSlug = project.slug;
  button.textContent = "Details";
  return button;
}

function appendLink(container, label, url) {
  if (!url) return;

  const link = document.createElement("a");
  link.className = "card-link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  container.appendChild(link);
}

function appendInlineLink(container, label, url) {
  if (!url) return;

  const link = document.createElement("a");
  link.className = "card-link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  container.appendChild(link);
}

function appendFooterLink(container, label, url, iconName) {
  if (!url) return;

  const link = document.createElement("a");
  link.className = "footer-action";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.append(createIcon(iconName), document.createTextNode(label));
  container.appendChild(link);
}

function appendFooterMeta(container, label, iconName) {
  if (!label) return;
  const item = document.createElement("span");
  item.className = "footer-action muted";
  item.append(createIcon(iconName), document.createTextNode(label));
  container.appendChild(item);
}

function appendFooterMetric(container, value, iconName, label) {
  if (!Number.isFinite(value)) return;
  const item = document.createElement("span");
  item.className = "footer-action muted repo-metric";
  item.title = `${value} ${label}`;
  item.append(createIcon(iconName), document.createTextNode(formatCompactNumber(value)));
  container.appendChild(item);
}

function createIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 24 24");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", iconPath(name));
  svg.appendChild(path);
  return svg;
}

function createPlatformIcon(project) {
  const svg = createIcon(platformIconName(project));
  svg.classList.add("platform-icon");
  return svg;
}

function platformIconName(project) {
  const value = `${project.category || ""} ${project.name || ""} ${project.repoName || ""}`.toLowerCase();
  if (/\ball\b|show every/.test(value)) return "globe";
  if (/recent|launch|updated/.test(value)) return "clock";
  if (/(ios|iphone|ipad|watchos)/.test(value)) return "phone";
  if (/(game|arcade|rush|detective|copter)/.test(value)) return "gamepad";
  if (/(creative|custom3d|3d|art|dream|shramana)/.test(value)) return "cube";
  if (/(web|site|website|browser)/.test(value)) return "browser";
  return "tool";
}

function iconPath(name) {
  switch (name) {
    case "clock":
      return "M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";
    case "calendar":
      return "M7 3.5v3M17 3.5v3M4.5 8.5h15M6 5.5h12a1.5 1.5 0 0 1 1.5 1.5v11.5A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 6 5.5Zm2.5 7h3m3 0h1";
    case "star":
      return "m12 3.5 2.6 5.2 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8L12 3.5Z";
    case "fork":
      return "M7 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 9v2a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V9M12 15v4";
    case "phone":
      return "M8 3.5h8a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5Zm2.8 14h2.4";
    case "gamepad":
      return "M7.5 9.5h9a4.5 4.5 0 0 1 4.2 6.1l-.7 1.8a2 2 0 0 1-3.2.7l-1.6-1.5H8.8l-1.6 1.5a2 2 0 0 1-3.2-.7l-.7-1.8a4.5 4.5 0 0 1 4.2-6.1ZM8 13h3m-1.5-1.5v3M16 12.5h.1M18 14.5h.1";
    case "cube":
      return "m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5m-8-4.5 8 4.5m0 9v-9";
    case "browser":
      return "M4 5.5h16v13H4v-13Zm0 4h16M7 7.5h.1M10 7.5h.1M13 7.5h.1";
    case "tool":
      return "M14.7 5.3a4 4 0 0 0 4.9 4.9l-8.8 8.8a2.2 2.2 0 0 1-3.1-3.1l8.8-8.8Z";
    case "globe":
    default:
      return "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2-2.2 3-5.2 3-9s-1-6.8-3-9m0 18c-2-2.2-3-5.2-3-9s1-6.8 3-9M3.6 9h16.8M3.6 15h16.8";
  }
}

function showState(type, message) {
  elements.statePanel.classList.add("visible");
  elements.statePanel.replaceChildren();

  if (type === "loading") {
    const loader = document.createElement("div");
    loader.className = "loader";
    loader.setAttribute("aria-hidden", "true");
    elements.statePanel.appendChild(loader);
  }

  const text = document.createElement("span");
  text.textContent = message;
  elements.statePanel.appendChild(text);
}

function hideState() {
  elements.statePanel.classList.remove("visible");
}

function updateLoadMore(total) {
  const canCollapse = state.visibleCount >= total && total > INITIAL_VISIBLE_COUNT;
  const canExpand = total > state.visibleCount;
  elements.loadMoreWrap.hidden = !(canCollapse || canExpand);
  elements.loadMore.querySelector("span").textContent = canCollapse
    ? "Show fewer projects"
    : "Load more projects";
  elements.loadMore.classList.toggle("expanded", canCollapse);
}

function buildCommandItems() {
  const filterItems = Object.keys(FILTERS).map((filter) => ({
    type: "Category",
    label: filter,
    meta: filter === "All" ? "Show every project" : `Jump to ${filter}`,
    keywords: `${filter} category filter projects`,
    icon: createPlatformIcon({ category: filter }),
    run: () => {
      setActiveFilter(filter, { updateHash: true, forceRender: true });
      closeCommandPalette();
      scrollProjectsIntoView();
    },
  }));

  const projectItems = state.projects.map((project) => ({
    type: "Details",
    label: project.name,
    meta: `${project.category} / ${project.status}`,
    keywords: project.searchText,
    icon: createPlatformIcon(project),
    run: () => {
      const focusReturn = lastCommandFocusedElement;
      closeCommandPalette({ restoreFocus: false });
      openProjectBySlug(project.slug, { updateHash: true });
      if (focusReturn && document.contains(focusReturn)) {
        lastFocusedElement = focusReturn;
      }
    },
  }));

  const launchItems = state.projects
    .filter((project) => project.website || project.repositoryUrl)
    .map((project) => ({
      type: "Open Site",
      label: `Launch ${project.name}`,
      meta: project.website || project.repositoryUrl,
      keywords: `${project.name} ${project.category} launch open site website ${project.searchText}`,
      icon: createIcon("globe"),
      run: () => {
        closeCommandPalette();
        window.open(project.website || project.repositoryUrl, "_blank", "noopener,noreferrer");
      },
    }));

  commandItems = [...filterItems, ...projectItems, ...launchItems];
  renderCommandResults();
}

function openCommandPalette() {
  if (!elements.commandPalette || !elements.commandInput || !elements.commandResults) return;
  if (!commandItems.length) buildCommandItems();

  lastCommandFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeCommandIndex = 0;
  elements.commandInput.value = "";
  renderCommandResults();
  elements.commandPalette.hidden = false;
  document.body.classList.add("command-open");
  requestAnimationFrame(() => {
    elements.commandPalette.classList.add("open");
    elements.commandInput.focus({ preventScroll: true });
  });
}

function closeCommandPalette(options = {}) {
  if (!elements.commandPalette || elements.commandPalette.hidden) return;

  elements.commandPalette.classList.remove("open");
  document.body.classList.remove("command-open");
  window.setTimeout(
    () => {
      elements.commandPalette.hidden = true;
    },
    visualTestMode ? 0 : 160,
  );

  if (options.restoreFocus !== false && lastCommandFocusedElement && document.contains(lastCommandFocusedElement)) {
    lastCommandFocusedElement.focus({ preventScroll: true });
  }
  lastCommandFocusedElement = null;
}

function handleCommandKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeCommandPalette();
    return;
  }

  const results = getVisibleCommandButtons();
  if (!results.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeCommandIndex = (activeCommandIndex + 1) % results.length;
    updateActiveCommandResult();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    activeCommandIndex = (activeCommandIndex - 1 + results.length) % results.length;
    updateActiveCommandResult();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    results[activeCommandIndex]?.click();
  }
}

function renderCommandResults() {
  if (!elements.commandResults) return;

  const query = elements.commandInput?.value.trim().toLowerCase() || "";
  const matches = commandItems
    .filter((item) => commandMatches(item, query))
    .slice(0, 10);

  if (activeCommandIndex >= matches.length) activeCommandIndex = 0;

  const fragment = document.createDocumentFragment();
  for (const [index, item] of matches.entries()) {
    const button = document.createElement("button");
    button.className = "command-result";
    button.type = "button";
    button.setAttribute("role", "option");
    button.dataset.commandIndex = String(index);
    button.setAttribute("aria-selected", String(index === activeCommandIndex));

    const iconWrap = document.createElement("span");
    iconWrap.className = "command-result-icon";
    iconWrap.appendChild(item.icon.cloneNode(true));

    const copy = document.createElement("span");
    copy.className = "command-result-copy";

    const label = document.createElement("strong");
    label.textContent = item.label;

    const meta = document.createElement("span");
    meta.textContent = `${item.type} / ${item.meta}`;

    copy.append(label, meta);
    button.append(iconWrap, copy);
    button.addEventListener("click", item.run);
    button.addEventListener("mouseenter", () => {
      activeCommandIndex = index;
      updateActiveCommandResult();
    });
    fragment.appendChild(button);
  }

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "command-empty";
    empty.textContent = "No matching projects or shortcuts.";
    fragment.appendChild(empty);
  }

  elements.commandResults.replaceChildren(fragment);
  updateActiveCommandResult();
}

function commandMatches(item, query) {
  if (!query) return true;
  return `${item.label} ${item.meta} ${item.type} ${item.keywords}`.toLowerCase().includes(query);
}

function getVisibleCommandButtons() {
  return [...(elements.commandResults?.querySelectorAll(".command-result") || [])];
}

function updateActiveCommandResult() {
  const results = getVisibleCommandButtons();
  for (const [index, button] of results.entries()) {
    const isActive = index === activeCommandIndex;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    if (isActive && elements.commandPalette && !elements.commandPalette.hidden) {
      button.scrollIntoView({ block: "nearest" });
    }
  }
}

function applyHashRoute() {
  const slug = projectSlugFromHash();
  if (slug) {
    openProjectBySlug(slug);
    return;
  }

  if (elements.drawer && !elements.drawer.hidden) {
    closeProjectDrawer({ updateHash: false });
  }

  const filter = filterFromHash();
  if (filter) {
    setActiveFilter(filter, { forceRender: true });
    scrollProjectsIntoView();
  }
}

function openProjectBySlug(slug, options = {}) {
  if (!slug || !elements.drawer || !elements.drawerContent) return;

  const project = state.projects.find(
    (item) => item.slug === slug || item.repoName === slug || categorySlug(item.name) === slug,
  );
  if (!project) return;

  activeProject = project;
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  renderProjectDrawer(project);
  elements.drawer.hidden = false;
  document.body.classList.add("drawer-open");
  requestAnimationFrame(() => {
    elements.drawer.classList.add("open");
    elements.drawer.querySelector(".drawer-close")?.focus({ preventScroll: true });
  });

  if (options.updateHash && projectSlugFromHash() !== project.slug) {
    history.pushState(null, "", `#project/${encodeURIComponent(project.slug)}`);
  }
}

function closeProjectDrawer(options = {}) {
  if (!elements.drawer || elements.drawer.hidden) return;

  const updateHash = options.updateHash !== false;
  elements.drawer.classList.remove("open");
  document.body.classList.remove("drawer-open");
  activeProject = null;

  window.setTimeout(
    () => {
      if (activeProject) return;
      elements.drawer.hidden = true;
      elements.drawerContent?.replaceChildren();
    },
    visualTestMode ? 0 : 170,
  );

  if (updateHash && projectSlugFromHash()) {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  if (lastFocusedElement && document.contains(lastFocusedElement)) {
    lastFocusedElement.focus({ preventScroll: true });
  }
  lastFocusedElement = null;
}

function renderProjectDrawer(project) {
  const content = elements.drawerContent;
  content.replaceChildren();

  const header = document.createElement("div");
  header.className = "drawer-header";

  const media = document.createElement("div");
  media.className = "drawer-preview";
  media.style.setProperty("--accent", project.accent);
  media.appendChild(createDefaultPreview(project));
  if (project.previewImage && !visualTestMode) {
    const image = document.createElement("img");
    image.src = project.previewImage;
    image.alt = project.previewImageAlt;
    image.loading = "eager";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove());
    media.appendChild(image);
  }

  const titleBlock = document.createElement("div");
  titleBlock.className = "drawer-title-block";

  const icon = createProjectIcon(project);
  icon.classList.add("drawer-icon");

  const titleCopy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "drawer-eyebrow";
  eyebrow.textContent = project.manifestFound ? "Manifest-powered project" : "Auto-discovered project";

  const title = document.createElement("h2");
  title.id = "drawer-title";
  title.textContent = project.name;

  const tagline = document.createElement("p");
  tagline.id = "drawer-tagline";
  tagline.textContent = project.tagline;

  titleCopy.append(eyebrow, title, tagline);
  titleBlock.append(icon, titleCopy);
  header.append(media, titleBlock);

  const tags = document.createElement("div");
  tags.className = "drawer-tags";
  tags.append(createTag(project.category, "category-tag"), createStatusBadge(project.status));
  if (isRecentlyUpdated(project)) tags.appendChild(createFreshBadge());
  if (project.featured) {
    const featured = document.createElement("span");
    featured.className = "tag featured-tag";
    featured.textContent = "Featured";
    tags.appendChild(featured);
  }
  if (isRecentlyLaunched(project)) {
    const launched = document.createElement("span");
    launched.className = "tag launch-tag";
    launched.textContent = "Recently launched";
    tags.appendChild(launched);
  }
  if (project.archived) {
    const archived = document.createElement("span");
    archived.className = "tag archived-tag";
    archived.textContent = "Archived";
    tags.appendChild(archived);
  }

  const actions = document.createElement("div");
  actions.className = "drawer-actions";
  appendDrawerLink(actions, "Open Live Site", project.website, true);
  appendDrawerLink(actions, "App Store", project.appStoreUrl);
  appendDrawerLink(actions, "Support", project.supportUrl);
  appendDrawerLink(actions, "Privacy", project.privacyUrl);
  appendDrawerLink(actions, "GitHub Repo", project.repositoryUrl);
  appendDrawerLink(actions, "Share Page", projectShareUrl(project));

  const shareButton = document.createElement("button");
  shareButton.className = "button button-secondary drawer-share";
  shareButton.type = "button";
  shareButton.textContent = "Copy Project Link";
  shareButton.addEventListener("click", async () => {
    await copyProjectLink(project);
    shareButton.textContent = "Copied";
    window.setTimeout(() => {
      shareButton.textContent = "Copy Project Link";
    }, 1400);
  });
  actions.appendChild(shareButton);

  const facts = document.createElement("dl");
  facts.className = "drawer-facts";
  appendFact(facts, "Category", project.category);
  appendFact(facts, "Status", project.status);
  appendFact(facts, "Launched", formatDate(project.launchedAt));
  appendFact(facts, "Version", project.version);
  appendFact(facts, "Updated", formatDate(project.updatedAt) || formatRelative(project.updatedAt));
  appendFact(facts, "Repo", project.repoName);
  appendFact(facts, "Full Name", project.fullName);
  appendFact(facts, "Language", project.language);
  appendFact(facts, "Archived", project.archived ? "Yes" : "");
  appendFact(facts, "License", project.license);
  appendFact(facts, "Default Branch", project.defaultBranch);
  appendFact(facts, "Open Issues", project.openIssuesCount ? formatCompactNumber(project.openIssuesCount) : "");
  appendFact(facts, "Latest Release", project.latestRelease?.tag_name || project.latestRelease?.name || "");
  appendFact(facts, "Store Status", project.releaseProjection.label);
  appendFact(facts, "Projected Release", project.releaseProjection.kind === "projected" ? formatDate(project.releaseProjection.date) : "");
  appendFact(facts, "Progress", project.releaseProjection.progress ? `${project.releaseProjection.progress}%` : "");
  appendFact(facts, "Stars", formatCompactNumber(project.stargazersCount));
  appendFact(facts, "Forks", formatCompactNumber(project.forksCount));
  appendFact(facts, "Data", project.manifestFound ? "site-manifest.json" : "Inferred from GitHub Pages");

  const topicWrap = document.createElement("div");
  topicWrap.className = "drawer-topics";
  for (const topic of project.topics.slice(0, 8)) {
    const pill = document.createElement("span");
    pill.textContent = topic;
    topicWrap.appendChild(pill);
  }

  const snapshot = createDrawerSnapshot(project);
  const releaseForecast = createReleaseForecast(project);
  const gallery = createScreenshotGallery(project);
  const launchNotes = createLaunchNotes(project);
  const repoIndex = createRepoIndexSection(project);

  content.append(header, tags, actions);
  if (releaseForecast) content.appendChild(releaseForecast);
  if (snapshot) content.appendChild(snapshot);
  if (repoIndex) content.appendChild(repoIndex);
  if (launchNotes) content.appendChild(launchNotes);
  if (gallery) content.appendChild(gallery);
  content.appendChild(facts);
  if (topicWrap.children.length) content.appendChild(topicWrap);
}

function createReleaseForecast(project) {
  const projection = project.releaseProjection;
  if (!projection) return null;

  const section = document.createElement("section");
  section.className = `drawer-release ${projection.kind}`;
  section.setAttribute("aria-label", `${project.name} App Store and release projection`);

  const header = document.createElement("div");
  header.className = "drawer-release-heading";

  const title = document.createElement("h3");
  title.textContent = projection.kind === "app-store"
    ? "App Store Status"
    : projection.target === "App Store"
      ? "App Store Projection"
      : "Release Projection";

  const meta = document.createElement("span");
  meta.textContent = projection.dateLabel;
  header.append(title, meta);

  const copy = document.createElement("p");
  copy.textContent = projection.note;

  const progress = document.createElement("div");
  progress.className = "release-progress";
  progress.setAttribute("aria-label", `${projection.progress}% project progress`);
  progress.style.setProperty("--progress", `${projection.progress}%`);

  const progressLabel = document.createElement("span");
  progressLabel.textContent = `${projection.progress}% progress`;

  const progressBar = document.createElement("span");
  progressBar.setAttribute("aria-hidden", "true");
  progress.append(progressLabel, progressBar);

  const signals = document.createElement("ul");
  for (const signal of projection.signals.slice(0, 5)) {
    const item = document.createElement("li");
    item.textContent = signal.label;
    signals.appendChild(item);
  }

  section.append(header, copy, progress);
  if (signals.children.length) section.appendChild(signals);
  return section;
}

function createDrawerSnapshot(project) {
  const galleryCount = project.screenshots.length || (project.previewImage ? 1 : 0);
  const items = [
    ["Launch", formatDate(project.launchedAt) || "Indexed"],
    ["Updated", formatDate(project.updatedAt) || formatRelative(project.updatedAt) || "Auto-refresh"],
    ["Gallery", galleryCount ? `${galleryCount} image${galleryCount === 1 ? "" : "s"}` : "Pending"],
    ["Source", project.manifestFound ? "Manifest" : "GitHub scan"],
  ];

  const section = document.createElement("section");
  section.className = "drawer-snapshot";
  section.setAttribute("aria-label", `${project.name} project snapshot`);

  for (const [label, value] of items) {
    const card = document.createElement("div");
    card.className = "drawer-snapshot-card";

    const term = document.createElement("span");
    term.textContent = label;

    const detail = document.createElement("strong");
    detail.textContent = value;

    card.append(term, detail);
    section.appendChild(card);
  }

  return section;
}

function createLaunchNotes(project) {
  if (!project.launchNotes && !project.versionHighlights.length && !project.version && !project.launchedAt) return null;

  const section = document.createElement("section");
  section.className = "drawer-launch";
  section.setAttribute("aria-label", `${project.name} launch notes`);

  const header = document.createElement("div");
  header.className = "drawer-launch-heading";

  const title = document.createElement("h3");
  title.textContent = "Launch Notes";

  const meta = document.createElement("span");
  const metaItems = [project.version, formatDate(project.launchedAt)].filter(Boolean);
  meta.textContent = metaItems.join(" / ") || "Current release";
  header.append(title, meta);

  const body = document.createElement("p");
  body.textContent = project.launchNotes;

  const list = document.createElement("ul");
  for (const highlight of project.versionHighlights.slice(0, 5)) {
    const item = document.createElement("li");
    item.textContent = highlight;
    list.appendChild(item);
  }

  section.append(header);
  if (project.launchNotes) section.appendChild(body);
  if (list.children.length) section.appendChild(list);
  return section;
}

function createRepoIndexSection(project) {
  const repo = project.repoIndex;
  if (!repo || !(repo.full_name || repo.html_url || repo.homepage || repo.language || repo.topics.length)) return null;

  const section = document.createElement("section");
  section.className = "drawer-repo-index";
  section.setAttribute("aria-label", `${project.name} GitHub repository index metadata`);

  const header = document.createElement("div");
  header.className = "drawer-repo-index-heading";

  const title = document.createElement("h3");
  title.textContent = "Repo Index";

  const source = document.createElement("span");
  source.textContent = "data/projects.json";
  header.append(title, source);

  const grid = document.createElement("dl");
  grid.className = "repo-index-grid";
  appendRepoIndexFact(grid, "Full name", repo.full_name);
  appendRepoIndexFact(grid, "Language", repo.language);
  appendRepoIndexFact(grid, "License", repo.license);
  appendRepoIndexFact(grid, "Branch", repo.default_branch);
  appendRepoIndexFact(grid, "Pushed", formatDate(repo.pushed_at) || formatRelative(repo.pushed_at));
  appendRepoIndexFact(grid, "Stars", formatCompactNumber(repo.stargazers_count));
  appendRepoIndexFact(grid, "Open issues", formatCompactNumber(repo.open_issues_count));
  appendRepoIndexFact(grid, "Latest release", repo.latest_release?.tag_name || repo.latest_release?.name);
  appendRepoIndexFact(grid, "Archived", repo.archived ? "Yes" : "No");

  const links = document.createElement("div");
  links.className = "repo-index-links";
  appendRepoIndexLink(links, "GitHub", repo.html_url);
  appendRepoIndexLink(links, "Homepage", repo.homepage);
  appendRepoIndexLink(links, "Latest Release", repo.latest_release?.html_url);

  const description = document.createElement("p");
  description.className = "repo-index-description";
  description.textContent = repo.description || "No GitHub repo description set yet.";

  const topics = document.createElement("div");
  topics.className = "repo-index-topics";
  for (const topic of repo.topics.slice(0, 10)) {
    const pill = document.createElement("span");
    pill.textContent = topic;
    topics.appendChild(pill);
  }

  section.append(header, description, grid);
  if (links.children.length) section.appendChild(links);
  if (topics.children.length) section.appendChild(topics);
  return section;
}

function appendRepoIndexFact(container, label, value) {
  if (!value && value !== 0) return;

  const item = document.createElement("div");
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  item.append(term, description);
  container.appendChild(item);
}

function appendRepoIndexLink(container, label, url) {
  if (!url) return;

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  container.appendChild(link);
}

function createScreenshotGallery(project) {
  const screenshots = Array.isArray(project.screenshots) ? project.screenshots : [];
  if (!screenshots.length) return null;

  const section = document.createElement("section");
  section.className = "drawer-gallery";
  section.setAttribute("aria-label", `${project.name} screenshots`);

  const heading = document.createElement("div");
  heading.className = "drawer-gallery-heading";

  const title = document.createElement("h3");
  title.textContent = "Screenshots";

  const count = document.createElement("span");
  count.textContent = `${screenshots.length} image${screenshots.length === 1 ? "" : "s"}`;
  heading.append(title, count);

  const featured = createScreenshotFigure(screenshots[0], project, 0, true);

  const track = document.createElement("div");
  track.className = "drawer-gallery-track";

  for (const [index, screenshot] of screenshots.slice(1).entries()) {
    const figure = createScreenshotFigure(screenshot, project, index + 1);
    track.appendChild(figure);
  }

  section.append(heading, featured);
  if (track.children.length) section.appendChild(track);
  return section;
}

function createScreenshotFigure(screenshot, project, index, featured = false) {
  const figure = document.createElement("figure");
  figure.className = featured ? "drawer-shot drawer-shot-featured" : "drawer-shot";

  const link = document.createElement("a");
  link.href = screenshot.src || project.website || project.repositoryUrl || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `Open ${screenshot.alt || project.name} screenshot`);

  if (screenshot.src && !visualTestMode) {
    const image = document.createElement("img");
    image.src = screenshot.src;
    image.alt = screenshot.alt || `${project.name} screenshot`;
    image.loading = featured ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      link.replaceChildren(createDefaultPreview(project, true));
      figure.classList.add("fallback-shot");
    });
    link.appendChild(image);
  } else {
    figure.classList.add("fallback-shot");
    link.appendChild(createDefaultPreview(project, true));
  }

  const caption = document.createElement("figcaption");
  caption.textContent = screenshot.caption || (featured ? "Featured preview" : `Screenshot ${index + 1}`);
  figure.append(link, caption);
  return figure;
}

function appendDrawerLink(container, label, url, primary = false) {
  if (!url) return;

  const link = document.createElement("a");
  link.className = primary ? "button button-primary" : "button button-secondary";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  container.appendChild(link);
}

function appendFact(container, label, value) {
  if (!value) return;

  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  container.append(term, description);
}

async function copyProjectLink(project) {
  const url = projectShareUrl(project);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const input = document.createElement("input");
  input.value = url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

async function copyCatalogJson() {
  const button = elements.copyCatalog;
  if (!button) return;

  const originalText = button.textContent;
  try {
    const response = await fetch("data/projects.json", { cache: "no-store" });
    if (!response.ok) throw statusError(`Unable to load data/projects.json: ${response.status}`, response.status);

    const payload = await response.json();
    await writeTextToClipboard(JSON.stringify(payload, null, 2));
    button.textContent = "Copied JSON";
  } catch (error) {
    console.warn("Unable to copy catalog JSON.", error);
    button.textContent = "Copy failed";
  } finally {
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1400);
  }
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

function projectSlugFromHash() {
  const hash = window.location.hash || "";
  if (!hash.startsWith("#project/")) return "";
  return decodeURIComponent(hash.slice("#project/".length));
}

function filterFromHash() {
  const hash = window.location.hash || "";
  if (hash === "#projects") return "All";
  if (!hash.startsWith("#category/")) return "";
  const slug = decodeURIComponent(hash.slice("#category/".length));
  return FILTERS_BY_SLUG[slug] || "";
}

function filterHash(filter) {
  return filter === "All" ? "#projects" : `#category/${categorySlug(filter)}`;
}

function applyInitialHashScroll() {
  if (visualTestMode || didApplyHashScroll || window.location.hash !== "#projects") return;

  didApplyHashScroll = true;
  scrollProjectsIntoView();
}

function scrollProjectsIntoView() {
  if (visualTestMode) return;
  requestAnimationFrame(() => {
    document.querySelector("#projects")?.scrollIntoView({ block: "start" });
  });
}

function applyVisualScrollTarget() {
  if (!visualTestMode || didApplyVisualScroll || visualScrollTarget !== "projects") return;

  didApplyVisualScroll = true;
  requestAnimationFrame(() => {
    document.querySelector("#projects")?.scrollIntoView({ block: "start" });
  });
}

function applyVisualCommandPalette() {
  if (!visualTestMode || visualCommand !== "1") return;
  requestAnimationFrame(() => {
    openCommandPalette();
  });
}

function initCardReveals() {
  if (!canUseReveal()) return;

  const cards = [...elements.grid.querySelectorAll(".project-card")];
  if (!cards.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("reveal-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );

  for (const card of cards) {
    card.classList.add("reveal-ready");
    observer.observe(card);
  }
}

function canUseReveal() {
  return (
    !window.location.hash &&
    !visualTestMode &&
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function attachTilt(element) {
  if (!canUseTilt()) return;

  element.addEventListener("pointermove", (event) => {
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * 6;
    const rotateY = (x - 0.5) * 8;
    element.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
    element.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
    element.style.setProperty("--glow-x", `${(x * 100).toFixed(1)}%`);
    element.style.setProperty("--glow-y", `${(y * 100).toFixed(1)}%`);
  });

  element.addEventListener("pointerleave", () => {
    element.style.removeProperty("--tilt-x");
    element.style.removeProperty("--tilt-y");
    element.style.removeProperty("--glow-x");
    element.style.removeProperty("--glow-y");
  });
}

function canUseTilt() {
  return (
    !visualTestMode &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function attachHeroMotion(element) {
  if (!canUseTilt()) return;

  element.addEventListener("pointermove", (event) => {
    const rect = element.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    element.style.setProperty("--hero-shift-x", `${(x * 10).toFixed(2)}px`);
    element.style.setProperty("--hero-shift-y", `${(y * 8).toFixed(2)}px`);
  });

  element.addEventListener("pointerleave", () => {
    element.style.removeProperty("--hero-shift-x");
    element.style.removeProperty("--hero-shift-y");
  });
}

function setDataNote(payload) {
  if (payload.generatedAt) {
    const formatted = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(payload.generatedAt));
    elements.dataNote.textContent = `Updated ${formatted}`;
    return;
  }

  elements.dataNote.textContent = `${state.projects.length} projects loaded`;
}

function updateDiscoverySummary(payload = {}) {
  if (!elements.discoveryStrip) return;

  const manifestCount = state.projects.filter((project) => project.manifestFound).length;
  const latestProject = [...state.projects].sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt))[0];
  elements.discoveryCount.textContent = payload.sample
    ? `${state.projects.length} sample projects loaded`
    : payload.orgIndexCount
      ? `${state.projects.length} project sites / ${payload.orgIndexCount} repos indexed`
      : `${state.projects.length} public project sites indexed`;
  elements.discoveryManifests.textContent = `${manifestCount} manifest${manifestCount === 1 ? "" : "s"} found`;
  elements.discoveryGenerated.textContent = payload.generatedAt
    ? `Refreshed ${formatDate(payload.generatedAt)}`
    : latestProject?.updatedAt
      ? `Latest update ${formatRelative(latestProject.updatedAt)}`
      : "Refresh time unavailable";
  elements.discoveryStrip.hidden = false;
}

function renderStructuredData(projects) {
  const script = document.querySelector("#structured-data");
  if (!script) return;

  script.textContent = JSON.stringify(buildStructuredData(projects), null, 2);
}

function buildStructuredData(projects) {
  const projectItems = projects.map((project, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: projectStructuredData(project),
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "NinjaTom Apps",
        url: CANONICAL_SITE_URL,
        logo: new URL("assets/icon-512.png", CANONICAL_SITE_URL).href,
        email: "support@ninjatomapps.com",
        sameAs: ["https://github.com/NinjaTomOnline", "https://custom3d.art/"],
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: "NinjaTom Apps",
        url: CANONICAL_SITE_URL,
        publisher: { "@id": ORGANIZATION_ID },
      },
      {
        "@type": "CollectionPage",
        "@id": `${CANONICAL_SITE_URL}#projects`,
        name: "NinjaTom Apps Project Websites",
        url: CANONICAL_SITE_URL,
        description: "A curated hub for NinjaTomOnline apps, tools, games, and Custom3D.Art projects.",
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: {
          "@type": "ItemList",
          itemListOrder: "https://schema.org/ItemListOrderAscending",
          numberOfItems: projects.length,
          itemListElement: projectItems,
        },
      },
    ],
  };
}

function projectStructuredData(project) {
  const images = [
    projectShareImageUrl(project),
    project.previewImage,
    ...project.screenshots.map((screenshot) => screenshot.src),
  ].filter(Boolean);
  const data = {
    "@type": schemaTypeForProject(project),
    "@id": `${CANONICAL_SITE_URL}#project-${project.slug}`,
    name: project.name,
    description: project.tagline,
    url: project.website || project.repositoryUrl || projectShareUrl(project),
    image: Array.from(new Set(images)),
    sameAs: [project.repositoryUrl, project.appStoreUrl].filter(Boolean),
    applicationCategory: schemaTypeForProject(project) === "SoftwareApplication" ? project.category : undefined,
    operatingSystem: operatingSystemForProject(project),
    datePublished: project.launchedAt || undefined,
    dateModified: project.updatedAt || undefined,
    softwareVersion: project.version || undefined,
    releaseNotes: project.launchNotes || undefined,
    publisher: { "@id": ORGANIZATION_ID },
    mainEntityOfPage: projectShareUrl(project),
    potentialAction: project.releaseProjection?.kind === "projected"
      ? {
          "@type": "ViewAction",
          name: project.releaseProjection.dateLabel,
          target: project.website || project.repositoryUrl || projectShareUrl(project),
        }
      : undefined,
  };

  return compactObject(data);
}

function projectShareUrl(project) {
  return new URL(`projects/${project.slug}.html`, CANONICAL_SITE_URL).href;
}

function projectShareImageUrl(project) {
  return new URL(`assets/project-og/${project.slug}.png`, CANONICAL_SITE_URL).href;
}

function schemaTypeForProject(project) {
  const category = project.category.toLowerCase();
  if (category.includes("game")) return "VideoGame";
  if (/(ios|web|tool|utility|app|software)/.test(category)) return "SoftwareApplication";
  return "CreativeWork";
}

function operatingSystemForProject(project) {
  const category = project.category.toLowerCase();
  if (category.includes("ios") || category.includes("iphone") || category.includes("ipad")) return "iOS";
  if (category.includes("web")) return "Web";
  return undefined;
}

function formatRelative(value) {
  if (visualTestMode) return "Updated recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const delta = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;

  if (delta < hour) return "Updated now";
  if (delta < day) return `${Math.max(1, Math.floor(delta / hour))}h ago`;
  if (delta < month) return `${Math.max(1, Math.floor(delta / day))}d ago`;
  return `${Math.max(1, Math.floor(delta / month))}mo ago`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function isRecentlyUpdated(project) {
  if (visualTestMode) return false;
  const updated = dateValue(project.updatedAt);
  if (!updated) return false;
  const days = (Date.now() - updated) / (24 * 60 * 60 * 1000);
  return days >= 0 && days <= 7;
}

function isRecentlyLaunched(project) {
  const launched = dateValue(project.launchedAt);
  if (!launched) return false;
  const days = ((visualTestMode ? dateValue("2026-05-01T00:00:00Z") : Date.now()) - launched) / (24 * 60 * 60 * 1000);
  return days >= 0 && days <= 120;
}

function createReleaseProjection(project, context = {}) {
  const explicitDate = cleanDateValue(project.projectedReleaseDate);
  const explicitProgress = normalizedPercent(project.progressPercent);

  if (project.appStoreUrl) {
    const date = cleanDateValue(project.launchedAt) || cleanDateValue(project.updatedAt) || "";
    return {
      kind: "app-store",
      label: "On the App Store",
      badge: "App Store",
      target: "App Store",
      date,
      dateLabel: date ? `App Store live / ${formatDate(date)}` : "App Store live",
      progress: 100,
      note: `${project.name} has a verified App Store link in the catalog.`,
      signals: [{ label: "App Store URL connected", weight: 100 }],
    };
  }

  if (project.archived || /archived/i.test(project.status)) {
    return {
      kind: "archived",
      label: "Archived",
      badge: "Archived",
      target: "release",
      date: "",
      dateLabel: "No active release projection",
      progress: explicitProgress ?? 0,
      note: `${project.name} is archived, so the hub does not project a release date.`,
      signals: [{ label: "Repository or manifest is archived", weight: 0 }],
    };
  }

  const signals = releaseProgressSignals(project);
  const inferredProgress = signals.reduce((total, signal) => total + signal.weight, 0);
  const progress = explicitProgress ?? clampNumber(inferredProgress, 12, 95);
  const date = explicitDate || projectedReleaseDate(project, progress, context);
  const target = releaseProjectionTarget(project);
  const targetPhrase = target === "App Store" ? "App Store" : "release";

  return {
    kind: "projected",
    label: `Projected ${target}`,
    badge: `Projected ${formatShortDate(date) || "TBD"}`,
    target,
    date,
    dateLabel: formatDate(date) ? `Projected ${formatDate(date)}` : "Projected date TBD",
    progress,
    note:
      project.releaseProjectionNote ||
      `Estimated ${targetPhrase} timing from public project progress: ${signals.slice(0, 3).map((signal) => signal.label).join(", ").toLowerCase()}.`,
    signals,
  };
}

function releaseProjectionTarget(project) {
  const searchable = `${project.category} ${project.status} ${project.topics.join(" ")}`;
  return /ios|iphone|ipad|app store|testflight/i.test(searchable) ? "App Store" : "release";
}

function releaseProgressSignals(project) {
  const signals = [];
  const status = project.status.toLowerCase();

  if (/release candidate/.test(status)) signals.push({ label: "Release candidate status", weight: 28 });
  else if (/testflight|beta/.test(status)) signals.push({ label: "Beta/TestFlight status", weight: 22 });
  else if (/private staging|staging/.test(status)) signals.push({ label: "Private staging status", weight: 16 });
  else if (/coming soon|planned/.test(status)) signals.push({ label: "Coming soon status", weight: 10 });
  else if (/live/.test(status)) signals.push({ label: "Public site is live", weight: 18 });

  if (project.website) signals.push({ label: "Public website connected", weight: 14 });
  if (project.manifestFound) signals.push({ label: "Curated site manifest", weight: 14 });
  if (project.supportUrl) signals.push({ label: "Support URL ready", weight: 5 });
  if (project.privacyUrl) signals.push({ label: "Privacy URL ready", weight: 5 });
  if (project.icon) signals.push({ label: "App icon discovered", weight: 4 });
  if (project.previewImage) signals.push({ label: "Preview artwork ready", weight: 5 });
  if (project.screenshots.length >= 5) signals.push({ label: "Full screenshot gallery", weight: 14 });
  else if (project.screenshots.length >= 3) signals.push({ label: "Screenshot gallery started", weight: 10 });
  else if (project.screenshots.length >= 1) signals.push({ label: "Project screenshot available", weight: 5 });
  if (project.version) signals.push({ label: "Version metadata set", weight: 5 });
  if (project.latestRelease) signals.push({ label: "GitHub release exists", weight: 8 });
  if (project.repositoryUrl) signals.push({ label: "GitHub repo indexed", weight: 3 });

  const daysSinceUpdate = daysSince(project.updatedAt);
  if (daysSinceUpdate <= 30) signals.push({ label: "Updated in the last 30 days", weight: 8 });
  else if (daysSinceUpdate <= 90) signals.push({ label: "Updated in the last 90 days", weight: 5 });
  else if (daysSinceUpdate <= 180) signals.push({ label: "Updated in the last 180 days", weight: 2 });

  return signals.length ? signals : [{ label: "Catalog entry exists", weight: 12 }];
}

function projectedReleaseDate(project, progress, context = {}) {
  const anchor = projectionAnchorDate(project, context);
  const days =
    progress >= 88 ? 14 :
      progress >= 76 ? 28 :
        progress >= 62 ? 49 :
          progress >= 46 ? 77 :
            112;
  const jitter = stableNumber(project.repoName || project.name) % 10;
  const date = new Date(anchor);
  date.setUTCDate(date.getUTCDate() + days + jitter);

  while (date.getUTCDay() !== 2) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  date.setUTCHours(12, 0, 0, 0);
  return date.toISOString();
}

function projectionAnchorDate(project, context = {}) {
  if (visualTestMode) return new Date("2026-05-06T12:00:00Z");

  const candidates = [
    context.generatedAt,
    project.updatedAt,
    project.launchedAt,
    new Date().toISOString(),
  ];

  for (const candidate of candidates) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date();
}

function cleanDateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function normalizedPercent(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? clampNumber(Math.round(number), 0, 100) : null;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function daysSince(value) {
  const timestamp = dateValue(value);
  if (!timestamp) return Infinity;
  const now = visualTestMode ? dateValue("2026-05-06T12:00:00Z") : Date.now();
  return Math.max(0, (now - timestamp) / (24 * 60 * 60 * 1000));
}

function stableNumber(value) {
  return String(value || "")
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
}

function normalizeScreenshots(value, fallback = {}) {
  const screenshots = [];
  const seen = new Set();

  const addScreenshot = (item, fallbackCaption = "") => {
    const source = typeof item === "string" ? item : item?.src || item?.url || item?.image;
    const src = validUrl(source);
    if (!src || seen.has(src)) return;

    seen.add(src);
    screenshots.push({
      src,
      alt: stringOr(
        typeof item === "string" ? "" : item?.alt,
        fallback.previewImageAlt || `${fallback.name || "Project"} screenshot`,
      ),
      caption: stringOr(typeof item === "string" ? "" : item?.caption || item?.title, fallbackCaption),
    });
  };

  if (Array.isArray(value)) {
    for (const item of value) addScreenshot(item);
  }

  if (fallback.previewImage) {
    addScreenshot(
      {
        src: fallback.previewImage,
        alt: fallback.previewImageAlt,
        caption: "Preview",
      },
      "Preview",
    );
  }

  return screenshots.slice(0, 6);
}

function normalizeTextList(value, fallback = [], limit = 6) {
  const source = Array.isArray(value) ? value : [];
  const cleaned = source
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return (cleaned.length ? cleaned : fallback).slice(0, limit);
}

function normalizeRepoIndex(value, fallback = {}) {
  const source = value && typeof value === "object" ? value : fallback;
  const topics = normalizeTextList(source.topics, fallback.topics || [], 20);

  return {
    name: stringOr(source.name || fallback.name, ""),
    full_name: stringOr(source.full_name || source.fullName || fallback.full_name, ""),
    html_url: validUrl(source.html_url || source.repositoryUrl || fallback.html_url),
    description: stringOr(source.description || fallback.description, ""),
    homepage: validUrl(source.homepage || source.website || fallback.homepage),
    topics,
    language: stringOr(source.language || fallback.language, ""),
    license: stringOr(source.license || fallback.license, ""),
    default_branch: stringOr(source.default_branch || source.defaultBranch || fallback.default_branch, ""),
    archived: Boolean(source.archived ?? fallback.archived),
    pushed_at: stringOr(source.pushed_at || source.updatedAt || fallback.pushed_at, ""),
    open_issues_count: numberOr(source.open_issues_count ?? source.openIssuesCount ?? fallback.open_issues_count, 0),
    stargazers_count: numberOr(source.stargazers_count ?? source.stargazersCount ?? fallback.stargazers_count, 0),
    latest_release: normalizeLatestRelease(source.latest_release || source.latestRelease || fallback.latest_release),
  };
}

function repoIndexFromRepository(repo) {
  return {
    name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description || "",
    homepage: repo.homepage || "",
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    language: repo.language || "",
    license: repo.license || "",
    default_branch: repo.default_branch || "",
    archived: Boolean(repo.archived),
    pushed_at: repo.pushed_at || "",
    open_issues_count: Number.isFinite(repo.open_issues_count) ? repo.open_issues_count : 0,
    stargazers_count: Number.isFinite(repo.stargazers_count) ? repo.stargazers_count : 0,
    latest_release: normalizeLatestRelease(repo.latest_release),
  };
}

function normalizeLatestRelease(value) {
  if (!value || typeof value !== "object") return null;
  const release = {
    name: stringOr(value.name, ""),
    tag_name: stringOr(value.tag_name || value.tagName, ""),
    html_url: validUrl(value.html_url || value.url),
    published_at: stringOr(value.published_at || value.publishedAt, ""),
    prerelease: Boolean(value.prerelease),
  };

  return release.name || release.tag_name || release.html_url ? release : null;
}

function defaultLaunchNotes(project) {
  const name = stringOr(project.name, "This project");
  const status = stringOr(project.status, "Live");
  const category = stringOr(project.category, "project");
  return `${name} is listed as ${status} in the ${category} catalog, refreshed automatically from public project metadata.`;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (Array.isArray(item)) return item.length > 0;
      return item !== undefined && item !== null && item !== "";
    }),
  );
}

function categoryIncludes(project, terms) {
  const value = [
    project.category,
    project.name,
    project.repoName,
    project.language,
    project.topics.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return terms.some((term) => value.includes(term));
}

function categorySlug(value) {
  return String(value || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function shortText(value, limit) {
  const text = stringOr(value, "");
  return text.length > limit ? `${text.slice(0, limit - 1).trim()}...` : text;
}

function dateValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCompactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

function validUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function validAccent(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim()
    : "#9B5CFF";
}
