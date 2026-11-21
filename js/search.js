// Search Mouseion's own catalog. Every work appears once, whatever language or
// spelling the visitor uses ("Iliad", "Ilias", "Илиада", "Ἰλιάς", "Homer"...);
// its editions and translations are inside the work's page.
const Search = (() => {
  let catalog = null;
  let els = null;

  function lang() {
    return document.documentElement.lang || "en";
  }

  function t(key, vars) {
    const l = lang();
    let s = (I18N[l] && I18N[l][key]) || I18N.en[key] || key;
    for (const k in vars || {}) s = s.replace("{" + k + "}", vars[k]);
    return s;
  }

  function pick(map) {
    const l = lang();
    return map[l] || map[l.split("-")[0]] || map.en || Object.values(map)[0];
  }

  // Lower-case, strip accents and breathings (so "ilias" finds "Ἰλιάς"),
  // and treat final sigma like sigma.
  function norm(s) {
    return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ");
  }

  function matches(work, q) {
    const hay = norm([...Object.values(work.titles), ...Object.values(work.author)].join(" "));
    return norm(q).split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
  }

  async function loadCatalog() {
    if (!catalog) catalog = fetch("data/catalog.json").then((r) => r.json());
    return catalog;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function resultCard(w) {
    const a = el("a", "work-result");
    a.href = "#/work/" + w.id;
    a.appendChild(el("span", "work-result-title", pick(w.titles)));
    const sub = el("span", "work-result-sub", pick(w.author) + " · ");
    const orig = el("span", null, w.titles[w.originalLanguage]);
    orig.lang = w.originalLanguage;
    sub.appendChild(orig);
    a.appendChild(sub);
    a.appendChild(el("span", "work-result-meta", t("editionsCount", { e: w.editions, t: w.translations })));
    return a;
  }

  async function run(q) {
    q = (q || "").trim();
    els.input.value = q;
    els.results.textContent = "";
    if (!q) {
      els.input.focus();
      return;
    }
    let works = [];
    try {
      works = (await loadCatalog()).filter((w) => matches(w, q));
    } catch (e) {
      console.error(e);
    }
    els.results.textContent = "";
    if (!works.length) {
      els.results.appendChild(el("p", "search-empty", t("nothingFound")));
      return;
    }
    for (const w of works) els.results.appendChild(resultCard(w));
  }

  // Route to the results page; the router then calls run().
  function go(q) {
    q = (q || "").trim();
    if (!q) return;
    const hash = "#/search?q=" + encodeURIComponent(q);
    if (location.hash === hash) run(q); // same address: no hashchange, so re-run here
    else location.hash = hash;
  }

  function init() {
    els = {
      input: document.getElementById("search-input"),
      results: document.getElementById("search-results"),
    };
    const homeInput = document.getElementById("home-search");
    document.getElementById("home-search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      go(homeInput.value);
    });
    document.getElementById("search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      go(els.input.value);
    });
  }

  init();
  return { run };
})();
window.Search = Search;
