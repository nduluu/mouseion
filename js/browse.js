// The six category pages behind the home buttons, plus author pages.
//   #/authors                 all authors
//   #/author/<id>             one author: names, dates, works
//   #/browse/<cat>            terms of a category (era, genre, field, religion, language)
//   #/browse/<cat>/<term>     the works filed under one term
const Browse = (() => {
  const { t, pick, el, langName, catalog, termName, workCard, authorCard } = M;

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

  const hasTerm = (w, cat, id) => {
    const v = w[WORK_KEY[cat]];
    return Array.isArray(v) ? v.includes(id) : v === id;
  };

  // Languages: the visitor's own (as chosen in the language picker) first,
  // then the languages the works were written in. Other translation
  // languages are reached through the works themselves.
  function languages(works) {
    const mine = M.lang();
    const originals = [...new Set(works.map((w) => w.originalLanguage))];
    const coll = new Intl.Collator(mine);
    originals.sort((a, b) => coll.compare(langName(a), langName(b)));
    return [mine, ...originals.filter((c) => c !== mine && c !== mine.split("-")[0])];
  }

  // ---------- pages ----------

  async function authors() {
    const my = ++token;
    const { authors } = await catalog();
    if (my !== token) return;
    const box = page();
    box.appendChild(crumbs([[t("home"), "#/home"], [t("catAuthors")]]));
    heading(box, t("catAuthors"));
    const coll = new Intl.Collator(M.lang());
    list(box, [...authors].sort((a, b) => coll.compare(pick(a.names), pick(b.names))).map(authorCard));
  }

  async function author(id) {
    const my = ++token;
    let a, cat;
    try {
      [a, cat] = await Promise.all([fetch(`data/authors/${id}.json`).then((r) => r.json()), catalog()]);
    } catch (e) {
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
      const c = el("a", "chip", termName("era", a.era, cat.taxonomy));
      c.href = "#/browse/era/" + a.era;
      chips.appendChild(c);
      box.appendChild(chips);
    }

    box.appendChild(el("h2", "panel-title", t("works")));
    const cards = a.works.map((entry) => {
      const w = entry.work && cat.works.find((x) => x.id === entry.work);
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
    list(box, cards);
  }

  async function category(catKey) {
    const my = ++token;
    const cat = await catalog();
    if (my !== token) return;
    const box = page();
    box.appendChild(crumbs([[t("home"), "#/home"], [t(CATS[catKey])]]));
    heading(box, t(CATS[catKey]));

    if (catKey === "language") {
      list(box, languages(cat.works).map((code) => {
        const written = cat.works.filter((w) => w.originalLanguage === code).length;
        const readable = cat.works.filter((w) => w.readableLanguages.includes(code)).length;
        const listed = cat.works.some((w) => w.translationLanguages.includes(code));
        const meta = [written && t("writtenInCount", { n: written }), readable && t("readableInCount", { n: readable })]
          .filter(Boolean).join(" · ") || (listed ? t("listedOnly") : t("nothingFound"));
        return termCard("#/browse/language/" + code, langName(code), meta);
      }));
      return;
    }
    const terms = cat.taxonomy[catKey] || [];
    list(box, terms.map((term) => {
      const n = cat.works.filter((w) => hasTerm(w, catKey, term.id)).length;
      return termCard(`#/browse/${catKey}/${term.id}`, pick(term.names), t("worksCount", { n }), pick(term.range));
    }));
  }

  async function term(catKey, id) {
    const my = ++token;
    const cat = await catalog();
    if (my !== token) return;
    const box = page();

    if (catKey === "language") {
      const name = langName(id);
      box.appendChild(crumbs([[t("home"), "#/home"], [t("catLanguage"), "#/browse/language"], [name]]));
      heading(box, name);
      const groups = [
        ["writtenIn", cat.works.filter((w) => w.originalLanguage === id)],
        ["readableIn", cat.works.filter((w) => w.readableLanguages.includes(id))],
        ["listedIn", cat.works.filter((w) => w.translationLanguages.includes(id) && !w.readableLanguages.includes(id))],
      ];
      for (const [key, works] of groups) {
        if (!works.length) continue;
        box.appendChild(el("h2", "panel-title", t(key, { language: name })));
        list(box, works.map(workCard));
      }
      return;
    }

    const termRec = (cat.taxonomy[catKey] || []).find((x) => x.id === id);
    const name = termRec ? pick(termRec.names) : id;
    box.appendChild(crumbs([[t("home"), "#/home"], [t(CATS[catKey]), "#/browse/" + catKey], [name]]));
    heading(box, name, termRec && pick(termRec.range));
    if (termRec && termRec.note) box.appendChild(el("p", "browse-bio", pick(termRec.note)));

    const works = cat.works.filter((w) => hasTerm(w, catKey, id));
    const authorIds = [...new Set(works.flatMap((w) => w.authors))];
    const authors = cat.authors.filter((a) => authorIds.includes(a.id) || (catKey === "era" && a.era === id));
    if (authors.length) {
      box.appendChild(el("h2", "panel-title", t("catAuthors")));
      list(box, authors.map(authorCard));
    }
    box.appendChild(el("h2", "panel-title", t("works")));
    if (works.length) list(box, works.map(workCard));
    else box.appendChild(el("p", "search-empty", t("nothingFound")));
  }

  // args: route pieces after the view name.
  function render(view, args) {
    if (view === "authors") return authors();
    if (view === "author") return args[0] ? author(args[0]) : authors();
    const [catKey, id] = args;
    if (!CATS[catKey]) return authors();
    return id ? term(catKey, decodeURIComponent(id)) : category(catKey);
  }

  return { render };
})();
window.Browse = Browse;
