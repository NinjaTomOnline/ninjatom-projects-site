const FILTERS = {
  All: () => true,
  "iOS Apps": (project) => categoryIncludes(project, ["ios", "iphone", "ipad", "watchos"]),
  "Web Apps": (project) => categoryIncludes(project, ["web", "website", "saas"]),
  Games: (project) => categoryIncludes(project, ["game", "games"]),
  Tools: (project) => categoryIncludes(project, ["tool", "utility", "productivity"]),
  "Creative / Custom3D": (project) =>
    categoryIncludes(project, ["creative", "custom3d", "custom 3d", "3d", "art"]),
};

const INITIAL_VISIBLE_COUNT = 12;
const urlParams = new URLSearchParams(window.location.search);
const visualTestMode = urlParams.has("visual-test");
const visualView = urlParams.get("view");
const visualScrollTarget = urlParams.get("scroll");
let didApplyVisualScroll = false;
let didApplyHashScroll = false;

if (visualTestMode && visualView) {
  document.body.dataset.visualView = visualView;
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
  featuredRail: document.querySelector("#featured-rail"),
  featuredTrack: document.querySelector("#featured-track"),
  featuredPrev: document.querySelector("#featured-prev"),
  featuredNext: document.querySelector("#featured-next"),
};

init();

async function init() {
  bindEvents();
  showState("loading", "Loading projects...");

  try {
    const payload = await loadProjects();
    state.projects = payload.projects.map(normalizeProject);
    renderHeroShowcase(state.projects);
    renderFeaturedLaunches(state.projects);
    renderProjects();
    setDataNote(payload);
  } catch (error) {
    console.warn("Falling back to sample project data.", error);
    state.projects = FALLBACK_PROJECTS.map(normalizeProject);
    renderHeroShowcase(state.projects);
    renderFeaturedLaunches(state.projects);
    renderProjects();
    elements.dataNote.textContent = "Previewing sample data";
  }
}

