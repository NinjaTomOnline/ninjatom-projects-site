const FILTERS = {
  All: () => true,
  "iOS Apps": (project) => categoryIncludes(project, ["ios", "iphone", "ipad", "watchos"]),
  "Web Apps": (project) => categoryIncludes(project, ["web", "website", "saas"]),
  Games: (project) => categoryIncludes(project, ["game", "games"]),
  Tools: (project) => categoryIncludes(project, ["tool", "utility", "productivity"]),
  "Creative / Custom3D": (project) =>
    categoryIncludes(project, ["creative", "custom3d", "custom 3d", "3d", "art"]),
};

const FALLBACK_PROJECTS = [
  {
    name: "DoorCodes Vault",
    tagline: "Save door codes and surface them when you arrive.",
    category: "iOS App",
    status: "Live",
    website: "https://doorcodesapp.com",
    supportUrl: "https://doorcodesapp.com/support.html",
    privacyUrl: "https://doorcodesapp.com/privacy.html",
    appStoreUrl: "",
    icon: "",
    accent: "#38BDF8",
    featured: true,
    sortOrder: 10,
  },
  {
    name: "SwiftTerm",
    tagline: "A polished terminal companion for fast command notes and workflows.",
    category: "Tool",
    status: "Live",
    website: "https://ninjatomonline.github.io/swiftterm-site/",
    supportUrl: "",
    privacyUrl: "",
    appStoreUrl: "",
    icon: "",
    accent: "#59F2C7",
    featured: true,
    sortOrder: 20,
  },
  {
    name: "Zen Wisdom",
    tagline: "Quiet daily reflections designed for calmer routines.",
    category: "iOS App",
    status: "Live",
    website: "https://ninjatomonline.github.io/zenwisdom-site/",
    supportUrl: "",
    privacyUrl: "",
    appStoreUrl: "",
    icon: "",
    accent: "#A78BFA",
    featured: false,
    sortOrder: 30,
  },
];

const state = {
  projects: [],
  filter: "All",
  query: "",
};

const elements = {
  grid: document.querySelector("#project-grid"),
  statePanel: document.querySelector("#state-panel"),
  dataNote: document.querySelector("#data-note"),
  search: document.querySelector("#project-search"),
  filterTabs: document.querySelector("#filter-tabs"),
  projectCount: document.querySelector("#project-count"),
  featuredCount: document.querySelector("#featured-count"),
  categoryCount: document.querySelector("#category-count"),
  spotlightSection: document.querySelector("#spotlights"),
  featuredList: document.querySelector("#featured-list"),
  newestList: document.querySelector("#newest-list"),
};

init();

async function init() {
  bindEvents();
  showState("loading", "Loading projects...");

  try {
    const payload = await loadProjects();
    state.projects = sortProjects(payload.projects.map(normalizeProject));
    renderStats(state.projects);
    renderSpotlights(state.projects);
    renderProjects();
    setDataNote(payload);
  } catch (error) {
    console.warn("Falling back to sample project data.", error);
    state.projects = sortProjects(FALLBACK_PROJECTS.map(normalizeProject));
    renderStats(state.projects);
    renderSpotlights(state.projects);
    renderProjects();
    elements.dataNote.textContent = "Previewing sample data";
  }
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderProjects();
  });

  elements.filterTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    state.filter = button.dataset.filter;
    for (const tab of elements.filterTabs.querySelectorAll(".filter-tab")) {
      const isActive = tab === button;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    }
    renderProjects();
  });
}

async function loadProjects() {
  const response = await fetch("projects.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load projects.json: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.projects)) {
    throw new Error("projects.json must contain a projects array.");
  }

  return payload;
}

