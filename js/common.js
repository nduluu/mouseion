// Small helpers shared by search, category and author pages.
const M = (() => {

  function lang() {
    return document.documentElement.lang || "en";
  }

  // Interface text, with {placeholders}.
  function t(key, vars) {
    const l = lang();
    let s = (I18N[l] && I18N[l][key]) || I18N.en[key] || key;
    for (const k in vars || {}) s = s.replace("{" + k + "}", vars[k]);
    return s;
  }

  // The value for the UI language from a {lang: value} map.
  function pick(map) {
    if (!map) return "";
    if (typeof map === "string") return map;
    const l = lang();
    return map[l] || map[l.split("-")[0]] || map.en || Object.values(map)[0];
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Names browsers often lack (they return the bare code).
  const EXTRA_LANGS = {
    grc: { en: "Ancient Greek", de: "Altgriechisch", fr: "Grec ancien", it: "Greco antico", es: "Griego antiguo",
           pt: "Grego antigo", ru: "Древнегреческий", el: "Αρχαία ελληνικά", nl: "Oudgrieks", pl: "Starogrecki",
           tr: "Antik Yunanca", ar: "اليونانية القديمة", he: "יוונית עתיקה", ja: "古代ギリシャ語",
           "zh-Hans": "古希腊语", "zh-Hant": "古希臘語", ko: "고대 그리스어" },
  };

  function langName(code) {
    let name = null;
    try {
      name = new Intl.DisplayNames([lang(), "en"], { type: "language" }).of(code);
    } catch (e) { /* use fallback */ }
    if (name && name !== code) return name;
    return EXTRA_LANGS[code] ? pick(EXTRA_LANGS[code]) : code;
  }

  // ---------- the catalogue (built by tools/build_catalog.py) ----------
  // Many small files, fetched as a page needs them and kept for the visit.
  const cache = new Map();
  function getData(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch(path).then((r) => {
        if (!r.ok) throw new Error(path + ": HTTP " + r.status);
        return r.json();
      }));
    }
    return cache.get(path);
  }

  // Categories, counts per term and language, authors per letter.
  const catalogIndex = () => getData("data/catalog/index.json");
  // One work's or author's card.
  const workInfo = (id) => getData("data/catalog/works/" + encodeURIComponent(id) + ".json");
  const authorInfo = (id) => getData("data/catalog/authors/" + encodeURIComponent(id) + ".json");
  // The works (and authors) filed under a term; for a language
  // { written, readable, listed }.
  const termInfo = (cat, id) => getData("data/catalog/terms/" + cat + "/" + encodeURIComponent(id) + ".json");
  // The author cards for one letter ("#": names not starting with A–Z).
  const authorsByLetter = (l) => getData("data/catalog/authors-az/" + (l === "#" ? "_" : l) + ".json");

  // Cards for a list of ids; ids without a card are left out.
  const cards = (ids, info) => Promise.all(ids.map((id) => info(id).catch(() => null))).then((l) => l.filter(Boolean));

  // Lower-case, strip accents and breathings (so "ilias" finds "Ἰλιάς"),
  // and treat final sigma like sigma. Same as fold() in tools/build_catalog.py.
  function norm(s) {
    return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ");
  }

  // Search every title and name, in every language. The words are filed by
  // their first two letters (data/search/<letters>.json), so a search reads a
  // few small files whatever the size of the catalogue. Every word of the
  // query must begin a word of the same work's titles or author's names.
  async function searchCatalog(q, limit = 100) {
    const words = [...new Set(norm(q).split(/[^\p{L}\p{N}]+/u).filter((w) => [...w].length >= 2))];
    if (!words.length) return { works: [], authors: [] };
    let hits = null;
    for (const w of words) {
      const key = [...w].slice(0, 2).map((c) => c.codePointAt(0).toString(16)).join("-");
      let shard = {};
      try { shard = await getData("data/search/" + key + ".json"); } catch (e) { /* no word starts so */ }
      const found = new Set();
      for (const word in shard) if (word.startsWith(w)) shard[word].forEach((r) => found.add(r));
      hits = hits ? new Set([...hits].filter((r) => found.has(r))) : found;
      if (!hits.size) break;
    }
    const refs = [...hits].slice(0, limit);
    return {
      works: await cards(refs.filter((r) => r.startsWith("w:")).map((r) => r.slice(2)), workInfo),
      authors: await cards(refs.filter((r) => r.startsWith("a:")).map((r) => r.slice(2)), authorInfo),
    };
  }

  // Name of a category term (era, genre, field, religion) in the UI language.
  function termName(cat, id, taxonomy) {
    const term = (taxonomy[cat] || []).find((x) => x.id === id);
    return term ? pick(term.names) : id;
  }

  // A link card for a work: title, author, original title, counts.
  function workCard(w) {
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

  function authorCard(a) {
    const card = el("a", "work-result");
    card.href = "#/author/" + a.id;
    card.appendChild(el("span", "work-result-title", pick(a.names)));
    const sub = el("span", "work-result-sub", [a.originalName && a.names[a.originalName], pick(a.dates)].filter(Boolean).join(" · "));
    if (a.originalName) sub.lang = a.originalName;
    card.appendChild(sub);
    card.appendChild(el("span", "work-result-meta", t("worksCount", { n: a.works.length + (a.otherWorks || 0) })));
    return card;
  }

  return { lang, t, pick, el, langName, catalogIndex, workInfo, authorInfo, termInfo, authorsByLetter, cards,
    searchCatalog, termName, workCard, authorCard };
})();
window.M = M;
