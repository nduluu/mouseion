// Small helpers shared by search, category and author pages.
const M = (() => {
  let catalogPromise = null;

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

  function catalog() {
    if (!catalogPromise) {
      catalogPromise = fetch("data/catalog.json").then((r) => {
        if (!r.ok) throw new Error("catalog: HTTP " + r.status);
        return r.json();
      });
    }
    return catalogPromise;
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
    const sub = el("span", "work-result-sub", [a.originalName && a.names[a.originalName], a.dates].filter(Boolean).join(" · "));
    if (a.originalName) sub.lang = a.originalName;
    card.appendChild(sub);
    card.appendChild(el("span", "work-result-meta", t("worksCount", { n: a.works.length + (a.otherWorks || 0) })));
    return card;
  }

  return { lang, t, pick, el, langName, catalog, termName, workCard, authorCard };
})();
window.M = M;
