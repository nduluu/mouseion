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

  function renderLangList(filter) {
    const q = (filter || "").trim().toLowerCase();
    langList.textContent = "";
    let count = 0;
    for (const lang of LANGUAGES) {
      if (
        q &&
        !lang.n.toLowerCase().includes(q) &&
        !lang.e.toLowerCase().includes(q) &&
        !lang.c.toLowerCase().includes(q)
      ) {
        continue;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lang-option";
      btn.setAttribute("role", "option");
      btn.dir = lang.rtl ? "rtl" : "ltr";
      btn.lang = lang.c;

      const endonym = document.createElement("span");
      endonym.className = "endonym";
      endonym.textContent = lang.n;

      btn.append(endonym);
      btn.addEventListener("click", () => selectLanguage(lang.c));
      langList.appendChild(btn);
      count++;
    }
    noResults.hidden = count > 0;
  }

  function selectLanguage(code) {
    localStorage.setItem(LANG_KEY, code);
    applyLanguage(code);
    gate.hidden = true;
    site.hidden = false;
    routeFromHash();
  }

  function openGate() {
    langSearch.value = "";
    renderLangList("");
    gate.hidden = false;
    langSearch.focus();
  }

  langSearch.addEventListener("input", () => renderLangList(langSearch.value));
  langBtn.addEventListener("click", openGate);

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
    account: accountSection,
    about: document.getElementById("about"),
    privacy: document.getElementById("privacy"),
    terms: document.getElementById("terms"),
    app: document.getElementById("app"),
    legal: document.getElementById("legal"),
  };

  function showView(name) {
    if (!VIEWS[name]) name = "home";
    for (const v in VIEWS) VIEWS[v].hidden = v !== name;
    if (name === "account") renderAccount();
    window.scrollTo(0, 0);
  }

  function routeFromHash() {
    const name = location.hash.replace(/^#\/?/, "");
    showView(VIEWS[name] ? name : "home");
  }

  window.addEventListener("hashchange", routeFromHash);
  accountBtn.addEventListener("click", () => { location.hash = "#/account"; });
  document.getElementById("back-btn").addEventListener("click", () => { location.hash = "#/home"; });

  signinForm.addEventListener("submit", (e) => {
    e.preventDefault();
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
    applyTheme("system");
    renderAccount();
  });

  // ---------- Init ----------

  document.getElementById("copyright-year").textContent = new Date().getFullYear();

  const initUser = getUser();
  if (initUser && initUser.theme) applyTheme(initUser.theme);

  const saved = localStorage.getItem(LANG_KEY);
  if (saved && byCode[saved]) {
    applyLanguage(saved);
    site.hidden = false;
    routeFromHash();
  } else {
    openGate();
  }
})();
