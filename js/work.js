// A work's page: side-by-side reader (original | translation in the visitor's
// language), every edition in drop-downs, the stemma (textual history back to
// ω), and per-country public-domain status with a countdown.
const Work = (() => {
  const DAY = 86400000;
  // The 24 books of the Iliad are traditionally named by the Greek letters.
  const BOOK_LETTERS = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";

  const cache = {};       // fetched JSON by URL
  let work = null;        // current work record
  let state = { orig: null, trans: null, book: 1, selected: null };
  let ticker = null;
  let renderToken = 0;

  const $ = (id) => document.getElementById(id);

  function lang() {
    return document.documentElement.lang || "en";
  }

  function t(key, vars) {
    const l = lang();
    let s = (I18N[l] && I18N[l][key]) || I18N.en[key] || key;
    for (const k in vars || {}) s = s.replace("{" + k + "}", vars[k]);
    return s;
  }

  // Pick the value for the UI language from a {lang: value} map.
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

  async function getJSON(url) {
    if (!cache[url]) {
      cache[url] = fetch(url).then((r) => {
        if (!r.ok) throw new Error(url + ": HTTP " + r.status);
        return r.json();
      });
    }
    return cache[url];
  }

  function base() {
    return "data/works/" + work.id + "/";
  }

  const editions = () => work.nodes.filter((n) => n.kind === "edition");
  const byId = (id) => work.nodes.find((n) => n.id === id) || work.translations.find((n) => n.id === id);

  function langName(code) {
    try {
      return new Intl.DisplayNames([lang(), "en"], { type: "language" }).of(code) || code;
    } catch (e) {
      return code;
    }
  }

  function fmtDate(year) {
    return new Intl.DateTimeFormat(lang(), { dateStyle: "long", timeZone: "UTC" }).format(Rights.startOf(year));
  }

  function fmtUnit(n, unit) {
    try {
      return new Intl.NumberFormat(lang(), { style: "unit", unit, unitDisplay: "long" }).format(n);
    } catch (e) {
      return n + " " + unit + (n === 1 ? "" : "s");
    }
  }

  // ---------- status of an edition for the visitor ----------

  // "read" (text in Mouseion and public domain here), "notext" (public domain
  // here but not digitised yet), "locked" (not public domain here), "lost".
  function status(ed) {
    if (ed.kind === "lost") return "lost";
    if (!Rights.isPD(ed, Rights.country())) return "locked";
    return ed.text ? "read" : "notext";
  }

  function optionLabel(ed) {
    const who = (ed.creators || []).map((c) => c.name).join(", ");
    let s = (who ? who + ", " : "") + ed.date;
    const st = status(ed);
    if (st === "locked") s += " · " + t("lockedShort");
    else if (st === "notext") s += " · " + t("notDigitisedShort");
    return s;
  }

  // ---------- countdown ----------

  function addYears(ts, n) {
    const d = new Date(ts);
    d.setUTCFullYear(d.getUTCFullYear() + n);
    return d.getTime();
  }

  function countdownText(until) {
    let now = Date.now();
    if (until <= now) return "";
    let years = 0;
    while (addYears(now, years + 1) <= until) years++;
    let rest = until - addYears(now, years);
    const days = Math.floor(rest / DAY); rest -= days * DAY;
    const h = Math.floor(rest / 3600000); rest -= h * 3600000;
    const m = Math.floor(rest / 60000); rest -= m * 60000;
    const s = Math.floor(rest / 1000);
    const pad = (x) => String(x).padStart(2, "0");
    const parts = [];
    if (years) parts.push(fmtUnit(years, "year"));
    parts.push(fmtUnit(days, "day"));
    parts.push(`${pad(h)}:${pad(m)}:${pad(s)}`);
    return parts.join(" ");
  }

  function countdown(year) {
    const span = el("span", "countdown");
    span.dataset.until = Rights.startOf(year);
    span.textContent = countdownText(Rights.startOf(year));
    return span;
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(() => {
      if ($("work").hidden) { clearInterval(ticker); ticker = null; return; }
      document.querySelectorAll("#work .countdown").forEach((c) => {
        c.textContent = countdownText(Number(c.dataset.until));
      });
    }, 1000);
  }

  // ---------- rights block ----------

  function countryList(codes) {
    const coll = new Intl.Collator(lang());
    return codes.map((c) => Rights.countryName(c, lang())).sort(coll.compare).join(", ");
  }

  function rightsBlock(ed) {
    const box = el("div", "rights");
    const here = Rights.country();
    const hereName = Rights.countryName(here, lang());
    const y = Rights.pdYear(ed, here);

    if (y === -Infinity) {
      box.appendChild(el("p", "rights-status free", t("pdEverywhere")));
      return box;
    }
    const { free, later } = Rights.survey(ed);

    if (Rights.isPD(ed, here)) {
      box.appendChild(el("p", "rights-status free", t("pdIn", { country: hereName })));
    } else {
      box.appendChild(el("p", "rights-status locked", t("notPdIn", { country: hereName })));
      if (y != null) {
        const p = el("p", "rights-when", t("availableOn", { date: fmtDate(y) }) + " ");
        box.appendChild(p);
        box.appendChild(countdown(y));
      }
    }

    if (free.length && !Rights.isPD(ed, here)) {
      const d = el("details", "rights-list");
      d.appendChild(el("summary", null, t("pdNowIn", { n: free.length })));
      d.appendChild(el("p", null, countryList(free)));
      box.appendChild(d);
    }
    if (later.length) {
      const d = el("details", "rights-list");
      d.appendChild(el("summary", null, t("notYetIn", { n: later.length })));
      const ul = el("ul");
      // Group countries by the year the edition becomes free there.
      const groups = new Map();
      for (const { country, year } of later) {
        if (!groups.has(year)) groups.set(year, []);
        groups.get(year).push(country);
      }
      for (const [year, codes] of groups) {
        const li = el("li");
        li.appendChild(el("strong", null, year == null ? "?" : fmtDate(year)));
        li.appendChild(document.createTextNode(" — " + countryList(codes)));
        ul.appendChild(li);
      }
      d.appendChild(ul);
      box.appendChild(d);
    }
    return box;
  }

  // ---------- header + controls ----------

  function renderHeader() {
    $("work-title").textContent = pick(work.titles);
    $("work-title").lang = work.titles[lang()] ? lang() : "en";
    const sub = $("work-sub");
    sub.textContent = "";
    sub.appendChild(document.createTextNode(pick(work.author) + " · "));
    const orig = el("span", null, work.titles[work.originalLanguage]);
    orig.lang = work.originalLanguage;
    sub.appendChild(orig);

    const sel = $("work-country");
    sel.textContent = "";
    for (const { code, name } of Rights.countriesByName(lang())) {
      const o = el("option", null, name);
      o.value = code;
      sel.appendChild(o);
    }
    sel.value = Rights.country();
  }

  function fillOriginalSelect() {
    const sel = $("ed-original");
    sel.textContent = "";
    for (const ed of editions().filter((e) => e.lang === work.originalLanguage)) {
      const o = el("option", null, optionLabel(ed));
      o.value = ed.id;
      sel.appendChild(o);
    }
    sel.value = state.orig;
  }

  function fillTranslationSelect() {
    const sel = $("ed-translation");
    sel.textContent = "";
    const mine = lang().split("-")[0];
    const langs = [...new Set(work.translations.map((x) => x.lang))];
    // Visitor's language first, then the others by name.
    const coll = new Intl.Collator(lang());
    langs.sort((a, b) => (b === mine) - (a === mine) || coll.compare(langName(a), langName(b)));

    if (!work.translations.some((x) => x.lang === mine)) {
      const o = el("option", null, t("noTranslationOption", { language: langName(mine) }));
      o.value = "";
      sel.appendChild(o);
    }
    for (const l of langs) {
      const g = el("optgroup");
      g.label = langName(l);
      for (const tr of work.translations.filter((x) => x.lang === l)) {
        const o = el("option", null, optionLabel(tr));
        o.value = tr.id;
        g.appendChild(o);
      }
      sel.appendChild(g);
    }
    sel.value = state.trans || "";
  }

  function fillBookSelect() {
    const sel = $("ed-book");
    sel.textContent = "";
    for (let b = 1; b <= 24; b++) {
      const o = el("option", null, t("book") + " " + b + " · " + BOOK_LETTERS[b - 1]);
      o.value = b;
      sel.appendChild(o);
    }
    sel.value = state.book;
  }

  // Default choices: the first readable original; a readable translation in
  // the visitor's language if there is one.
  function chooseDefaults() {
    const readable = (list) => list.find((e) => status(e) === "read");
    // If nothing is readable here, prefer an edition whose text Mouseion has,
    // so the visitor sees its countdown.
    const digitised = (list) => list.find((e) => e.text);
    const origs = editions().filter((e) => e.lang === work.originalLanguage);
    if (!state.orig || !byId(state.orig)) {
      state.orig = (readable(origs) || digitised(origs) || origs[origs.length - 1]).id;
    }
    const mine = lang().split("-")[0];
    const inMine = work.translations.filter((x) => x.lang === mine);
    state.trans = (readable(inMine) || inMine[0] || {}).id || null;
  }

  // ---------- reader ----------

  function messageBox(ed, kind) {
    const box = el("div", "reader-msg");
    if (kind === "none") {
      const mine = langName(lang().split("-")[0]);
      box.appendChild(el("p", "reader-msg-title", t("noTranslation", { language: mine })));
      box.appendChild(el("p", null, t("noTranslationHint")));
      return box;
    }
    box.appendChild(el("p", "reader-msg-title", ed.title + " (" + ed.date + ")"));
    if (kind === "notext") box.appendChild(el("p", null, t("notDigitised")));
    box.appendChild(rightsBlock(ed));
    return box;
  }

  async function bookText(ed) {
    return getJSON(base() + ed.text.path + "/" + String(state.book).padStart(2, "0") + ".json");
  }

  function linesBlock(lines) {
    const div = el("div", "orig");
    div.lang = work.originalLanguage;
    for (const [n, text] of lines) {
      const line = el("div", "line");
      const num = el("span", "ln", n % 5 === 0 ? String(n) : "");
      line.appendChild(num);
      line.appendChild(el("span", "lt", text));
      div.appendChild(line);
    }
    return div;
  }

  function passageBlock(text, l) {
    const div = el("div", "trans");
    div.lang = l;
    for (const para of text.split("\n\n")) div.appendChild(el("p", null, para));
    return div;
  }

  async function renderReader() {
    const token = ++renderToken;
    const reader = $("reader");
    const credit = $("reader-credit");
    const orig = byId(state.orig);
    const trans = state.trans ? byId(state.trans) : null;
    const origOK = orig && status(orig) === "read";
    const transOK = trans && status(trans) === "read";

    reader.setAttribute("aria-busy", "true");
    let g = null, tr = null;
    try {
      [g, tr] = await Promise.all([origOK ? bookText(orig) : null, transOK ? bookText(trans) : null]);
    } catch (e) {
      console.error(e);
    }
    if (token !== renderToken) return; // a newer render started meanwhile
    reader.textContent = "";
    reader.removeAttribute("aria-busy");

    if (g && tr) {
      // One row per translation passage, beside the Greek lines it covers.
      const ps = tr.passages;
      ps.forEach((p, i) => {
        const end = i + 1 < ps.length ? ps[i + 1].from : Infinity;
        const row = el("div", "reader-row");
        row.appendChild(linesBlock(g.lines.filter(([n]) => n >= p.from && n < end)));
        row.appendChild(passageBlock(p.text, trans.lang));
        reader.appendChild(row);
      });
    } else {
      const row = el("div", "reader-row single");
      row.appendChild(g ? linesBlock(g.lines) : messageBox(orig, status(orig)));
      const side = tr
        ? passageBlock(tr.passages.map((p) => p.text).join("\n\n"), trans.lang)
        : messageBox(trans, trans ? status(trans) : "none");
      row.appendChild(side);
      reader.appendChild(row);
    }

    // Credits for the digital texts shown.
    credit.textContent = "";
    for (const ed of [origOK && orig, transOK && trans].filter(Boolean)) {
      const p = el("span", null, ed.title + ": " + t("digitalText") + " ");
      const a = el("a", null, ed.text.source);
      a.href = ed.text.sourceUrl;
      a.target = "_blank";
      a.rel = "noopener";
      p.appendChild(a);
      credit.appendChild(p);
    }
    startTicker();
  }

  // ---------- stemma ----------

  const SVG = "http://www.w3.org/2000/svg";
  const NODE_W = 116, NODE_H = 46, ROW_H = 86, WIDTH = 760;

  function svg(tag, attrs) {
    const e = document.createElementNS(SVG, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function layout() {
    const rows = {};
    for (const n of work.nodes) (rows[n.row] ||= []).push(n);
    const pos = {};
    for (const r in rows) {
      const list = rows[r];
      list.forEach((n, i) => {
        // `x` (0–1) in the record places a node by hand; otherwise spread evenly.
        const fx = n.x != null ? n.x : (i + 1) / (list.length + 1);
        pos[n.id] = { x: fx * WIDTH, y: 30 + Number(r) * ROW_H };
      });
    }
    return pos;
  }

  function renderStemma() {
    const box = $("stemma");
    box.textContent = "";
    const pos = layout();
    const rows = Math.max(...work.nodes.map((n) => n.row)) + 1;
    const s = svg("svg", {
      viewBox: `0 0 ${WIDTH} ${rows * ROW_H}`,
      role: "group",
      "aria-label": t("textualHistory"),
    });

    // Links first, so nodes are drawn on top.
    for (const n of work.nodes) {
      for (const p of n.parents || []) {
        const a = pos[p.id], b = pos[n.id];
        const y1 = a.y + NODE_H / 2, y2 = b.y - NODE_H / 2, my = (y1 + y2) / 2;
        s.appendChild(svg("path", {
          d: `M${a.x},${y1} C${a.x},${my} ${b.x},${my} ${b.x},${y2}`,
          class: "st-link" + (p.approx ? " approx" : ""),
        }));
      }
    }

    for (const n of work.nodes) {
      const { x, y } = pos[n.id];
      const g = svg("g", {
        class: "st-node " + status(n) + (state.selected === n.id ? " selected" : ""),
        transform: `translate(${x - NODE_W / 2},${y - NODE_H / 2})`,
        tabindex: "0",
        role: "button",
        "aria-label": n.title + ", " + n.date,
      });
      if (n.kind === "lost") {
        g.appendChild(svg("circle", { cx: NODE_W / 2, cy: NODE_H / 2, r: NODE_H / 2 }));
      } else {
        g.appendChild(svg("rect", { width: NODE_W, height: NODE_H, rx: 8 }));
      }
      const label = svg("text", { x: NODE_W / 2, y: n.kind === "lost" ? NODE_H / 2 + 7 : 19, class: "st-label" + (n.kind === "lost" ? " omega" : "") });
      label.textContent = n.label;
      g.appendChild(label);
      if (n.kind !== "lost") {
        const date = svg("text", { x: NODE_W / 2, y: 35, class: "st-date" });
        date.textContent = n.year ? String(n.year) : shortDate(n.date);
        g.appendChild(date);
      }
      const choose = () => { state.selected = n.id; renderStemma(); renderDetail(); };
      g.addEventListener("click", choose);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); }
      });
      s.appendChild(g);
    }
    box.appendChild(s);
  }

  function shortDate(d) {
    return d.length > 18 ? d.replace(/^from the /, "").replace(/ century/g, " c.").slice(0, 20) : d;
  }

  function pathToOrigin(n) {
    const chain = [n];
    while (chain[0].parents && chain[0].parents.length) chain.unshift(byId(chain[0].parents[0].id));
    return chain;
  }

  function nodeLink(n) {
    const b = el("button", "link-btn", n.label === "ω" ? "ω" : n.label);
    b.type = "button";
    b.title = n.title;
    b.addEventListener("click", () => { state.selected = n.id; renderStemma(); renderDetail(); });
    return b;
  }

  const KIND_KEYS = { lost: "kindLost", recension: "kindRecension", manuscript: "kindManuscript", edition: "kindEdition" };

  function renderDetail() {
    const box = $("stemma-detail");
    box.textContent = "";
    const n = byId(state.selected);
    if (!n) {
      box.appendChild(el("p", "detail-hint", t("stemmaHint")));
      return;
    }
    box.appendChild(el("p", "detail-kind", t(KIND_KEYS[n.kind])));
    box.appendChild(el("h3", "detail-title", n.title));
    box.appendChild(el("p", "detail-date", [n.date, n.place].filter(Boolean).join(" · ")));
    if (n.creators) {
      box.appendChild(el("p", "detail-creators", n.creators.map((c) => `${c.name} (†${c.died})`).join(", ")));
    }
    box.appendChild(el("p", "detail-note", n.note));

    // Breadcrumb from ω down to this node; each step is clickable.
    if (n.parents && n.parents.length) {
      const path = el("nav", "detail-path");
      path.appendChild(el("span", "detail-label", t("pathToOrigin")));
      pathToOrigin(n).forEach((p, i) => {
        if (i) path.appendChild(el("span", "sep", "›"));
        path.appendChild(p === n ? el("span", "here", n.label) : nodeLink(p));
      });
      box.appendChild(path);
      if (n.parents.length > 1) {
        const also = el("p", "detail-parents");
        also.appendChild(el("span", "detail-label", t("derivedFrom")));
        n.parents.forEach((p) => {
          also.appendChild(nodeLink(byId(p.id)));
          if (p.approx) also.appendChild(el("span", "approx-mark", "?"));
        });
        box.appendChild(also);
      }
    }

    if (n.kind === "edition") {
      box.appendChild(rightsBlock(n));
      if (status(n) === "read") {
        const b = el("button", "btn", t("readThis"));
        b.type = "button";
        b.addEventListener("click", () => {
          state.orig = n.id;
          fillOriginalSelect();
          renderReader();
          $("reader-panel").scrollIntoView({ behavior: "smooth", block: "start" });
        });
        box.appendChild(b);
      } else if (status(n) === "notext") {
        box.appendChild(el("p", "detail-hint", t("notDigitised")));
      }
    }
    startTicker();
  }

  // ---------- page ----------

  async function render(id) {
    const page = $("work");
    try {
      work = await getJSON("data/works/" + id + "/work.json");
    } catch (e) {
      page.querySelector(".work-head h1").textContent = t("nothingFound");
      return;
    }
    if (state.workId !== id) {
      state = { workId: id, orig: null, trans: null, book: 1, selected: "omega" };
    }
    chooseDefaults();
    renderHeader();
    fillOriginalSelect();
    fillTranslationSelect();
    fillBookSelect();
    $("stemma-note").textContent = work.stemmaNote;
    renderStemma();
    renderDetail();
    await renderReader();
  }

  function rerender() {
    if (!work) return;
    fillOriginalSelect();
    fillTranslationSelect();
    renderStemma();
    renderDetail();
    renderReader();
  }

  function init() {
    $("work-country").addEventListener("change", (e) => {
      Rights.setCountry(e.target.value);
      rerender();
    });
    $("ed-original").addEventListener("change", (e) => { state.orig = e.target.value; renderReader(); });
    $("ed-translation").addEventListener("change", (e) => { state.trans = e.target.value || null; renderReader(); });
    $("ed-book").addEventListener("change", (e) => { state.book = Number(e.target.value); renderReader(); });
    const step = (d) => {
      state.book = Math.min(24, Math.max(1, state.book + d));
      $("ed-book").value = state.book;
      renderReader();
      $("reader-panel").scrollIntoView({ block: "start" });
    };
    $("book-prev").addEventListener("click", () => step(-1));
    $("book-next").addEventListener("click", () => step(1));
  }

  init();
  return { render };
})();
window.Work = Work;
