// Mobile menu
const mobileToggle = document.querySelector(".mobile-toggle");
const navLinks = document.querySelector(".nav-links");

if (mobileToggle && navLinks) {
  const setOpen = (open) => {
    navLinks.classList.toggle("active", open);
    mobileToggle.setAttribute("aria-expanded", String(open));
    mobileToggle.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
  };

  mobileToggle.addEventListener("click", () => setOpen(!navLinks.classList.contains("active")));

  // Close menu when clicking a link
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });
}

// Smooth scroll for anchor links (sections set scroll-margin-top for the sticky header)
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href !== "#" && document.querySelector(href)) {
      e.preventDefault();
      document.querySelector(href).scrollIntoView({ behavior: "smooth" });
    }
  });
});

// Hero: soft spotlight follows the pointer and the background glows shift with it (mouse/trackpad only)
const hero = document.querySelector(".hero");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

if (hero && !reduceMotion && finePointer) {
  let frame = 0;
  hero.addEventListener("pointermove", (e) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      hero.style.setProperty("--mx", `${x * 100}%`);
      hero.style.setProperty("--my", `${y * 100}%`);
      hero.style.setProperty("--px", (x - 0.5).toFixed(3));
      hero.style.setProperty("--py", (y - 0.5).toFixed(3));
      hero.classList.add("is-pointing");
    });
  });
  hero.addEventListener("pointerleave", () => {
    hero.classList.remove("is-pointing");
    hero.style.setProperty("--px", 0);
    hero.style.setProperty("--py", 0);
  });
}
