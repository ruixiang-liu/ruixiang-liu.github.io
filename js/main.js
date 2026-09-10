(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  const navLinks = [...document.querySelectorAll(".nav a")];

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      nav.classList.toggle("is-open", !open);
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        nav.classList.remove("is-open");
      });
    });
  }

  const revealTargets = document.querySelectorAll(
    ".section-head, .about-grid, .theme-item, .media-card, .featured-pub, .news-feature, .pub, .news-list li, .edu-list li, .contact-item, .award-list li, .plain-list li, .tag-list, .office-block, .map-panel, .mini-panel, .teaching-card, .office-map, .visitor-map"
  );
  revealTargets.forEach((el) => el.classList.add("reveal"));

  if ("IntersectionObserver" in window) {
    const reveal = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealTargets.forEach((el) => reveal.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }

  const mountVisitorMap = () => {
    const mount = document.getElementById("visitor-map-mount");
    if (!mount) return;

    const cfg = window.SITE_CONFIG || {};
    let id = String(cfg.mapMyVisitorsId || "").trim();
    // Allow pasting a full embed snippet into the config value.
    const fromSnippet = id.match(/[?&]d=([^&"'>\s]+)/i);
    if (fromSnippet) id = decodeURIComponent(fromSnippet[1]);

    mount.innerHTML = "";

    if (!id) {
      mount.innerHTML = `
        <div class="visitor-map-fallback">
          <p><strong>MapMyVisitors</strong> is ready to connect.</p>
          <ol>
            <li>Open <a href="https://mapmyvisitors.com/" target="_blank" rel="noopener">mapmyvisitors.com</a> and create a free widget for your site.</li>
            <li>Copy the embed code (or just the <code>d=</code> id).</li>
            <li>Paste it into <code>js/site-config.js</code> as <code>mapMyVisitorsId</code>.</li>
          </ol>
        </div>
      `;
      return;
    }

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.id = "mapmyvisitors";
    script.src =
      "https://mapmyvisitors.com/map.js?d=" +
      encodeURIComponent(id) +
      "&cl=ffffff&w=a";
    mount.appendChild(script);
  };

  mountVisitorMap();
})();
