// Search Mouseion's own catalog. Every work and author appears once, whatever
// language or spelling the visitor uses ("Iliad", "Ilias", "Илиада", "Ἰλιάς",
// "Homer", "Omero"...); editions and translations live inside the work's page.
const Search = (() => {
  const { t, el, searchCatalog, workCard, authorCard } = M;
  let els = null;

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
      ({ works, authors } = await searchCatalog(q));
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
