(function () {
  const LANG_KEY = "mouseion.lang";
  const USER_KEY = "mouseion.user";

  const gate = document.getElementById("language-gate");
  const site = document.getElementById("site");
  const langList = document.getElementById("lang-list");
  const langSearch = document.getElementById("lang-search");
  const noResults = document.getElementById("no-results");
  const langBtn = document.getElementById("lang-btn");
  const langBtnLabel = document.getElementById("lang-btn-label");
  const accountBtn = document.getElementById("account-btn");
  const home = document.getElementById("home");
  const accountSection = document.getElementById("account");
  const signinForm = document.getElementById("signin-form");
  const signedIn = document.getElementById("signed-in");
  const accDisplay = document.getElementById("acc-display");
  const themeSelect = document.getElementById("theme-select");

  const byCode = Object.fromEntries(LANGUAGES.map((l) => [l.c, l]));

  function t(key) {
    const lang = document.documentElement.lang;
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }

  function translatePage() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAria));
    });
  }

  function applyLanguage(code) {
    const lang = byCode[code];
    if (!lang) return;
    document.documentElement.lang = lang.c;
    document.documentElement.dir = lang.rtl ? "rtl" : "ltr";
    langBtnLabel.textContent = lang.n;
    translatePage();
    if (window.TimeCal) TimeCal.setLanguage(lang.c, !!lang.rtl);
  }

  // ---------- Language gate ----------

  // Lower case, without accents or apostrophe-like marks, so that a Latin
  // keyboard finds "Español" with "espanol" and "ʻŌlelo" with "olelo".
  const fold = (x) => x.normalize("NFD").replace(/[\u0300-\u036f'ʻʼ’`]/g, "").toLowerCase();

  function matchesQuery(lang, q) {
    if (!q) return true;
    const f = fold(q);
    return [lang.n, lang.e, lang.c, ...(lang.a || [])].some((x) => fold(x).includes(f));
  }

  function langCard(lang) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-option";
    btn.setAttribute("role", "option");
    btn.dir = lang.rtl ? "rtl" : "ltr";
    btn.lang = lang.c;
    btn.textContent = lang.n;
    btn.addEventListener("click", () => selectLanguage(lang.c));
    return btn;
  }

  function familyBlock(g, q) {
    const langs = g.codes
      .map((c) => byCode[c])
      .filter((l) => l && matchesQuery(l, q));
    if (!langs.length) return { block: null, count: 0 };

    const family = document.createElement("div");
    family.className = "family" + (g.rtl ? " rtl" : "");
    if (g.rtl) family.dir = "rtl";

    const heading = document.createElement("h3");
    heading.className = "family-name";
    heading.textContent = g.name;
    family.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "family-grid";
    for (const lang of langs) grid.appendChild(langCard(lang));
    family.appendChild(grid);
    return { block: family, count: langs.length };
  }

  const bySpeakers = (a, b) => (b.speakers || 0) - (a.speakers || 0);
  let currentFilter = "";

  // Number of masonry columns from the container width (always at least two).
  function columnCount() {
    const avail = langList.clientWidth || 900;
    const colPx = 13 * 16;
    const gap = 24;
    return Math.max(2, Math.floor((avail + gap) / (colPx + gap)));
  }

  // Families ordered most-spoken first. The primarily-RTL families (Semitic,
  // Iranian) are pinned to the top of the rightmost column so they stay grouped
  // on the right; remaining families are packed shortest-first so the biggest
  // families sit across the top and no column is left with a large empty gap.
  function renderLangList(filter) {
    if (filter !== undefined) currentFilter = filter;
    const q = (currentFilter || "").trim().toLowerCase();
    langList.textContent = "";
    let count = 0;

    const n = columnCount();
    const cols = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "col";
      langList.appendChild(el);
      cols.push({ el, weight: 0 });
    }
    const rightCol = cols[cols.length - 1];

    // RTL families first, pinned to the top of the rightmost column.
    for (const g of LANGUAGE_GROUPS.filter((x) => x.rtl).sort(bySpeakers)) {
      const { block, count: c } = familyBlock(g, q);
      if (!block) continue;
      rightCol.el.appendChild(block);
      rightCol.weight += c + 1.6;
      count += c;
    }

    // LTR families packed into the shortest column at each step.
    for (const g of LANGUAGE_GROUPS.filter((x) => !x.rtl).sort(bySpeakers)) {
      const { block, count: c } = familyBlock(g, q);
      if (!block) continue;
      const target = cols.reduce((a, b) => (b.weight < a.weight ? b : a));
      target.el.appendChild(block);
      target.weight += c + 1.6; // cards + heading
      count += c;
    }

    noResults.hidden = count > 0;
  }

  // While the picker is open, its title and search hint cross-fade from one
  // language into another, chosen at random. Both texts are layered, so the
  // new language appears while the old one fades away.
  const gateTitle = document.getElementById("gate-title");
  const searchHint = document.getElementById("lang-search-ph");
  const CYCLE_MS = 3000, FADE_MS = 900;
  let cycleTimer = null, cycleCode = null;
  const cycleCodes = Object.keys(I18N).filter((c) => I18N[c].chooseLanguage && I18N[c].searchLanguages);

  function crossfade(box, text, code, instant) {
    const lang = byCode[code];
    // The outer span keeps the page's language, so its font (and with it the
    // line's baseline) never changes; the text sits inside with its own lang
    // and no line height. Safari picks a different system font per language,
    // which otherwise moved the text up and down as the languages changed.
    const span = document.createElement("span");
    span.className = "xf";
    span.dir = lang && lang.rtl ? "rtl" : "ltr";
    const inner = document.createElement("span");
    inner.className = "xt";
    inner.textContent = text;
    inner.lang = code;
    span.appendChild(inner);
    const old = [...box.children];
    if (instant) {
      box.textContent = "";
      box.appendChild(span);
      return;
    }
    span.style.opacity = "0";
    box.appendChild(span);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      span.style.opacity = "1";
      for (const o of old) o.style.opacity = "0";
    }));
    setTimeout(() => old.forEach((o) => o.remove()), FADE_MS + 100);
  }

  function showGateIn(code, instant) {
    cycleCode = code;
    crossfade(gateTitle, I18N[code].chooseLanguage, code, instant);
    crossfade(searchHint, I18N[code].searchLanguages, code, instant);
    langSearch.placeholder = I18N[code].searchLanguages; // for screen readers
  }

  function cycleStep() {
    if (gate.hidden) return stopCycle();
    let next;
    do next = cycleCodes[Math.floor(Math.random() * cycleCodes.length)];
    while (cycleCodes.length > 1 && next === cycleCode);
    showGateIn(next, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function startCycle() {
    stopCycle();
    // Start from the language the picker is shown in now.
    const code = document.documentElement.lang || "en";
    const current = I18N[code] && I18N[code].chooseLanguage ? code : "en";
    showGateIn(current, true);
    if (cycleCodes.length) cycleTimer = setInterval(cycleStep, CYCLE_MS);
  }

  function stopCycle() {
    clearInterval(cycleTimer);
    cycleTimer = null;
  }

  // A language's interface text is its own small file (i18n/<code>.js),
  // fetched when the language is chosen.
  function loadLanguage(code) {
    if (!code || (window.I18N_LOADED || {})[code]) return Promise.resolve();
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "i18n/" + code + ".js?v=" + (window.I18N_V || "");
      s.onload = s.onerror = () => resolve(); // missing file: English is the fallback
      document.head.appendChild(s);
    });
  }

  async function selectLanguage(code) {
    stopCycle();
    localStorage.setItem(LANG_KEY, code);
    await loadLanguage(code);
    applyLanguage(code);
    gate.hidden = true;
    site.hidden = false;
    routeFromHash();
  }

  const gateClose = document.getElementById("gate-close");

  function openGate() {
    langSearch.value = "";
    // Changing language during a visit can be cancelled; the first choice can't.
    gateClose.hidden = !localStorage.getItem(LANG_KEY);
    gate.hidden = false; // show first so the container width is measurable
    renderLangList("");
    langSearch.focus();
    startCycle();
  }

  // Keep the current language and return to the page.
  function closeGate() {
    if (gateClose.hidden || gate.hidden) return;
    stopCycle();
    gate.hidden = true;
    langBtn.focus();
  }

  langSearch.addEventListener("input", () => renderLangList(langSearch.value));
  langBtn.addEventListener("click", openGate);
  gateClose.addEventListener("click", closeGate);
  document.addEventListener("keydown", (e) => {
    // In the search box, Escape first clears what was typed.
    if (e.key === "Escape" && !gate.hidden && !(e.target === langSearch && langSearch.value)) closeGate();
  });

  // Re-flow the family columns when the width changes.
  let resizeTimer;
  window.addEventListener("resize", () => {
    if (gate.hidden) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderLangList(), 150);
  });

  // ---------- Theme ----------

  // "system" follows prefers-color-scheme (no attribute); "light"/"dark" force it.
  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  // ---------- Account ----------

  function getUser() {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  }

  function renderAccount() {
    const user = getUser();
    signinForm.hidden = !!user;
    signedIn.hidden = !user;
    if (user) {
      accDisplay.textContent = user.name;
      themeSelect.value = user.theme || "system";
      // The personal citation format (js/cite.js).
      if (window.Cite) {
        Cite.renderSettings(document.getElementById("cite-settings"), user, (patch) => {
          const now = getUser();
          if (now) localStorage.setItem(USER_KEY, JSON.stringify(Object.assign(now, patch)));
        });
      }
    }
  }

  themeSelect.addEventListener("change", () => {
    const user = getUser();
    if (!user) return;
    user.theme = themeSelect.value;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    applyTheme(user.theme);
  });

  // ---------- Navigation (hash routing) ----------

  // View name -> section element. "home" is the default landing view.
  const VIEWS = {
    home: home,
    search: document.getElementById("search"),
    work: document.getElementById("work"),
    browse: document.getElementById("browse"),
    account: accountSection,
    about: document.getElementById("about"),
    privacy: document.getElementById("privacy"),
    terms: document.getElementById("terms"),
    app: document.getElementById("app"),
    legal: document.getElementById("legal"),
    roadmap: document.getElementById("roadmap"),
    notes: document.getElementById("notes"),
  };

  // Routes that share a section: author and category pages use "browse".
  const ALIASES = { authors: "browse", author: "browse" };

  function showView(route, params, args) {
    let name = ALIASES[route] || route;
    if (!VIEWS[name]) name = route = "home";
    for (const v in VIEWS) VIEWS[v].hidden = v !== name;
    document.title = "Mouseion"; // a work page sets its own title
    if (name === "browse" && window.Browse) Browse.render(route, args);
    if (name === "account") renderAccount();
    if (name === "notes" && window.Notes) Notes.renderPage();
    if (name === "home" && window.TimeCal) TimeCal.onShow();
    if (name === "search" && window.Search) Search.run(params.get("q"));
    if (name === "work" && window.Work) Work.render(args[0], params);
    window.scrollTo(0, 0);
  }

  // Routes (see js/router.js): "/view", "/view/arg", "/view?key=value", or a
  // work: "/iliad[/text[/book[/lines or pPage]]]", e.g. "/iliad/ita-monti/1/7-10".
  function routeFromHash() {
    const [path, query] = Router.current().split("?");
    let segs = path.split("/").filter(Boolean);
    try { segs = segs.map(decodeURIComponent); } catch (e) { /* keep as is */ }
    const params = new URLSearchParams(query || "");
    if (!segs.length) return showView("home", params, []);
    const [name, ...args] = segs;
    if (name === "work") return args[0] ? showView("work", params, args) : showView("home", params, []);
    if (VIEWS[name] || ALIASES[name]) return showView(name, params, args);
    // Anything else names a work.
    const [text, book, ref] = args;
    if (text) params.set("slug", text);
    if (book) params.set("book", book);
    let m;
    if (ref && (m = ref.match(/^(\d+)(?:-(\d+))?$/))) {
      params.set("line", m[1]);
      if (m[2]) params.set("to", m[2]);
    } else if (ref && (m = ref.match(/^(?:([IVXLC]+)-)?p(.+)$/i))) {
      params.set("page", m[2]);
      if (m[1]) params.set("vol", m[1].toUpperCase());
    }
    showView("work", params, [name]);
  }

  Router.onChange(routeFromHash);
  accountBtn.addEventListener("click", () => Router.go("/account"));
  document.getElementById("back-btn").addEventListener("click", () => Router.go("/"));

  // Missing name or email: a message in the visitor's language under the
  // box, and the box outlined in red, until it is filled in.
  const accName = document.getElementById("acc-name");
  const accEmail = document.getElementById("acc-email");
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const fieldChecks = [
    [accName, () => accName.value.trim() !== ""],
    [accEmail, () => EMAIL.test(accEmail.value.trim())],
  ];
  function showFieldError(input, bad) {
    input.classList.toggle("invalid", bad);
    input.setAttribute("aria-invalid", bad ? "true" : "false");
    document.getElementById(input.id + "-error").hidden = !bad;
  }
  for (const [input, ok] of fieldChecks) {
    input.addEventListener("input", () => {
      if (input.classList.contains("invalid") && ok()) showFieldError(input, false);
    });
  }
  function clearFieldErrors() {
    for (const [input] of fieldChecks) showFieldError(input, false);
  }

  signinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    let first = null;
    for (const [input, ok] of fieldChecks) {
      const bad = !ok();
      showFieldError(input, bad);
      if (bad && !first) first = input;
    }
    if (first) { first.focus(); return; }
    const existing = getUser();
    const user = {
      name: document.getElementById("acc-name").value.trim(),
      email: document.getElementById("acc-email").value.trim(),
      theme: (existing && existing.theme) || "system",
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    applyTheme(user.theme);
    renderAccount();
  });

  document.getElementById("signout-btn").addEventListener("click", () => {
    localStorage.removeItem(USER_KEY);
    signinForm.reset();
    clearFieldErrors();
    applyTheme("system");
    renderAccount();
  });

  // ---------- Init ----------

  document.getElementById("copyright-year").textContent = new Date().getFullYear();

  const initUser = getUser();
  if (initUser && initUser.theme) applyTheme(initUser.theme);

  const saved = localStorage.getItem(LANG_KEY);
  if (saved && byCode[saved]) {
    // Normally already loaded by the page itself; fetched here if not.
    loadLanguage(saved).then(() => {
      applyLanguage(saved);
      site.hidden = false;
      routeFromHash();
    });
  } else {
    openGate();
  }
})();
