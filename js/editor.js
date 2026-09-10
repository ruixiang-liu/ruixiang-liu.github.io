(() => {
  // Production (GitHub Pages): editor stays off; Home still syncs News top 5.
  // Local preview (localhost / 127.0.0.1): editor is available.
  // Set FORCE_ENABLE_EDITOR to true only if you temporarily need editing on a live URL.
  const FORCE_ENABLE_EDITOR = false;
  const ENABLE_EDITOR =
    FORCE_ENABLE_EDITOR ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  const STORAGE_PREFIX = "rl-site-edit:";
  const MODE_KEY = "rl-site-edit-mode";
  const NEWS_FEED_KEY = STORAGE_PREFIX + "news-feed";
  const HOME_NEWS_LIMIT = 5;

  const pageName = () => {
    let path = decodeURIComponent(location.pathname.replace(/\\/g, "/"));
    if (path.endsWith("/")) path += "index.html";
    const match = path.match(/([\w.-]+\.html)$/i);
    return match ? match[1] : "index.html";
  };

  const pageKey = () => STORAGE_PREFIX + pageName();

  const parsePageSnapshot = (raw) => {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (typeof data === "string") return { main: data, logo: "", footer: "" };
      return data;
    } catch {
      return { main: raw, logo: "", footer: "" };
    }
  };

  const newsItemsFromMainHtml = (mainHtml) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = mainHtml || "";
    return [...wrap.querySelectorAll(".news-list > li")].map((li) => {
      const clone = li.cloneNode(true);
      clone.querySelectorAll(".edit-item-actions, .edit-list-add, .edit-link-add").forEach((el) => el.remove());
      clone.removeAttribute("draggable");
      clone.classList.add("reveal", "is-visible");
      clone.style.position = "";
      return clone;
    });
  };

  const writeHomeNewsList = (items) => {
    const list = document.querySelector("main .home-news-list, main .news-list");
    if (!list || !items.length) return false;
    const top = items.slice(0, HOME_NEWS_LIMIT);
    list.innerHTML = top.map((li) => li.outerHTML).join("");
    list.classList.add("home-news-list");
    return true;
  };

  const patchHomeStorageNews = (itemElements) => {
    const topHtml = itemElements.slice(0, HOME_NEWS_LIMIT).map((li) => li.outerHTML);
    localStorage.setItem(NEWS_FEED_KEY, JSON.stringify(topHtml));

    const homeKey = STORAGE_PREFIX + "index.html";
    const raw = localStorage.getItem(homeKey);
    if (!raw) return;
    const data = parsePageSnapshot(raw);
    if (!data) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = data.main || "";
    const homeList = wrap.querySelector(".home-news-list, .news-list");
    if (!homeList) return;
    homeList.classList.add("home-news-list");
    homeList.innerHTML = topHtml.join("");
    data.main = wrap.innerHTML;
    localStorage.setItem(homeKey, JSON.stringify(data));
  };

  const syncHomeNewsFromSource = async () => {
    if (document.body.getAttribute("data-page") !== "home") return;

    let items = [];
    const storedNews = localStorage.getItem(STORAGE_PREFIX + "news.html");
    if (storedNews) {
      const data = parsePageSnapshot(storedNews);
      items = newsItemsFromMainHtml(data?.main || "");
    }
    if (!items.length) {
      const feed = localStorage.getItem(NEWS_FEED_KEY);
      if (feed) {
        try {
          const htmlParts = JSON.parse(feed);
          items = htmlParts.map((html) => {
            const wrap = document.createElement("div");
            wrap.innerHTML = html;
            return wrap.firstElementChild;
          }).filter(Boolean);
        } catch {
          items = [];
        }
      }
    }
    if (!items.length) {
      try {
        const res = await fetch("news.html", { cache: "no-store" });
        if (res.ok) {
          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          items = [...doc.querySelectorAll(".news-list > li")].map((li) => {
            const clone = li.cloneNode(true);
            clone.classList.add("reveal", "is-visible");
            return clone;
          });
        }
      } catch {
        return;
      }
    }
    writeHomeNewsList(items);
  };

  // Always keep Home Recent news aligned with News (top 5).
  if (!ENABLE_EDITOR) {
    syncHomeNewsFromSource();
    return;
  }

  const LIST_SPECS = [
    { list: ".pub-list", item: ":scope > li, :scope > .pub", prepend: true },
    { list: ".news-list", item: ":scope > li", prepend: true },
    { list: ".edu-list", item: ":scope > li" },
    { list: ".award-list", item: ":scope > li", prepend: true },
    { list: ".plain-list", item: ":scope > li" },
    { list: ".tag-list", item: ":scope > li" },
    { list: ".theme-list", item: ":scope > .theme-item" },
    { list: ".media-grid", item: ":scope > .media-card" },
    { list: ".featured-pubs", item: ":scope > .featured-pub" },
    { list: ".hero-stats", item: ":scope > .hero-stat" },
    { list: ".contact-row", item: ":scope > .contact-item" },
    { list: ".about-side", item: ":scope > .mini-panel" },
    { list: ".teaching-grid", item: ":scope > .teaching-card" },
  ];

  const main = document.querySelector("main");
  if (!main) return;

  const logoEl = () => document.querySelector(".logo");
  const footerEl = () => document.querySelector(".site-footer");

  const stripEditUi = (root = document) => {
    root.querySelectorAll(".edit-item-actions, .edit-list-add, .edit-link-add").forEach((el) => el.remove());
  };

  const syncNewsEditsToHome = () => {
    if (document.body.getAttribute("data-page") !== "news") return;
    const list = main.querySelector(".news-list");
    if (!list) return;
    const clone = list.cloneNode(true);
    stripEditUi(clone);
    const items = [...clone.querySelectorAll(":scope > li")].map((li) => {
      li.classList.add("reveal", "is-visible");
      li.removeAttribute("draggable");
      li.style.position = "";
      return li;
    });
    patchHomeStorageNews(items);
  };

  const snapshot = () => {
    stripEditUi(main);
    const data = JSON.stringify({
      main: main.innerHTML,
      logo: logoEl()?.innerHTML || "",
      footer: footerEl()?.innerHTML || "",
    });
    if (editing) mountListControls();
    return data;
  };

  const applySnapshot = (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      main.innerHTML = raw;
      return;
    }
    if (typeof data === "string") {
      main.innerHTML = data;
      return;
    }
    if (data.main) main.innerHTML = data.main;
    const logo = logoEl();
    const footer = footerEl();
    if (logo && typeof data.logo === "string") logo.innerHTML = data.logo;
    if (footer && typeof data.footer === "string") footer.innerHTML = data.footer;
    stripEditUi(main);
    const year = document.getElementById("year");
    if (year && !year.textContent.trim()) {
      year.textContent = String(new Date().getFullYear());
    }
  };

  const polishRestored = () => {
    main.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    main.querySelectorAll(".hero-copy > *, .hero-visual").forEach((el) => {
      el.style.opacity = "1";
      el.style.animation = "none";
    });
  };

  const saved = localStorage.getItem(pageKey());
  if (saved) {
    applySnapshot(saved);
    polishRestored();
  }

  const toolbar = document.createElement("div");
  toolbar.className = "edit-toolbar";
  toolbar.innerHTML = `
    <div class="edit-toolbar-main">
      <strong class="edit-toolbar-title">Site editor</strong>
      <button type="button" data-action="toggle">Edit site</button>
      <button type="button" data-action="save" hidden>Save</button>
      <button type="button" data-action="export-html" hidden>Export page HTML</button>
      <button type="button" data-action="export-json" hidden>Export all backups</button>
      <button type="button" data-action="import-json" hidden>Import backup</button>
      <button type="button" data-action="reset" hidden>Reset page</button>
      <input type="file" accept="application/json,.json" data-import hidden />
    </div>
    <p class="edit-toolbar-hint">Edit text and images; click any link (DOI, Scholar, etc.) to edit or remove it; use + DOI / + Link on publication rows; delete/add list items; Drag to reorder. Export HTML and replace repo files to publish permanently.</p>
  `;
  document.body.appendChild(toolbar);

  const linkDialog = document.createElement("div");
  linkDialog.className = "edit-link-dialog";
  linkDialog.hidden = true;
  linkDialog.innerHTML = `
    <div class="edit-link-dialog-panel" role="dialog" aria-modal="true" aria-label="Edit link">
      <strong class="edit-link-dialog-title">Edit link</strong>
      <label class="edit-link-field">Label
        <input type="text" data-link-label autocomplete="off" />
      </label>
      <label class="edit-link-field">URL / DOI
        <input type="text" data-link-url autocomplete="off" placeholder="https://doi.org/… or 10.…" />
      </label>
      <p class="edit-link-help">Clear the URL and click Remove to delete this link completely (including DOI).</p>
      <div class="edit-link-actions">
        <button type="button" data-link-save>Save</button>
        <button type="button" data-link-remove class="is-danger">Remove link</button>
        <button type="button" data-link-cancel>Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(linkDialog);

  let editing = localStorage.getItem(MODE_KEY) === "1";
  const fileInput = toolbar.querySelector("[data-import]");

  const setButtons = () => {
    const toggleBtn = toolbar.querySelector('[data-action="toggle"]');
    toggleBtn.textContent = editing ? "Exit edit" : "Edit site";
    toolbar.classList.toggle("is-editing", editing);
    toolbar.querySelectorAll("button[data-action]:not([data-action='toggle'])").forEach((btn) => {
      btn.hidden = !editing;
    });
  };

  const toast = (msg) => {
    let el = document.querySelector(".edit-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "edit-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-show"), 2200);
  };

  const savePage = (silent) => {
    localStorage.setItem(pageKey(), snapshot());
    syncNewsEditsToHome();
    if (!silent) {
      toast(
        document.body.getAttribute("data-page") === "news"
          ? "Saved — Home Recent news synced (top 5)"
          : "Saved in this browser"
      );
    }
  };

  const getItems = (list, itemSelector) =>
    [...list.querySelectorAll(itemSelector)].filter(
      (el) => !el.classList.contains("edit-list-add") && !el.classList.contains("edit-item-actions")
    );

  const clearCloneText = (root) => {
    root.querySelectorAll("h1, h2, h3, p, time, strong, em, span, dd, dt, figcaption, a").forEach((node) => {
      if (node.closest(".edit-item-actions, .edit-link-add")) return;
      if (node.children.length > 0) return;
      if (node.matches("time")) {
        node.textContent = "Mon YYYY";
        if (node.dateTime !== undefined) node.dateTime = "";
      } else if (node.matches("h1, h2, h3")) {
        node.textContent = "New title";
      } else if (node.matches(".pub-year, .theme-index, .media-kicker, .interest-index")) {
        node.textContent = "New";
      } else if (node.matches("a")) {
        const href = node.getAttribute("href") || "";
        if (/doi\.org/i.test(href) || /^10\.\d/i.test(href)) {
          node.textContent = "DOI";
          node.setAttribute("href", "https://doi.org/");
        } else {
          node.textContent = "Link";
          node.setAttribute("href", "#");
        }
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener");
      } else {
        node.textContent = "Click to edit";
      }
    });
  };

  const ITEM_MATCH =
    ".pub, .theme-item, .media-card, .featured-pub, .hero-stat, .contact-item, .news-feature, .mini-panel, li";

  const attachItemActions = (item) => {
    if (item.querySelector(":scope > .edit-item-actions")) return;
    if (getComputedStyle(item).position === "static") {
      item.style.position = "relative";
    }
    const actions = document.createElement("div");
    actions.className = "edit-item-actions";
    actions.contentEditable = "false";
    actions.innerHTML = `
      <button type="button" data-list-drag title="Drag to reorder" draggable="true">Drag</button>
      <button type="button" data-list-delete title="Delete item">Delete</button>
    `;
    item.appendChild(actions);

    const handle = actions.querySelector("[data-list-drag]");
    handle.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      item.draggable = true;
    });
    handle.addEventListener("mouseup", () => {
      item.draggable = false;
    });
  };

  let dragItem = null;

  const onDragStart = (event) => {
    if (!editing) return;
    const handle = event.target.closest("[data-list-drag]");
    const item = event.target.closest(ITEM_MATCH);
    if (!handle || !item || !main.contains(item)) {
      event.preventDefault();
      return;
    }
    dragItem = item;
    item.classList.add("is-dragging");
    main.contentEditable = "false";
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "reorder");
    try {
      event.dataTransfer.setDragImage(item, 24, 24);
    } catch {
      // ignore unsupported browsers
    }
  };

  const onDragOver = (event) => {
    if (!editing || !dragItem) return;
    const item = event.target.closest(ITEM_MATCH);
    if (!item || !main.contains(item) || item === dragItem) return;
    if (item.parentElement !== dragItem.parentElement) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = item.getBoundingClientRect();
    const before =
      (listIsHorizontal(item.parentElement) ? event.clientX < rect.left + rect.width / 2 : event.clientY < rect.top + rect.height / 2);
    const parent = item.parentElement;
    if (before) parent.insertBefore(dragItem, item);
    else parent.insertBefore(dragItem, item.nextSibling);
  };

  const listIsHorizontal = (list) => {
    if (!list) return false;
    return list.classList.contains("media-grid") ||
      list.classList.contains("featured-pubs") ||
      list.classList.contains("hero-stats") ||
      list.classList.contains("contact-row") ||
      list.classList.contains("tag-list");
  };

  const onDrop = (event) => {
    if (!editing || !dragItem) return;
    event.preventDefault();
  };

  const onDragEnd = () => {
    if (!dragItem) {
      if (editing) main.contentEditable = "true";
      return;
    }
    dragItem.classList.remove("is-dragging");
    dragItem.draggable = false;
    dragItem = null;
    if (editing) main.contentEditable = "true";
    savePage(true);
    toast("Order updated");
  };

  const mountListControls = () => {
    stripEditUi(main);
    LIST_SPECS.forEach((spec) => {
      const { list: listSelector, item: itemSelector, prepend } = spec;
      main.querySelectorAll(listSelector).forEach((list) => {
        const items = getItems(list, itemSelector);
        items.forEach((item) => attachItemActions(item));

        const add = document.createElement("button");
        add.type = "button";
        add.className = "edit-list-add";
        add.contentEditable = "false";
        add.textContent = prepend ? "+ Add item (top)" : "+ Add item";
        add.addEventListener("mousedown", (event) => event.preventDefault());
        add.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const current = getItems(list, itemSelector);
          const template = prepend
            ? current[0] || current[current.length - 1]
            : current[current.length - 1] || current[0];
          if (!template) {
            toast("No template item to copy in this list");
            return;
          }
          const clone = template.cloneNode(true);
          clone.querySelectorAll(".edit-item-actions").forEach((el) => el.remove());
          clone.classList.add("is-visible", "reveal");
          clearCloneText(clone);
          if (prepend && current[0]) list.insertBefore(clone, current[0]);
          else list.appendChild(clone);
          attachItemActions(clone);
          mountLinkAddControls();
          clone.scrollIntoView({ behavior: "smooth", block: "center" });
          savePage(true);
          toast(prepend ? "Item added at top — click to edit" : "Item added — click to edit text");
        });
        list.insertAdjacentElement("afterend", add);
      });
    });
    mountLinkAddControls();
  };

  const onListActionClick = (event) => {
    if (!editing) return;
    if (event.target.closest("[data-list-drag]")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const delBtn = event.target.closest("[data-list-delete]");
    if (!delBtn || !main.contains(delBtn)) return;
    event.preventDefault();
    event.stopPropagation();
    const item = delBtn.closest(ITEM_MATCH);
    if (!item) return;
    const list = item.parentElement;
    if (!window.confirm("Delete this item?")) return;
    item.remove();
    if (list && getItems(list, ":scope > *").filter((el) => !el.classList.contains("edit-list-add")).length === 0) {
      toast("List is empty — use Add item to create one");
    }
    savePage(true);
    toast("Deleted");
  };

  const onImgClick = (event) => {
    if (!editing) return;
    if (event.target.closest(".edit-item-actions, .edit-list-add, .edit-toolbar")) return;
    const img = event.target.closest("img");
    if (!img || !main.contains(img)) return;
    event.preventDefault();
    event.stopPropagation();

    const choice = window.prompt(
      "Replace image: enter an image URL, or leave blank to pick a local file.\nCurrent: " + (img.getAttribute("src") || ""),
      img.getAttribute("src") || ""
    );
    if (choice === null) return;
    if (choice.trim()) {
      img.setAttribute("src", choice.trim());
      savePage(true);
      return;
    }

    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.addEventListener("change", () => {
      const file = picker.files && picker.files[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) {
        toast("Large image — consider compressing first (still embedding)");
      }
      const reader = new FileReader();
      reader.onload = () => {
        img.setAttribute("src", String(reader.result));
        savePage(true);
      };
      reader.readAsDataURL(file);
    });
    picker.click();
  };

  const normalizeLinkUrl = (raw, labelHint = "") => {
    const value = String(raw || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value) || value.startsWith("#") || value.startsWith("/")) {
      return value;
    }
    if (/^10\.\d{4,9}\/\S+/i.test(value) || /^doi:\s*10\./i.test(value)) {
      return "https://doi.org/" + value.replace(/^doi:\s*/i, "");
    }
    if (/doi\.org\//i.test(value)) {
      return value.startsWith("http") ? value : "https://" + value.replace(/^\/\//, "");
    }
    if (/doi/i.test(labelHint) && /^[\w.]+\/\S+$/.test(value)) {
      return "https://doi.org/" + value;
    }
    return "https://" + value;
  };

  let activeLink = null;

  const closeLinkDialog = () => {
    activeLink = null;
    linkDialog.hidden = true;
  };

  const openLinkDialog = (link) => {
    activeLink = link;
    const labelInput = linkDialog.querySelector("[data-link-label]");
    const urlInput = linkDialog.querySelector("[data-link-url]");
    labelInput.value = (link.textContent || "").trim();
    urlInput.value = link.getAttribute("href") || "";
    linkDialog.hidden = false;
    urlInput.focus();
    urlInput.select();
  };

  const applyLinkDialog = () => {
    if (!activeLink) return;
    const labelInput = linkDialog.querySelector("[data-link-label]");
    const urlInput = linkDialog.querySelector("[data-link-url]");
    const label = (labelInput.value || "").trim() || "Link";
    const url = normalizeLinkUrl(urlInput.value, label);
    if (!url) {
      toast("URL is empty — use Remove link to delete");
      return;
    }
    activeLink.textContent = label;
    activeLink.setAttribute("href", url);
    if (/^mailto:/i.test(url) || url.startsWith("#")) {
      activeLink.removeAttribute("target");
      activeLink.removeAttribute("rel");
    } else {
      activeLink.setAttribute("target", "_blank");
      activeLink.setAttribute("rel", "noopener");
    }
    closeLinkDialog();
    savePage(true);
    toast("Link updated");
  };

  const removeActiveLink = () => {
    if (!activeLink) return;
    const link = activeLink;
    const parent = link.parentElement;
    closeLinkDialog();
    link.remove();
    if (parent && parent.classList.contains("pub-links") && !parent.querySelector("a")) {
      // keep empty .pub-links so + DOI / + Link still work
    }
    savePage(true);
    toast("Link removed");
  };

  const ensurePubLinks = (item) => {
    let box = item.querySelector(".pub-links");
    if (!box) {
      box = document.createElement("div");
      box.className = "pub-links";
      const body = item.querySelector(".pub-body, .featured-body") || item;
      const actions = item.querySelector(":scope > .edit-item-actions");
      if (actions && actions.parentElement === body) body.insertBefore(box, actions);
      else body.appendChild(box);
    }
    return box;
  };

  const createPubLink = (href, label) => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = label;
    return a;
  };

  const mountLinkAddControls = () => {
    main.querySelectorAll(".pub, .featured-pub, .standards-list > li").forEach((item) => {
      if (item.querySelector(".edit-link-add")) return;
      const wrap = document.createElement("div");
      wrap.className = "edit-link-add";
      wrap.contentEditable = "false";
      wrap.innerHTML = `
        <button type="button" data-add-doi>+ DOI</button>
        <button type="button" data-add-link>+ Link</button>
      `;
      const box = item.matches(".standards-list > li") ? item : ensurePubLinks(item);
      box.appendChild(wrap);
      wrap.querySelector("[data-add-doi]").addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = item.matches(".standards-list > li") ? item : ensurePubLinks(item);
        const link = createPubLink("https://doi.org/", "DOI");
        target.insertBefore(link, wrap);
        openLinkDialog(link);
      });
      wrap.querySelector("[data-add-link]").addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = item.matches(".standards-list > li") ? item : ensurePubLinks(item);
        const link = createPubLink("#", "Link");
        target.insertBefore(link, wrap);
        openLinkDialog(link);
      });
    });
  };

  const onLinkClick = (event) => {
    if (!editing) return;
    if (event.target.closest(".edit-item-actions, .edit-list-add, .edit-toolbar, .edit-link-dialog, .edit-link-add")) return;
    const link = event.target.closest("a");
    if (!link) return;
    const inScope = main.contains(link) || link.classList.contains("logo") || footerEl()?.contains(link);
    if (!inScope) return;
    event.preventDefault();
    event.stopPropagation();
    openLinkDialog(link);
  };

  const enableEditing = () => {
    [main, logoEl(), footerEl()].filter(Boolean).forEach((el) => {
      el.contentEditable = "true";
      el.classList.add("is-site-editing");
    });
    main.spellcheck = true;
    document.body.classList.add("site-editing");
    mountListControls();
    main.addEventListener("click", onImgClick, true);
    main.addEventListener("click", onListActionClick, true);
    main.addEventListener("dragstart", onDragStart, true);
    main.addEventListener("dragover", onDragOver, true);
    main.addEventListener("drop", onDrop, true);
    main.addEventListener("dragend", onDragEnd, true);
    document.addEventListener("click", onLinkClick, true);
  };

  const disableEditing = () => {
    closeLinkDialog();
    stripEditUi(main);
    [main, logoEl(), footerEl()].filter(Boolean).forEach((el) => {
      el.contentEditable = "false";
      el.classList.remove("is-site-editing");
    });
    document.body.classList.remove("site-editing");
    main.removeEventListener("click", onImgClick, true);
    main.removeEventListener("click", onListActionClick, true);
    main.removeEventListener("dragstart", onDragStart, true);
    main.removeEventListener("dragover", onDragOver, true);
    main.removeEventListener("drop", onDrop, true);
    main.removeEventListener("dragend", onDragEnd, true);
    document.removeEventListener("click", onLinkClick, true);
    dragItem = null;
  };

  const setEditing = (next) => {
    editing = next;
    localStorage.setItem(MODE_KEY, editing ? "1" : "0");
    if (editing) enableEditing();
    else disableEditing();
    setButtons();
  };

  const exportHtml = () => {
    savePage(true);
    stripEditUi(document);
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll(".edit-toolbar, .edit-toast, .edit-link-dialog, .edit-item-actions, .edit-list-add, .edit-link-add").forEach((el) => el.remove());
    clone.querySelector("body")?.classList.remove("site-editing");
    clone.querySelectorAll(".is-site-editing").forEach((el) => {
      el.classList.remove("is-site-editing");
      el.removeAttribute("contenteditable");
    });
    const html = "<!DOCTYPE html>\n" + clone.outerHTML;
    const name = (pageKey().slice(STORAGE_PREFIX.length) || "index.html").replace(/\//g, "-");
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    if (editing) mountListControls();
    toast("Downloaded " + name);
  };

  const exportJson = () => {
    savePage(true);
    const payload = {
      exportedAt: new Date().toISOString(),
      pages: {},
    };
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        payload.pages[key.slice(STORAGE_PREFIX.length)] = localStorage.getItem(key);
      }
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "site-content-backup.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported all page backups");
  };

  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const pages = data.pages || data;
        Object.entries(pages).forEach(([name, html]) => {
          if (typeof html === "string") localStorage.setItem(STORAGE_PREFIX + name, html);
        });
        const current = localStorage.getItem(pageKey());
        if (current) {
          applySnapshot(current);
          polishRestored();
          if (editing) mountListControls();
        }
        toast("Backup imported — refresh other pages to see changes");
      } catch (err) {
        toast("Import failed: invalid JSON");
      }
    };
    reader.readAsText(file);
  };

  toolbar.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "toggle") {
      if (editing) savePage(true);
      setEditing(!editing);
      toast(editing ? "Edit mode on — click links to edit/remove DOI; add/remove items; drag to reorder" : "Edit mode off");
      return;
    }
    if (action === "save") {
      savePage();
      return;
    }
    if (action === "export-html") {
      exportHtml();
      return;
    }
    if (action === "export-json") {
      exportJson();
      return;
    }
    if (action === "import-json") {
      fileInput.click();
      return;
    }
    if (action === "reset") {
      if (!window.confirm("Reset this page to the original HTML? Local changes will be lost.")) return;
      localStorage.removeItem(pageKey());
      location.reload();
    }
  });

  linkDialog.addEventListener("click", (event) => {
    if (event.target === linkDialog) {
      closeLinkDialog();
      return;
    }
    const btn = event.target.closest("button");
    if (!btn) return;
    if (btn.hasAttribute("data-link-save")) applyLinkDialog();
    else if (btn.hasAttribute("data-link-remove")) {
      if (!window.confirm("Remove this link completely?")) return;
      removeActiveLink();
    } else if (btn.hasAttribute("data-link-cancel")) closeLinkDialog();
  });

  linkDialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLinkDialog();
    } else if (event.key === "Enter" && event.target.matches("input")) {
      event.preventDefault();
      applyLinkDialog();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!editing) return;
    if (event.key === "Escape" && !linkDialog.hidden) {
      event.preventDefault();
      closeLinkDialog();
    }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) importJson(file);
    fileInput.value = "";
  });

  document.addEventListener(
    "blur",
    (event) => {
      if (!editing) return;
      if (event.target.closest?.(".edit-item-actions, .edit-list-add, .edit-toolbar")) return;
      const t = event.target;
      if (t === main || main.contains(t) || t === logoEl() || footerEl()?.contains(t)) {
        savePage(true);
      }
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (!editing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      savePage();
    }
  });

  setButtons();
  if (editing) enableEditing();
  syncHomeNewsFromSource().then(() => {
    if (editing && document.body.getAttribute("data-page") === "home") {
      mountListControls();
    }
  });
})();