function normalizeProject(project) {
  const name = stringOr(project.name, "Untitled Project");
  const category = stringOr(project.category, "Project");
  const status = stringOr(project.status, "Live");

  return {
    name,
    tagline: stringOr(project.tagline, "A public NinjaTomOnline project website."),
    category,
    status,
    website: validUrl(project.website),
    supportUrl: validUrl(project.supportUrl),
    privacyUrl: validUrl(project.privacyUrl),
    appStoreUrl: validUrl(project.appStoreUrl),
    repositoryUrl: validUrl(project.repositoryUrl),
    icon: validUrl(project.icon),
    previewImage: validUrl(project.previewImage),
    previewImageAlt: stringOr(project.previewImageAlt, `${name} preview`),
    accent: validAccent(project.accent),
    featured: Boolean(project.featured),
    sortOrder: Number.isFinite(Number(project.sortOrder)) ? Number(project.sortOrder) : 1000,
    repoName: stringOr(project.repoName, ""),
    manifestFound: Boolean(project.manifestFound),
    updatedAt: stringOr(project.updatedAt, ""),
    searchText: [
      name,
      project.tagline,
      category,
      status,
      project.repoName,
      Array.isArray(project.topics) ? project.topics.join(" ") : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

function sortProjects(projects) {
  return projects.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

function renderStats(projects) {
  const categories = new Set(projects.map((project) => project.category).filter(Boolean));
  elements.projectCount.textContent = String(projects.length);
  elements.featuredCount.textContent = String(projects.filter((project) => project.featured).length);
  elements.categoryCount.textContent = String(categories.size);
}

function renderSpotlights(projects) {
  const featured = projects.filter((project) => project.featured).slice(0, 3);
  const newest = [...projects]
    .filter((project) => project.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 3);

  elements.featuredList.replaceChildren();
  elements.newestList.replaceChildren();

  for (const project of featured) {
    elements.featuredList.appendChild(createSpotlightCard(project));
  }

  for (const project of newest) {
    elements.newestList.appendChild(createSpotlightCard(project, true));
  }

  elements.spotlightSection.hidden = !featured.length && !newest.length;
}

function createSpotlightCard(project, showUpdated = false) {
  const card = document.createElement("a");
  card.className = "spotlight-card";
  card.href = project.website || project.repositoryUrl || "#";
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  card.style.setProperty("--accent", project.accent);

  const icon = document.createElement("span");
  icon.className = "spotlight-icon";
  if (project.icon) {
    const image = document.createElement("img");
    image.src = project.icon;
    image.alt = "";
    image.loading = "lazy";
    icon.appendChild(image);
  } else {
    icon.textContent = initials(project.name);
  }

  const body = document.createElement("span");
  body.className = "spotlight-body";

  const title = document.createElement("strong");
  title.textContent = project.name;

  const meta = document.createElement("span");
  meta.textContent = showUpdated && project.updatedAt ? `Updated ${formatDate(project.updatedAt)}` : project.category;

  body.append(title, meta);
  card.append(icon, body);
  return card;
}

function renderProjects() {
  const filterFn = FILTERS[state.filter] || FILTERS.All;
  const filteredProjects = state.projects.filter((project) => {
    const matchesFilter = filterFn(project);
    const matchesQuery = !state.query || project.searchText.includes(state.query);
    return matchesFilter && matchesQuery;
  });

  elements.grid.replaceChildren();

  if (!state.projects.length) {
    showState("empty", "No project websites found yet.");
    return;
  }

  if (!filteredProjects.length) {
    showState("empty", "No projects match this search.");
    return;
  }

  hideState();
  const fragment = document.createDocumentFragment();
  for (const project of filteredProjects) {
    fragment.appendChild(createProjectCard(project));
  }
  elements.grid.appendChild(fragment);
}

function createProjectCard(project) {
  const card = document.createElement("article");
  card.className = "project-card";
  if (project.previewImage) card.classList.add("has-preview");
  card.style.setProperty("--accent", project.accent);

  if (project.previewImage) {
    const preview = document.createElement("a");
    preview.className = "project-preview";
    preview.href = project.website || project.repositoryUrl || "#";
    preview.target = "_blank";
    preview.rel = "noopener noreferrer";

    const previewImage = document.createElement("img");
    previewImage.src = project.previewImage;
    previewImage.alt = project.previewImageAlt;
    previewImage.loading = "lazy";
    preview.appendChild(previewImage);
    card.appendChild(preview);
  }

  const head = document.createElement("div");
  head.className = "card-head";

  const icon = document.createElement("div");
  icon.className = "project-icon";
  if (project.icon) {
    const image = document.createElement("img");
    image.src = project.icon;
    image.alt = "";
    image.loading = "lazy";
    icon.appendChild(image);
  } else {
    icon.textContent = initials(project.name);
  }

  const titleWrap = document.createElement("div");
  titleWrap.className = "card-title-wrap";

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";
  const title = document.createElement("h3");
  title.textContent = project.name;
  titleRow.appendChild(title);
  if (project.featured) {
    const featured = document.createElement("span");
    featured.className = "featured-star";
    featured.title = "Featured";
    titleRow.appendChild(featured);
  }

  const meta = document.createElement("div");
  meta.className = "meta-row";
  meta.appendChild(createTag(project.category));
  meta.appendChild(createTag(project.status, statusClass(project.status)));

  titleWrap.append(titleRow, meta);
  head.append(icon, titleWrap);

  const tagline = document.createElement("p");
  tagline.className = "card-tagline";
  tagline.textContent = project.tagline;

  const links = document.createElement("div");
  links.className = "card-links";
  appendLink(links, "Website", project.website, true);
  appendLink(links, "App Store", project.appStoreUrl);
  appendLink(links, "Support", project.supportUrl);
  appendLink(links, "Privacy", project.privacyUrl);
  appendLink(links, "Repo", project.repositoryUrl);

  card.append(head, tagline, links);
  return card;
}

function createTag(label, className = "") {
  const tag = document.createElement("span");
  tag.className = `tag ${className}`.trim();
  tag.textContent = label;
  return tag;
}

function appendLink(container, label, url, primary = false) {
  if (!url) return;

  const link = document.createElement("a");
  link.className = primary ? "card-link primary" : "card-link";
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  container.appendChild(link);
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

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function categoryIncludes(project, terms) {
  const value = `${project.category} ${project.name} ${project.repoName}`.toLowerCase();
  return terms.some((term) => value.includes(term));
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function statusClass(status) {
  return `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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
    : "#42D9FF";
}
