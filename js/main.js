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
    const closeMenu = (restoreFocus = false) => {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      nav.classList.remove("is-open");
      if (restoreFocus) toggle.focus();
    };

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      nav.classList.toggle("is-open", !open);
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        closeMenu();
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("is-open")) closeMenu(true);
    });
    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) closeMenu();
    });
    window.matchMedia("(min-width: 761px)").addEventListener("change", (event) => {
      if (event.matches) closeMenu();
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

  const mountVisitorMap = async () => {
    const mount = document.getElementById("visitor-map-mount");
    if (!mount) return;

    const map = mount.querySelector(".visitor-history-map");
    const fallback = mount.querySelector(".visitor-map-fallback");
    const cfg = window.SITE_CONFIG || {};
    let id = String(cfg.mapMyVisitorsId || "").trim();
    const fromSnippet = id.match(/[?&]d=([^&"'>\s]+)/i);
    if (fromSnippet) id = decodeURIComponent(fromSnippet[1]);

    // Continue collecting visits under the same provider ID. The visible map
    // uses the daily history file because the embedded widget is recent-only.
    if (id) {
      const tracker = document.createElement("img");
      tracker.src = "https://mapmyvisitors.com/map.png?d=" + encodeURIComponent(id);
      tracker.alt = "";
      tracker.width = 1;
      tracker.height = 1;
      tracker.hidden = true;
      tracker.setAttribute("aria-hidden", "true");
      mount.appendChild(tracker);
    }

    try {
      const response = await fetch("assets/data/visitor-history.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Visitor history unavailable");
      const history = await response.json();
      if (history.schemaVersion !== 1 || !Array.isArray(history.locations)) {
        throw new Error("Invalid visitor history");
      }

      map.setAttribute("aria-label", "Recorded visitor locations since " + history.rangeStart);
      const clearSelection = () => {
        map.querySelectorAll(".visitor-marker.is-selected").forEach((marker) => {
          marker.classList.remove("is-selected");
          marker.setAttribute("aria-expanded", "false");
        });
      };

      history.locations.forEach((location) => {
        const { name, latitude, longitude, visits } = location;
        if (typeof name !== "string" || !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) || Math.abs(latitude) > 90 ||
            Math.abs(longitude) > 180 || !Number.isInteger(visits) || visits < 1 ||
            /unknown/i.test(name)) return;

        const placeLabel = name.includes(",") ? name : name + " (country-level)";
        const label = placeLabel + " · " + visits.toLocaleString() + (visits === 1 ? " visit" : " visits");
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "visitor-marker";
        marker.style.left = ((longitude + 180) / 360 * 100) + "%";
        marker.style.top = ((90 - latitude) / 180 * 100) + "%";
        marker.style.setProperty("--marker-size", Math.min(13, 5 + Math.sqrt(visits)) + "px");
        if (longitude < -90) marker.classList.add("label-right");
        if (longitude > 90) marker.classList.add("label-left");
        marker.setAttribute("aria-label", label);
        marker.setAttribute("aria-expanded", "false");

        const tooltip = document.createElement("span");
        tooltip.className = "visitor-marker-label";
        tooltip.textContent = label;
        tooltip.setAttribute("aria-hidden", "true");
        marker.appendChild(tooltip);
        marker.addEventListener("click", () => {
          const open = marker.classList.contains("is-selected");
          clearSelection();
          marker.classList.toggle("is-selected", !open);
          marker.setAttribute("aria-expanded", String(!open));
        });
        map.appendChild(marker);
      });

      map.addEventListener("keydown", (event) => {
        if (event.key === "Escape") clearSelection();
      });
      document.addEventListener("click", (event) => {
        if (!event.target.closest(".visitor-marker")) clearSelection();
      });
    } catch (error) {
      if (fallback) fallback.hidden = false;
      console.warn("Visitor history could not be loaded:", error.message);
    }
  };

  mountVisitorMap();
})();