function bindEvents() {
  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    state.visibleCount = INITIAL_VISIBLE_COUNT;
    renderProjects();
  });

  document.addEventListener("keydown", (event) => {
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

  elements.filterTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    state.filter = button.dataset.filter;
    state.visibleCount = INITIAL_VISIBLE_COUNT;
    for (const tab of elements.filterTabs.querySelectorAll(".filter-tab")) {
      const isActive = tab === button;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-pressed", String(isActive));
    }
    renderProjects();
  });

  elements.featuredPrev?.addEventListener("click", () => scrollFeatured(-1));
  elements.featuredNext?.addEventListener("click", () => scrollFeatured(1));
  elements.featuredTrack?.addEventListener("scroll", updateFeaturedControls, { passive: true });

  elements.loadMore.addEventListener("click", () => {
    const filtered = getFilteredProjects();
    state.visibleCount =
      state.visibleCount >= filtered.length ? INITIAL_VISIBLE_COUNT : filtered.length;
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
    topics: Array.isArray(project.topics) ? project.topics : [],
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

function renderHeroShowcase(projects) {
  const selected = selectHeroProjects(projects);
  const positions = ["top", "middle", "side", "bottom"];
  const fragment = document.createDocumentFragment();

  for (const [index, project] of selected.entries()) {
    const card = document.createElement("a");
    card.className = `hero-product hero-product-${positions[index] || "side"}`;
    card.href = project.website || project.repositoryUrl || "#";
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.style.setProperty("--accent", project.accent);

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
    if (project.previewImage && !visualTestMode) {
      const image = document.createElement("img");
      image.src = project.previewImage;
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

function renderFeaturedLaunches(projects) {
  if (!elements.featuredRail || !elements.featuredTrack) return;

  const featuredProjects = selectFeaturedLaunches(projects);
  elements.featuredTrack.replaceChildren();

  if (!featuredProjects.length) {
    elements.featuredRail.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const project of featuredProjects) {
    fragment.appendChild(createFeaturedCard(project));
  }

  elements.featuredTrack.appendChild(fragment);
  elements.featuredRail.hidden = false;
  requestAnimationFrame(updateFeaturedControls);
}

function selectFeaturedLaunches(projects) {
  const sorted = sortProjects([...projects], "studio");
  const primary = sorted.filter((project) => project.featured);
  const previewed = sorted.filter(
    (project) => project.previewImage && !primary.some((item) => item.name === project.name),
  );
  return [...primary, ...previewed, ...sorted]
    .filter((project, index, all) => all.findIndex((item) => item.name === project.name) === index)
    .slice(0, 8);
}

function createFeaturedCard(project) {
  const card = document.createElement("a");
  card.className = "featured-card";
  card.href = project.website || project.repositoryUrl || "#";
  card.target = "_blank";
  card.rel = "noopener noreferrer";
  card.style.setProperty("--accent", project.accent);
  attachTilt(card);

  const media = document.createElement("span");
  media.className = "featured-media";
  media.appendChild(createDefaultPreview(project, true));
  if (project.previewImage && !visualTestMode) {
    const image = document.createElement("img");
    image.src = project.previewImage;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove());
    media.appendChild(image);
  }

  const copy = document.createElement("span");
  copy.className = "featured-copy";

  const eyebrow = document.createElement("span");
  eyebrow.className = "featured-eyebrow";
  eyebrow.textContent = project.featured ? "Featured launch" : "Fresh project";

  const title = document.createElement("strong");
  title.textContent = project.name;

  const tagline = document.createElement("span");
  tagline.className = "featured-tagline";
  tagline.textContent = shortText(project.tagline, 92);

  const meta = document.createElement("span");
  meta.className = "featured-meta";
  meta.append(createTag(project.category, "category-tag"), createStatusBadge(project.status));

  copy.append(eyebrow, title, tagline, meta);
  card.append(media, copy);
  return card;
}

function scrollFeatured(direction) {
  if (!elements.featuredTrack) return;

  const card = elements.featuredTrack.querySelector(".featured-card");
  const amount = (card?.getBoundingClientRect().width || 360) + 18;
  elements.featuredTrack.scrollBy({
    left: direction * amount,
    behavior: visualTestMode ? "auto" : "smooth",
  });
}

function updateFeaturedControls() {
  if (!elements.featuredTrack || !elements.featuredPrev || !elements.featuredNext) return;

  const maxScroll = elements.featuredTrack.scrollWidth - elements.featuredTrack.clientWidth;
  const canScroll = maxScroll > 2;
  elements.featuredPrev.disabled = !canScroll || elements.featuredTrack.scrollLeft <= 2;
  elements.featuredNext.disabled = !canScroll || elements.featuredTrack.scrollLeft >= maxScroll - 2;
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
  for (const project of visibleProjects) {
    fragment.appendChild(createProjectCard(project));
  }

  elements.grid.appendChild(fragment);
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

function createProjectCard(project) {
  const card = document.createElement("article");
  card.className = "project-card";
  card.style.setProperty("--accent", project.accent);
  attachTilt(card);

  const preview = document.createElement("a");
  preview.className = "project-preview";
  preview.href = project.website || project.repositoryUrl || "#";
  preview.target = "_blank";
  preview.rel = "noopener noreferrer";

  if (project.previewImage && !visualTestMode) {
    preview.appendChild(createDefaultPreview(project));

    const image = document.createElement("img");
    image.src = project.previewImage;
    image.alt = project.previewImageAlt;
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

  const links = document.createElement("div");
  links.className = "card-links";
  appendLink(links, "App Store", project.appStoreUrl);
  appendLink(links, "Support", project.supportUrl);
  appendLink(links, "Privacy", project.privacyUrl);
  appendLink(links, "Repo", project.repositoryUrl);

  const footer = document.createElement("div");
  footer.className = "card-footer";
  appendFooterLink(footer, "Live Site", project.website, "globe");
  appendFooterMeta(footer, formatRelative(project.updatedAt), "clock");

  body.append(titleRow, tagline);
  if (links.children.length) body.appendChild(links);
  body.appendChild(footer);
  card.append(preview, icon, body);
  return card;
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
  tag.textContent = label;
  return tag;
}

function createStatusBadge(label) {
  const status = document.createElement("span");
  status.className = `status-badge ${categorySlug(label)}`;
  status.textContent = label;
  return status;
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

function createIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 24 24");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    name === "clock"
      ? "M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      : "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2-2.2 3-5.2 3-9s-1-6.8-3-9m0 18c-2-2.2-3-5.2-3-9s1-6.8 3-9M3.6 9h16.8M3.6 15h16.8",
  );
  svg.appendChild(path);
  return svg;
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

function applyInitialHashScroll() {
  if (visualTestMode || didApplyHashScroll || window.location.hash !== "#projects") return;

  didApplyHashScroll = true;
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

function categoryIncludes(project, terms) {
  const value = `${project.category} ${project.name} ${project.repoName}`.toLowerCase();
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
