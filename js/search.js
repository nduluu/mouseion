// Search Mouseion's own catalog. Every work and author appears once, whatever
// language or spelling the visitor uses ("Iliad", "Ilias", "Илиада", "Ἰλιάς",
// "Homer", "Omero"...); editions and translations live inside the work's page.
const Search = (() => {
  const { t, el, catalog, workCard, authorCard } = M;
  let els = null;

  // Lower-case, strip accents and breathings (so "ilias" finds "Ἰλιάς"),
  // and treat final sigma like sigma.
  function norm(s) {
    return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ");
  }

  function matchesAll(strings, q) {
    const hay = norm(strings.join(" "));
    return norm(q).split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
  }

  async function run(q) {
    q = (q || "").trim();
    els.input.value = q;
    els.results.textContent = "";
    if (!q) {
      els.input.focus();
      return;
    }
    let works = [], authors = [];
    try {
      const cat = await catalog();
      authors = cat.authors.filter((a) => matchesAll(Object.values(a.names), q));
      works = cat.works.filter((w) => matchesAll([...Object.values(w.titles), ...Object.values(w.author)], q));
    } catch (e) {
      console.error(e);
    }
    els.results.textContent = "";
    if (!works.length && !authors.length) {
      els.results.appendChild(el("p", "search-empty", t("nothingFound")));
      return;
    }
    for (const a of authors) els.results.appendChild(authorCard(a));
    for (const w of works) els.results.appendChild(workCard(w));
  }

  // Route to the results page; the router then calls run().
  function go(q) {
    q = (q || "").trim();
    if (!q) return;
    Router.go("/search?q=" + encodeURIComponent(q));
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
