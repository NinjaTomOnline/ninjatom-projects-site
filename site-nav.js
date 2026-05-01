(() => {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("#primary-nav");
  if (!toggle || !menu) return;

  const smallViewport = window.matchMedia("(max-width: 720px)");

  function setOpen(isOpen) {
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("nav-open", isOpen);
  }

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
})();
