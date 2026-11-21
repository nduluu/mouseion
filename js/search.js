// Federated search: one query sent to several open collections at once.
// Each source renders into its own column as soon as it answers, so a slow
// source never holds up the others. Add a collection by adding to SOURCES.
const Search = (() => {
  const PER_SOURCE = 10;

  // Language editions of Wikisource (subdomains). Other languages use the
  // multilingual wikisource.org.
  const WIKISOURCE_LANGS = new Set([
    "ar", "as", "az", "be", "bg", "bn", "br", "bs", "ca", "cs", "cy", "da", "de",
    "el", "en", "eo", "es", "et", "eu", "fa", "fi", "fo", "fr", "gl", "gu", "he",
    "hi", "hr", "hu", "hy", "id", "is", "it", "ja", "jv", "ka", "kn", "ko", "la",
    "lt", "mk", "ml", "mr", "ms", "nl", "no", "or", "pa", "pl", "pt", "ro", "ru",
    "sa", "sk", "sl", "sr", "sv", "ta", "te", "th", "tr", "uk", "vi", "yi", "zh",
  ]);

  function uiLang() {
    return (document.documentElement.lang || "en").split("-")[0];
  }

  function t(key) {
    const lang = document.documentElement.lang;
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }

  // Internet Archive takes Lucene syntax; drop operator characters so any
  // text the visitor types is searched as plain words.
  function plainWords(q) {
    return q.replace(/[+\-&|!(){}\[\]^"~*?:\\\/]/g, " ").replace(/\s+/g, " ").trim();
  }

  const SOURCES = [
    {
      id: "openlibrary",
      name: "Open Library",
      seeAll: (q) => "https://openlibrary.org/search?q=" + encodeURIComponent(q),
      async fetch(q, signal) {
        const url = "https://openlibrary.org/search.json?" + new URLSearchParams({
          q,
          limit: PER_SOURCE,
          lang: uiLang(),
          fields: "key,title,author_name,first_publish_year,cover_i,ebook_access",
        });
        const data = await getJSON(url, signal);
        return {
          total: data.numFound,
          items: data.docs.map((d) => ({
            title: d.title,
            url: "https://openlibrary.org" + d.key,
            by: (d.author_name || []).slice(0, 3).join(", "),
            year: d.first_publish_year,
            thumb: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-S.jpg` : null,
            free: d.ebook_access === "public",
          })),
        };
      },
    },
    {
      id: "archive",
      name: "Internet Archive",
      seeAll: (q) => "https://archive.org/search?query=" + encodeURIComponent(q) + "&sin=TXT",
      async fetch(q, signal) {
        const words = plainWords(q);
        if (!words) return { total: 0, items: [] };
        const params = new URLSearchParams({
          q: `(${words}) AND mediatype:(texts)`,
          rows: PER_SOURCE,
          output: "json",
        });
        for (const f of ["identifier", "title", "creator", "year"]) params.append("fl[]", f);
        const data = await getJSON("https://archive.org/advancedsearch.php?" + params, signal);
        const first = (v) => (Array.isArray(v) ? v[0] : v);
        return {
          total: data.response.numFound,
          items: data.response.docs.map((d) => ({
            title: first(d.title) || d.identifier,
            url: "https://archive.org/details/" + encodeURIComponent(d.identifier),
            by: [].concat(d.creator || []).slice(0, 3).join(", "),
            year: first(d.year),
            thumb: "https://archive.org/services/img/" + encodeURIComponent(d.identifier),
          })),
        };
      },
    },
    {
      id: "wikisource",
      name: "Wikisource",
      host() {
        const l = uiLang();
        return WIKISOURCE_LANGS.has(l) ? l + ".wikisource.org" : "wikisource.org";
      },
      seeAll(q) {
        return `https://${this.host()}/w/index.php?search=${encodeURIComponent(q)}&fulltext=1`;
      },
      async fetch(q, signal) {
        const host = this.host();
        const url = `https://${host}/w/api.php?` + new URLSearchParams({
          action: "query",
          list: "search",
          srsearch: q,
          srlimit: PER_SOURCE,
          srprop: "", // titles only: the excerpts contain raw page markup and IDs
          format: "json",
          origin: "*",
        });
        // Wikimedia asks browser apps to identify themselves with this header.
        const data = await getJSON(url, signal, { "Api-User-Agent": "Mouseion/0.1" });
        return {
          total: data.query.searchinfo.totalhits,
          items: data.query.search.map((s) => ({
            title: s.title,
            url: `https://${host}/wiki/` + encodeURIComponent(s.title.replace(/ /g, "_")),
          })),
        };
      },
    },
  ];

  // Fetch JSON; if the source says "too many requests" (429), wait and retry once.
  async function getJSON(url, signal, headers) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { signal, headers });
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }
  }

  let els = null;
  let controller = null;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function resultItem(it) {
    const li = el("li", "result");
    const a = el("a", "result-link");
    a.href = it.url;
    a.target = "_blank";
    a.rel = "noopener";

    if (it.thumb) {
      const img = el("img", "result-thumb");
      img.src = it.thumb;
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", () => img.remove());
      a.appendChild(img);
    }

    const body = el("div", "result-body");
    const title = el("span", "result-title", it.title);
    title.dir = "auto";
    body.appendChild(title);

    const meta = [it.by, it.year].filter(Boolean).join(" · ");
    if (meta) {
      const m = el("span", "result-meta", meta);
      m.dir = "auto";
      body.appendChild(m);
    }
    if (it.free) body.appendChild(el("span", "result-free", t("readOnline")));

    a.appendChild(body);
    li.appendChild(a);
    return li;
  }

  function seeAllLink(src, q) {
    const a = el("a", "source-more", t("seeAll") + " ↗");
    a.href = src.seeAll(q);
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function sourceColumn(src, q, signal) {
    const col = el("section", "source");
    const head = el("header", "source-head");
    head.appendChild(el("h2", "source-name", src.name));
    const count = el("span", "source-count");
    head.appendChild(count);
    col.appendChild(head);

    const status = el("p", "source-status", t("searching"));
    col.appendChild(status);
    const list = el("ol", "results");
    col.appendChild(list);

    src.fetch(q, signal).then(
      ({ total, items }) => {
        if (signal.aborted) return;
        status.remove();
        if (!items.length) {
          col.insertBefore(el("p", "source-status", t("nothingFound")), list);
          return;
        }
        count.textContent = new Intl.NumberFormat(document.documentElement.lang).format(total);
        for (const it of items) list.appendChild(resultItem(it));
        col.appendChild(seeAllLink(src, q));
      },
      (err) => {
        if (signal.aborted) return;
        status.textContent = t("sourceUnavailable");
        status.classList.add("error");
        // Still offer the way to search that collection on its own site.
        col.appendChild(seeAllLink(src, q));
        console.warn(src.name, err);
      }
    );
    return col;
  }

  function run(q) {
    q = (q || "").trim();
    els.input.value = q;
    if (controller) controller.abort();
    els.results.textContent = "";
    if (!q) {
      els.input.focus();
      return;
    }
    controller = new AbortController();
    for (const src of SOURCES) els.results.appendChild(sourceColumn(src, q, controller.signal));
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
