// The six category pages behind the home buttons, plus author pages.
//   /authors[/<letter>]      authors, one letter at a time
//   /author/<id>             one author: names, dates, works
//   /browse/<cat>            terms of a category (era, genre, field, religion, language)
//   /browse/<cat>/<term>     the works filed under one term
const Browse = (() => {
  const { t, pick, el, langName, catalogIndex, workInfo, authorInfo, termInfo, authorsByLetter, cards,
    termName, workCard, authorCard } = M;

  // Category → interface key for its title (the same keys as the home buttons).
  const CATS = {
    era: "catEra",
    genre: "catGenre",
    field: "catAcademic",
    religion: "catReligion",
    language: "catLanguage",
  };

  // Which work field holds a category's terms.
  const WORK_KEY = { era: "era", genre: "genres", field: "fields", religion: "religions" };

  let token = 0;

  function page() {
    const box = document.getElementById("browse-body");
    box.textContent = "";
    return box;
  }

  function crumbs(items) {
    const nav = el("nav", "crumbs");
    items.forEach(([label, href], i) => {
      if (i) nav.appendChild(el("span", "sep", "›"));
      if (href) {
        const a = el("a", null, label);
        a.href = href;
        nav.appendChild(a);
      } else {
        nav.appendChild(el("span", null, label));
      }
    });
    return nav;
  }

  function heading(box, title, sub) {
    box.appendChild(el("h1", "browse-title", title));
    if (sub) box.appendChild(el("p", "browse-sub", sub));
  }

  function list(box, cards) {
    const l = el("div", "card-list");
    cards.forEach((c) => l.appendChild(c));
    box.appendChild(l);
    return l;
  }

  function termCard(href, title, meta, sub) {
    const a = el("a", "work-result");
    a.href = href;
    a.appendChild(el("span", "work-result-title", title));
    if (sub) a.appendChild(el("span", "work-result-sub", sub));
    a.appendChild(el("span", "work-result-meta", meta));
    return a;
  }

  // Languages: the visitor's own (as chosen in the language picker) first,
  // then the languages the works were written in. Other translation
  // languages are reached through the works themselves.
  function languages(idx) {
    const mine = M.lang();
    const originals = Object.keys(idx.languages).filter((c) => idx.languages[c].written);
    const coll = new Intl.Collator(mine);
    originals.sort((a, b) => coll.compare(langName(a), langName(b)));
    return [mine, ...originals.filter((c) => c !== mine && c !== mine.split("-")[0])];
  }

  // ---------- pages ----------

  // Authors, one letter at a time (by the name's Latin spelling), so the
  // page stays small however many authors there are.
  async function authors(letter) {
    const my = ++token;
    const idx = await catalogIndex();
    const letters = Object.keys(idx.letters);
    const cur = letter && idx.letters[letter.toUpperCase()] ? letter.toUpperCase() : letters[0];
    const group = cur ? await authorsByLetter(cur) : [];
    if (my !== token) return;
    const box = page();
    box.appendChild(crumbs([[t("home"), "#/home"], [t("catAuthors")]]));
    heading(box, t("catAuthors"));
    if (letters.length > 1) {
      const nav = el("nav", "letters");
      nav.setAttribute("aria-label", t("catAuthors"));
      for (const l of letters) {
        const a = el("a", "letter" + (l === cur ? " current" : ""), l);
        a.href = "#/authors/" + encodeURIComponent(l);
        if (l === cur) a.setAttribute("aria-current", "page");
        nav.appendChild(a);
      }
      box.appendChild(nav);
    }
    const coll = new Intl.Collator(M.lang());
    list(box, [...group].sort((a, b) => coll.compare(pick(a.names), pick(b.names))).map(authorCard));
  }

  async function author(id) {
    const my = ++token;
    let a, idx, known;
    try {
      [a, idx] = await Promise.all([fetch(`data/authors/${encodeURIComponent(id)}.json`).then((r) => r.json()), catalogIndex()]);
      known = await cards(a.works.filter((e) => e.work).map((e) => e.work), workInfo);
    } catch (e) {
      console.error(e);
      if (my === token) heading(page(), t("nothingFound"));
      return;
    }
    if (my !== token) return;
    const box = page();
    box.appendChild(crumbs([[t("home"), "#/home"], [t("catAuthors"), "#/authors"], [pick(a.names)]]));
    heading(box, pick(a.names));

    const sub = el("p", "browse-sub");
    if (a.originalName && a.names[a.originalName] !== pick(a.names)) {
      const o = el("span", null, a.names[a.originalName]);
      o.lang = a.originalName;
      sub.appendChild(o);
      sub.appendChild(document.createTextNode(" · "));
    }
    sub.appendChild(document.createTextNode(pick(a.dates)));
    box.appendChild(sub);

    if (a.era) {
      const chips = el("div", "chips");
      const c = el("a", "chip", termName("era", a.era, idx.taxonomy));
      c.href = "#/browse/era/" + a.era;
      chips.appendChild(c);
      box.appendChild(chips);
    }

    box.appendChild(el("h2", "panel-title", t("works")));
    const items = a.works.map((entry) => {
      const w = entry.work && known.find((x) => x.id === entry.work);
      if (w) return workCard(w);
      // A work listed for the author but not (yet) in Mouseion.
      const d = el("div", "work-result static");
      d.appendChild(el("span", "work-result-title", pick(entry.titles)));
      if (entry.titles && entry.titles.grc) {
        const g = el("span", "work-result-sub", entry.titles.grc);
        g.lang = "grc";
        d.appendChild(g);
      }
      if (entry.attribution) d.appendChild(el("span", "work-result-note", pick(entry.attribution)));
      d.appendChild(el("span", "work-result-meta", t("notInMouseion")));
      return d;
    });
    list(box, items);
  }

  async function category(catKey) {
    const my = ++token;
    const idx = await catalogIndex();
    if (my !== token) return;
    const box = page();
    box.appendChild(crumbs([[t("home"), "#/home"], [t(CATS[catKey])]]));
    heading(box, t(CATS[catKey]));

    if (catKey === "language") {
      list(box, languages(idx).map((code) => {
        const n = idx.languages[code] || { written: 0, readable: 0, listed: 0 };
        const written = n.written, readable = n.readable, listed = n.listed > 0;
        const meta = [written && t("writtenInCount", { n: written }), readable && t("readableInCount", { n: readable })]
          .filter(Boolean).join(" · ") || (listed ? t("listedOnly") : t("nothingFound"));
        return termCard("#/browse/language/" + code, langName(code), meta);
      }));
      return;
    }
    const terms = idx.taxonomy[catKey] || [];
    list(box, terms.map((term) => {
      const n = (idx.counts[catKey] || {})[term.id] || 0;
      return termCard(`#/browse/${catKey}/${term.id}`, pick(term.names), t("worksCount", { n }), pick(term.range));
    }));
  }

  async function term(catKey, id) {
    const my = ++token;
    const idx = await catalogIndex();
    const filed = await termInfo(catKey, id).catch(() => ({ works: [], authors: [], written: [], readable: [], listed: [] }));
    const lists = {};
    for (const k of ["works", "written", "readable", "listed"]) lists[k] = await cards(filed[k] || [], workInfo);
    const authorCards = await cards(filed.authors || [], authorInfo);
    if (my !== token) return;
    const box = page();

    if (catKey === "language") {
      const name = langName(id);
      box.appendChild(crumbs([[t("home"), "#/home"], [t("catLanguage"), "#/browse/language"], [name]]));
      heading(box, name);
      const groups = [
        ["writtenIn", lists.written],
        ["readableIn", lists.readable],
        ["listedIn", lists.listed],
      ];
      for (const [key, works] of groups) {
        if (!works.length) continue;
        box.appendChild(el("h2", "panel-title", t(key, { language: name })));
        list(box, works.map(workCard));
      }
      return;
    }

    const termRec = (idx.taxonomy[catKey] || []).find((x) => x.id === id);
    const name = termRec ? pick(termRec.names) : id;
    box.appendChild(crumbs([[t("home"), "#/home"], [t(CATS[catKey]), "#/browse/" + catKey], [name]]));
    heading(box, name, termRec && pick(termRec.range));
    if (termRec && termRec.note) box.appendChild(el("p", "browse-bio", pick(termRec.note)));

    const works = lists.works;
    if (authorCards.length) {
      box.appendChild(el("h2", "panel-title", t("catAuthors")));
      list(box, authorCards.map(authorCard));
    }
    box.appendChild(el("h2", "panel-title", t("works")));
    if (works.length) list(box, works.map(workCard));
    else box.appendChild(el("p", "search-empty", t("nothingFound")));
  }

  // args: route pieces after the view name.
  function render(view, args) {
    if (view === "authors") return authors(args[0]);
    if (view === "author") return args[0] ? author(args[0]) : authors();
    const [catKey, id] = args;
    if (!CATS[catKey]) return authors();
    return id ? term(catKey, decodeURIComponent(id)) : category(catKey);
  }

  return { render };
})();
window.Browse = Browse;
