(() => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("#primary-nav");

  const smallViewport = window.matchMedia("(max-width: 720px)");

  function setOpen(isOpen) {
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("nav-open", isOpen);
  }

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", (event) => {
      if (event.target.closest("a") && smallViewport.matches) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });

    smallViewport.addEventListener("change", (event) => {
      if (!event.matches) setOpen(false);
    });
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const visualTestMode = new URLSearchParams(window.location.search).has("visual-test");
  const spotlightSelector = [
    ".project-card",
    ".controls-panel",
    ".filter-tab",
    ".search-wrap",
    ".latest-strip",
    ".latest-update",
    ".studio-note",
    ".button",
    ".card-link",
    ".command-result",
    ".load-more",
    ".press-card",
    ".asset-row",
    ".press-contact",
    ".not-found-console",
  ].join(",");

  if (!visualTestMode && finePointer.matches && !prefersReducedMotion.matches) {
    wireSpotlights();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) wireSpotlights(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function wireSpotlights(root = document) {
    const candidates = [];
    if (root instanceof Element && root.matches(spotlightSelector)) candidates.push(root);
    candidates.push(...root.querySelectorAll(spotlightSelector));

    for (const element of candidates) {
      if (element.dataset.spotlightBound === "true") continue;
      element.dataset.spotlightBound = "true";
      element.classList.add("spotlight-surface");

      element.addEventListener("pointermove", (event) => {
        const rect = element.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        element.style.setProperty("--spotlight-x", `${x.toFixed(1)}%`);
        element.style.setProperty("--spotlight-y", `${y.toFixed(1)}%`);
      });

      element.addEventListener("pointerleave", () => {
        element.style.removeProperty("--spotlight-x");
        element.style.removeProperty("--spotlight-y");
      });
    }
  }
})();
