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
  }

  function openGate() {
    langSearch.value = "";
    renderLangList("");
    gate.hidden = false;
    langSearch.focus();
  }

  langSearch.addEventListener("input", () => renderLangList(langSearch.value));
  langBtn.addEventListener("click", openGate);

  // ---------- Account ----------

  function renderAccount() {
    const user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    signinForm.hidden = !!user;
    signedIn.hidden = !user;
    if (user) accDisplay.textContent = user.name;
  }

  function showAccount(show) {
    accountSection.hidden = !show;
    home.hidden = show;
    if (show) renderAccount();
  }

  accountBtn.addEventListener("click", () => showAccount(true));
  document.getElementById("back-btn").addEventListener("click", () => showAccount(false));

  signinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        name: document.getElementById("acc-name").value.trim(),
        email: document.getElementById("acc-email").value.trim(),
      })
    );
    renderAccount();
  });

  document.getElementById("signout-btn").addEventListener("click", () => {
    localStorage.removeItem(USER_KEY);
    signinForm.reset();
    renderAccount();
  });

  // ---------- Init ----------

  const saved = localStorage.getItem(LANG_KEY);
  if (saved && byCode[saved]) {
    applyLanguage(saved);
    site.hidden = false;
  } else {
    openGate();
  }
})();
