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
  // Originals (stemma nodes) and translations are looked up separately: the
  // same id can name both (e.g. Murray's Greek text and his translation).
  const byId = (id) => work.nodes.find((n) => n.id === id);
  const transById = (id) => work.translations.find((n) => n.id === id);

  const langName = (code) => M.langName(code);

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
    if (ed.needsReview) s += " · " + t("unreviewed");
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
      } else {
        box.appendChild(el("p", "rights-when", t("pdLiving", { n: Rights.lifeTerm(here) })));
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
        li.appendChild(el("strong", null, year == null ? t("afterDeath") : fmtDate(year)));
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
    const authorId = ((work.classification || {}).authors || [])[0];
    const who = el(authorId ? "a" : "span", "work-author", pick(work.author));
    if (authorId) who.href = "#/author/" + authorId;
    sub.appendChild(who);
    sub.appendChild(document.createTextNode(" · "));
    const orig = el("span", null, work.titles[work.originalLanguage]);
    orig.lang = work.originalLanguage;
    sub.appendChild(orig);

    renderChips();

    const sel = $("work-country");
    sel.textContent = "";
    for (const { code, name } of Rights.countriesByName(lang())) {
      const o = el("option", null, name);
      o.value = code;
      sel.appendChild(o);
    }
    sel.value = Rights.country();
  }

  // Era, genre, fields and tradition as links to their category pages.
  async function renderChips() {
    const box = $("work-chips");
    box.textContent = "";
    const c = work.classification || {};
    let taxonomy = {};
    try { taxonomy = (await M.catalogIndex()).taxonomy; } catch (e) { /* names fall back to ids */ }
    const add = (cat, id) => {
      const a = el("a", "chip", M.termName(cat, id, taxonomy));
      a.href = `#/browse/${cat}/${id}`;
      box.appendChild(a);
    };
    if (c.era) add("era", c.era);
    (c.genres || []).forEach((id) => add("genre", id));
    (c.fields || []).forEach((id) => add("field", id));
    (c.religions || []).forEach((id) => add("religion", id));
    const l = el("a", "chip", langName(work.originalLanguage));
    l.href = "#/browse/language/" + work.originalLanguage;
    box.appendChild(l);
  }

  // ---------- reader: panes ----------
  //
  // The visitor chooses 1–4 texts ("panes"): any edition of the original or
  // any translation. Pane ids are "o:<edition id>" or "t:<translation id>";
  // "none" stands for "no translation in your language yet".
  // Layout, text size and line numbers are remembered between visits, and
  // the chosen panes are remembered per work.

  const MAX_PANES = 4;
  const PREFS_KEY = "mouseion.reader";

  function loadPrefs() {
    try {
      return { layout: "columns", size: 0, numbers: true, pages: true, view: "scroll", ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
    } catch (e) {
      return { layout: "columns", size: 0, numbers: true, pages: true, view: "scroll" };
    }
  }

  let prefs = loadPrefs();

  function savePrefs() {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  function savePanes() {
    localStorage.setItem("mouseion.panes." + work.id, JSON.stringify(state.panes));
  }

  function resolvePane(id) {
    if (id === "none") return { id, kind: "none" };
    const [k, ref] = id.split(":");
    const ed = k === "o" ? byId(ref) : transById(ref);
    if (!ed) return null;
    const isOrig = k === "o";
    return {
      id, ed, kind: isOrig ? "orig" : "trans",
      lang: isOrig ? work.originalLanguage : ed.lang,
      st: status(ed),
      // How a text lines up with the original's line numbers.
      align: isOrig ? "lines" : (ed.text && ed.text.align) || "passages",
    };
  }

  function shortName(p) {
    if (p.kind === "none") return t("translation");
    const ed = p.ed;
    if (p.kind === "orig") return ed.label + (ed.year ? " " + ed.year : "");
    return (ed.creators || []).map((c) => c.name).join(", ") + ", " + ed.date;
  }

  // Default panes: the first readable original, then a translation in the
  // visitor's language (or the "none yet" notice).
  function defaultPanes() {
    const readable = (list) => list.find((e) => status(e) === "read");
    const digitised = (list) => list.find((e) => e.text);
    const origs = editions().filter((e) => e.lang === work.originalLanguage);
    const orig = readable(origs) || digitised(origs) || origs[origs.length - 1];
    const mine = lang().split("-")[0];
    const inMine = work.translations.filter((x) => x.lang === mine);
    const tr = readable(inMine) || inMine[0];
    return ["o:" + orig.id, tr ? "t:" + tr.id : "none"];
  }

  function choosePanes() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("mouseion.panes." + work.id) || "null"); } catch (e) { /* ignore */ }
    const valid = Array.isArray(saved) && saved.length && saved.every((id) => resolvePane(id));
    state.panes = valid ? saved.slice(0, MAX_PANES) : defaultPanes();
  }

  // A <select> listing every text: originals first, then translations by
  // language with the visitor's language first. Texts that cannot be read
  // yet (not digitised, or not public domain here) are listed but greyed out.
  function textSelect(current) {
    const sel = el("select", "pane-select");
    sel.setAttribute("aria-label", t("chooseText"));
    if (current === "none") {
      const o = el("option", null, t("noTranslationOption", { language: langName(lang().split("-")[0]) }));
      o.value = "none";
      sel.appendChild(o);
    }
    const og = el("optgroup");
    og.label = t("originalGroup", { language: langName(work.originalLanguage) });
    for (const ed of editions().filter((e) => e.lang === work.originalLanguage)) {
      const o = el("option", null, optionLabel(ed));
      o.value = "o:" + ed.id;
      o.disabled = status(ed) !== "read" && o.value !== current;
      og.appendChild(o);
    }
    sel.appendChild(og);
    const mine = lang().split("-")[0];
    const coll = new Intl.Collator(lang());
    const langs = [...new Set(work.translations.map((x) => x.lang))]
      .sort((a, b) => (b === mine) - (a === mine) || coll.compare(langName(a), langName(b)));
    for (const l of langs) {
      const g = el("optgroup");
      g.label = langName(l);
      for (const tr of work.translations.filter((x) => x.lang === l)) {
        const o = el("option", null, optionLabel(tr));
        o.value = "t:" + tr.id;
        o.disabled = status(tr) !== "read" && o.value !== current;
        g.appendChild(o);
      }
      sel.appendChild(g);
    }
    sel.value = current;
    return sel;
  }

  function iconButton(label, text, onClick, disabled) {
    const b = el("button", "pane-btn", text);
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.disabled = !!disabled;
    b.addEventListener("click", onClick);
    return b;
  }

  function setPanes(panes) {
    state.panes = panes;
    savePanes();
    renderPaneBar();
    renderReader();
  }

  // Header with one control group per pane: choose text, move, remove.
  function renderPaneBar() {
    const bar = $("pane-bar");
    bar.textContent = "";
    bar.className = "pane-bar " + prefs.layout;
    bar.style.setProperty("--panes", state.panes.length);
    state.panes.forEach((id, i) => {
      const box = el("div", "pane-head");
      const sel = textSelect(id);
      sel.addEventListener("change", () => {
        const next = state.panes.slice();
        next[i] = sel.value;
        setPanes(next);
      });
      box.appendChild(sel);
      const swap = (a, b) => { const n = state.panes.slice(); [n[a], n[b]] = [n[b], n[a]]; setPanes(n); };
      const rtl = document.documentElement.dir === "rtl";
      const before = prefs.layout === "columns" ? (rtl ? "→" : "←") : "↑";
      const after = prefs.layout === "columns" ? (rtl ? "←" : "→") : "↓";
      box.appendChild(iconButton(t("moveEarlier"), before, () => swap(i, i - 1), i === 0));
      box.appendChild(iconButton(t("moveLater"), after, () => swap(i, i + 1), i === state.panes.length - 1));
      box.appendChild(iconButton(t("removeText"), "×", () => setPanes(state.panes.filter((_, j) => j !== i)), state.panes.length === 1));
      bar.appendChild(box);
    });
    $("add-pane").disabled = state.panes.length >= MAX_PANES;
    document.querySelectorAll("#reader-panel [data-layout]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.layout === prefs.layout));
    });
    $("toggle-numbers").checked = prefs.numbers;
    $("toggle-pages").checked = prefs.pages;
    // Always shown; greyed out while no text on screen records printed pages.
    const hasPages = state.panes.map(resolvePane).some((p) => p && p.ed && p.ed.text && p.ed.text.pages);
    $("toggle-pages").disabled = !hasPages;
    $("toggle-pages-wrap").classList.toggle("disabled", !hasPages);
    $("toggle-pages-wrap").title = hasPages ? "" : t("noPageNumbers");
    document.querySelectorAll("#reader-panel [data-view]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.view === prefs.view));
    });
  }

  // Add a pane: the next text not yet shown (readable first).
  function addPane(id) {
    if (state.panes.length >= MAX_PANES) return;
    if (!id) {
      const all = [
        ...editions().filter((e) => e.lang === work.originalLanguage).map((e) => "o:" + e.id),
        ...work.translations.map((x) => "t:" + x.id),
      ].filter((x) => !state.panes.includes(x));
      id = all.find((x) => resolvePane(x).st === "read") || all[0];
      if (!id) return;
    }
    if (state.panes.includes(id)) return;
    setPanes([...state.panes, id]);
  }

  function fillBookSelect() {
    const sel = $("ed-book");
    sel.textContent = "";
    const letters = work.bookLetters || BOOK_LETTERS;
    for (let b = 1; b <= 24; b++) {
      const o = el("option", null, t("book") + " " + b + " · " + letters[b - 1]);
      o.value = b;
      sel.appendChild(o);
    }
    sel.value = state.book;
  }

  function messageBox(p) {
    const box = el("div", "reader-msg");
    if (p.kind === "none") {
      const mine = langName(lang().split("-")[0]);
      box.appendChild(el("p", "reader-msg-title", t("noTranslation", { language: mine })));
      box.appendChild(el("p", null, t("noTranslationHint")));
      return box;
    }
    box.appendChild(el("p", "reader-msg-title", p.ed.title + " (" + p.ed.date + ")"));
    if (p.st === "notext") box.appendChild(el("p", null, t("notDigitised")));
    if (p.st !== "notext") box.appendChild(rightsBlock(p.ed));
    return box;
  }

  async function bookText(ed) {
    return getJSON(base() + ed.text.path + "/" + String(state.book).padStart(2, "0") + ".json");
  }

  // Printed page breaks: data.pages is [[first line, page, scan image], …].
  // The line a page starts on gets a small "p. 12" mark at its top edge,
  // linking to the scan of that page where the source offers one.
  function pageStarts(p) {
    const m = new Map();
    if (p.data && p.data.pages) for (const [n, label, scan, vol] of p.data.pages) m.set(n, { label: pageLabel(label, vol), page: label, vol, scan });
    return m;
  }

  // "p. 12", or "vol. II, p. 12" for an edition in several volumes.
  function pageLabel(label, vol) {
    return (vol ? t("volAbbr") + "\u00a0" + vol + ", " : "") + t("pageAbbr") + "\u00a0" + label;
  }

  function markPage(line, p, pg) {
    if (!pg) return;
    line.classList.add("page-start");
    const tpl = p.ed && p.ed.text && p.ed.text.pages && p.ed.text.pages.scan;
    const mark = el(tpl && pg.scan ? "a" : "span", "pb", pg.label);
    mark.dataset.page = pg.page;
    if (pg.vol) mark.dataset.vol = pg.vol;
    if (mark.tagName === "A") {
      mark.href = tpl.replace("{scan}", pg.scan);
      mark.target = "_blank";
      mark.rel = "noopener";
      mark.title = t("pageScan", { page: pg.label });
    }
    line.appendChild(mark);
  }

  // A line of text. dir="auto" lets each text run in its own direction (Greek
  // left to right even when the page is Arabic, and the other way round).
  function textSpan(text) {
    const span = el("span", "lt", text);
    span.dir = "auto";
    return span;
  }

  function linesBlock(lines, l, cls, col, p) {
    const div = el("div", cls || "orig");
    div.lang = l;
    const pages = p ? pageStarts(p) : new Map();
    for (const [n, text] of lines) {
      const line = el("div", "line");
      line.dataset.n = n;
      line.dataset.col = col;
      line.appendChild(el("span", "ln", n % 5 === 0 ? String(n) : ""));
      line.appendChild(textSpan(text));
      markPage(line, p, pages.get(n));
      div.appendChild(line);
    }
    return div;
  }

  // Prose: each passage's paragraphs. A printed page that begins inside a
  // paragraph gets a small inline "p. 12" mark at that point (passage
  // "pages": [[character offset, page, scan image(, volume)], …]). The text
  // itself sits in .pt spans, so marking names on selection leaves the
  // page marks alone.
  function passageBlock(items, l, p) {
    const div = el("div", "trans");
    div.lang = l;
    if (p && p.col != null) div.dataset.col = p.col;
    for (const item of items) {
      const marks = (item.pages || []).slice();
      let base = 0;
      for (const para of item.text.split("\n\n")) {
        const node = el("p");
        node.dir = "auto"; // the text keeps its own direction on a right-to-left page
        let pos = 0;
        while (marks.length && marks[0][0] <= base + para.length) {
          const [off, label, scan, vol] = marks.shift();
          const at = Math.max(0, off - base);
          if (at > pos) node.appendChild(el("span", "pt", para.slice(pos, at)));
          pos = at;
          node.appendChild(inlinePage(p, label, scan, vol));
        }
        if (pos < para.length || !node.childNodes.length) node.appendChild(el("span", "pt", para.slice(pos)));
        div.appendChild(node);
        base += para.length + 2;
      }
    }
    return div;
  }

  function inlinePage(p, label, scan, vol) {
    const tpl = p && p.ed && p.ed.text && p.ed.text.pages && p.ed.text.pages.scan;
    const text = pageLabel(label, vol);
    const mark = el(tpl && scan ? "a" : "span", "pb-inline", text);
    mark.dataset.page = label;
    if (vol) mark.dataset.vol = vol;
    if (mark.tagName === "A") {
      mark.href = tpl.replace("{scan}", scan);
      mark.target = "_blank";
      mark.rel = "noopener";
      mark.title = t("pageScan", { page: text });
    }
    return mark;
  }

  // A pane's content between original lines [from, end); or all of it.
  function paneContent(p, data, from = -Infinity, end = Infinity) {
    const inRange = ([n]) => n >= from && n < end;
    if (data.passages) {
      const ps = data.passages.filter((x) => x.from >= from && x.from < end);
      return ps.length ? passageBlock(ps, p.lang, p) : null;
    }
    const lines = data.lines.filter(inRange);
    if (!lines.length) return null;
    return linesBlock(lines, p.lang, p.kind === "orig" ? "orig" : "trans verse", p.col, p);
  }

  // Where rows break: the first text with passages or stanza breaks sets the
  // rhythm; otherwise every 20 lines.
  function segmentStarts(panes) {
    for (const p of panes) {
      if (!p.data || p.align === "book") continue;
      if (p.data.passages) return p.data.passages.map((x) => x.from);
      if (p.data.breaks && p.kind === "trans") return p.data.breaks;
    }
    const origLines = panes.find((p) => p.data && p.kind === "orig");
    const last = origLines ? origLines.data.lines[origLines.data.lines.length - 1][0] : 0;
    const starts = [];
    for (let n = 1; n <= last; n += 20) starts.push(n);
    return starts;
  }

  // Side by side, one grid row per line number: line n of every text sits on
  // the same row as line n of the original. A prose passage spans the rows of
  // the lines it translates; prose without line references fills its column.
  function alignedGrid(panes) {
    const grid = el("div", "reader-grid");
    let last = 0;
    for (const p of panes) {
      if (!p.data) continue;
      if (p.data.lines && p.data.lines.length) last = Math.max(last, p.data.lines[p.data.lines.length - 1][0]);
      if (p.data.passages) for (const x of p.data.passages) if (x.from != null) last = Math.max(last, x.from);
    }
    const place = (node, col, row, rowEnd) => {
      node.style.gridColumn = String(col + 1);
      node.style.gridRow = rowEnd ? `${row} / ${rowEnd}` : String(row);
      grid.appendChild(node);
      return node;
    };
    panes.forEach((p, col) => {
      p.col = col;
      // Row 1: notes and notices for each text.
      const head = el("div", "grid-head");
      if (!p.data) head.appendChild(messageBox(p));
      else if (p.data.lineCounts) {
        const c = p.data.lineCounts;
        head.appendChild(el("p", "reader-note", t("lineDrift", { a: c.translation, b: c.original })));
      } else if (p.align === "book" && p.data.lines) {
        head.appendChild(el("p", "reader-note", t("numberPairing")));
      } else if (p.data.passages && p.data.passages.every((x) => x.from == null)) {
        head.appendChild(el("p", "reader-note", t("bookOnly")));
      }
      place(head, col, 1);
      if (!p.data) return;

      if (p.data.lines) {
        const cls = p.kind === "orig" ? "line orig" : "line trans verse";
        const pages = pageStarts(p);
        for (const [n, text] of p.data.lines) {
          const line = el("div", cls);
          line.lang = p.lang;
          line.dataset.n = n;
          line.dataset.col = col;
          line.appendChild(el("span", "ln", n % 5 === 0 ? String(n) : ""));
          line.appendChild(textSpan(text));
          markPage(line, p, pages.get(n));
          place(line, col, n + 1);
        }
        return;
      }
      const ps = p.data.passages;
      if (ps.every((x) => x.from == null)) {
        const block = passageBlock(ps, p.lang, p);
        block.dataset.col = col;
        place(block, col, 2, last + 2);
        return;
      }
      ps.forEach((x, i) => {
        const to = i + 1 < ps.length ? ps[i + 1].from - 1 : last;
        const block = passageBlock([x], p.lang, p);
        block.classList.add("passage");
        block.dataset.col = col;
        block.dataset.from = x.from;
        block.dataset.to = to;
        place(block, col, x.from + 1, to + 2);
      });
    });
    return grid;
  }

  // ---------- linked selection ----------
  // Selecting text in one version highlights the same lines in the others,
  // and proper names in them that sound like the selected ones.

  const GREEK = { α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "e", θ: "t", ι: "i", κ: "k", λ: "l", μ: "m",
    ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "i", φ: "f", χ: "k", ψ: "ps", ω: "o" };
  const CYRILLIC = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "z", з: "z", и: "i", й: "i", к: "k",
    л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "k", ц: "c", ч: "c", ш: "s",
    щ: "s", ъ: "", ы: "i", ь: "", э: "e", ю: "u", я: "a" };

  // A rough sound key: Ἀχιλλεύς, Achille, Achilles, Ахиллес → "akil".
  function soundKey(word) {
    let s = word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    s = [...s].map((c) => GREEK[c] ?? CYRILLIC[c] ?? c).join("");
    s = s.replace(/qu|ch|kh|c|q/g, "k").replace(/ph/g, "f").replace(/th/g, "t").replace(/h/g, "").replace(/y/g, "i")
      .replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
    return s.length >= 4 ? s.slice(0, 4) : null;
  }
  const isName = (w) => w[0] !== w[0].toLowerCase();
  const WORD = /[\p{L}\p{M}]+/gu;

  let marked = [];
  function clearLinks() {
    for (const node of marked) {
      if (node._raw != null) { node.textContent = node._raw; node._raw = null; }
      node.classList.remove("linked");
    }
    marked = [];
  }

  function markNames(node, keys) {
    const text = node._raw ?? node.textContent;
    let hit = false;
    const html = text.replace(WORD, (w) => {
      const k = isName(w) && soundKey(w);
      if (k && keys.has(k)) { hit = true; return "\u0000" + w + "\u0001"; }
      return w;
    });
    if (!hit) return;
    node._raw = text;
    node.textContent = "";
    for (const part of html.split(/(\u0000[^\u0001]*\u0001)/)) {
      if (part.startsWith("\u0000")) node.appendChild(el("mark", "echo", part.slice(1, -1)));
      else if (part) node.appendChild(document.createTextNode(part));
    }
    marked.push(node);
  }

  function syncSelection() {
    const reader = $("reader");
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) { clearLinks(); return; }
    const r = sel.getRangeAt(0);
    if (!reader.contains(r.commonAncestorContainer)) return;
    const cellOf = (node) => (node.nodeType === 1 ? node : node.parentElement).closest("[data-n], [data-from]");
    const a = cellOf(r.startContainer), b = cellOf(r.endContainer);
    if (!a || !b) return;
    const lo = Number(a.dataset.n ?? a.dataset.from);
    const hi = Number(b.dataset.n ?? b.dataset.to);
    const col = a.dataset.col;
    const keys = new Set();
    for (const w of sel.toString().match(WORD) || []) {
      const k = isName(w) && soundKey(w);
      if (k) keys.add(k);
    }
    clearLinks();
    const NEAR = 3; // look for names a few lines around, as translations drift
    for (const node of reader.querySelectorAll("[data-n], [data-from]")) {
      if (node.dataset.col === col) continue;
      const from = Number(node.dataset.n ?? node.dataset.from);
      const to = Number(node.dataset.n ?? node.dataset.to);
      const overlaps = from <= hi && to >= lo;
      if (overlaps) { node.classList.add("linked"); marked.push(node); }
      if (keys.size && from <= hi + NEAR && to >= lo - NEAR) {
        for (const target of node.matches(".line") ? [node.querySelector(".lt")] : node.querySelectorAll("p .pt")) markNames(target, keys);
      }
    }
  }

  function paneLabel(p) {
    const s = el("p", "pane-label", shortName(p));
    return s;
  }

  async function renderReader() {
    const token = ++renderToken;
    const reader = $("reader");
    const credit = $("reader-credit");
    const panes = state.panes.map(resolvePane).filter(Boolean);

    reader.setAttribute("aria-busy", "true");
    try {
      await Promise.all(panes.map(async (p) => {
        p.data = p.st === "read" ? await bookText(p.ed) : null;
      }));
    } catch (e) {
      console.error(e);
    }
    if (token !== renderToken) return; // a newer render started meanwhile
    reader.textContent = "";
    reader.removeAttribute("aria-busy");
    reader.className = "reader " + prefs.layout + (prefs.numbers ? "" : " no-numbers") + (prefs.pages ? "" : " no-pages");
    reader.style.setProperty("--panes", panes.length);
    reader.style.setProperty("--reader-scale", String(1 + prefs.size * 0.12));

    const readable = panes.filter((p) => p.data);
    const unreadable = panes.filter((p) => !p.data);
    panes.forEach((p, i) => { p.col = i; });
    marked = [];
    // A translation with its own line count can only be shown book by book.
    const free = panes.length > 1 && readable.some((p) => p.align === "book");
    const columns = prefs.layout === "columns" && panes.length > 1;

    if (prefs.layout === "columns" && readable.length) {
      reader.appendChild(alignedGrid(panes));
    } else if (free || !readable.length) {
      // Each text whole, side by side or one after another.
      const row = el("div", "reader-row");
      for (const p of panes) {
        const cell = el("div", "pane-cell");
        if (!columns) cell.appendChild(paneLabel(p));
        if (!p.data) cell.appendChild(messageBox(p));
        else {
          if (p.align === "book") cell.appendChild(el("p", "reader-note", t(p.data.lines ? "ownNumbering" : "bookOnly")));
          cell.appendChild(paneContent(p, p.data));
        }
        row.appendChild(cell);
      }
      reader.appendChild(row);
    } else {
      // Texts that can't be shown: their notice first (stacked) or at the top of their column.
      if (!columns) for (const p of unreadable) reader.appendChild(messageBox(p));
      const starts = segmentStarts(panes);
      starts.forEach((from, i) => {
        const end = i + 1 < starts.length ? starts[i + 1] : Infinity;
        const row = el("div", "reader-row");
        let filled = false;
        for (const p of columns ? panes : readable) {
          const cell = el("div", "pane-cell");
          if (!p.data) {
            if (i === 0) cell.appendChild(messageBox(p));
          } else {
            const content = paneContent(p, p.data, from, end);
            if (i === 0 && p.data.lineCounts) {
              const c = p.data.lineCounts;
              cell.appendChild(el("p", "reader-note", t("lineDrift", { a: c.translation, b: c.original })));
            }
            if (content) {
              if (!columns && readable.length > 1) cell.appendChild(paneLabel(p));
              cell.appendChild(content);
              filled = true;
            }
          }
          row.appendChild(cell);
        }
        if (filled || i === 0) reader.appendChild(row);
      });
    }

    // Credits for the digital texts shown.
    credit.textContent = "";
    for (const p of readable) {
      const line = el("span", null, p.ed.title + ": " + t("digitalText") + " ");
      const a = el("a", null, p.ed.text.source);
      a.href = p.ed.text.sourceUrl;
      a.target = "_blank";
      a.rel = "noopener";
      line.appendChild(a);
      credit.appendChild(line);
    }
    startTicker();
    setupPages();
  }

  // ---------- Page by page ----------
  // The reader becomes a window one screen high. Pages break between lines
  // (or paragraphs), never through one: each break is the top of the last
  // line that still fits. The part of a line below the break is hidden.
  const pager = { breaks: [0], i: 0, book: null, toEnd: false };

  function paged() {
    return prefs.view === "pages";
  }

  function pageWindow() {
    // Screen height less room for the page controls and a little margin.
    return Math.max(260, Math.floor(window.innerHeight - 120));
  }

  function computeBreaks() {
    const reader = $("reader");
    const H = reader.clientHeight;
    const origin = reader.getBoundingClientRect().top - reader.scrollTop;
    const tops = new Set();
    reader.querySelectorAll(".line, .grid-head, .reader-row, .pane-label, .reader-note, .trans p, .reader-msg").forEach((n) => {
      tops.add(Math.floor(n.getBoundingClientRect().top - origin));
    });
    const cand = [...tops].filter((x) => x > 0).sort((a, b) => a - b);
    const total = reader.scrollHeight - pageWindow();   // less the room left after the text
    const breaks = [0];
    let start = 0;
    while (start + H < total) {
      let next = 0;
      for (const x of cand) {
        if (x > start + H) break;
        if (x > start) next = x;
      }
      // Nothing to break at in the lower part (a very long paragraph): cut by height.
      if (next < start + H * 0.35) next = start + H - 32;
      breaks.push(next);
      start = next;
    }
    return breaks;
  }

  function showPage(i) {
    const reader = $("reader");
    const b = pager.breaks;
    pager.i = Math.max(0, Math.min(b.length - 1, i));
    const top = b[pager.i];
    const bottom = pager.i + 1 < b.length ? b[pager.i + 1] : top + reader.clientHeight;
    reader.scrollTop = top;
    reader.style.clipPath = "inset(0 0 " + Math.max(0, reader.clientHeight - (bottom - top)) + "px 0)";
    const last = pager.i === b.length - 1;
    const first = pager.i === 0;
    $("page-count").textContent = t("pageOf", { n: pager.i + 1, total: b.length });
    $("page-prev-label").textContent = first && state.book > 1 ? t("previousBook") : t("prevPage");
    $("page-next-label").textContent = last && state.book < 24 ? t("nextBook") : t("nextPage");
    $("page-prev").disabled = first && state.book <= 1;
    $("page-next").disabled = last && state.book >= 24;
    // The buttons at the sides of the page do the same, labelled to match.
    for (const [side, bottom] of [["side-prev", "page-prev"], ["side-next", "page-next"]]) {
      const label = $(bottom + "-label").textContent;
      $(side).disabled = $(bottom).disabled;
      $(side).title = label;
      $(side).setAttribute("aria-label", label);
    }
    pager.anchor = pageAnchor();   // remembered while the layout is still the one measured
  }

  // The first line (or paragraph) on the current page, so the same text can
  // stay in view when the pages are laid out again.
  function pageAnchor() {
    const reader = $("reader");
    const origin = reader.getBoundingClientRect().top - reader.scrollTop;
    const top = pager.breaks[pager.i] || 0;
    for (const n of reader.querySelectorAll(".line, .trans p")) {
      if (n.getBoundingClientRect().top - origin >= top - 1) return { n: n.dataset.n, col: n.dataset.col, node: n };
    }
    return null;
  }

  function pageOf(anchor) {
    if (!anchor) return 0;
    const reader = $("reader");
    let node = anchor.node.isConnected ? anchor.node
      : reader.querySelector('.line[data-n="' + anchor.n + '"][data-col="' + anchor.col + '"]');
    if (!node) return 0;
    const y = node.getBoundingClientRect().top - reader.getBoundingClientRect().top + reader.scrollTop;
    let i = 0;
    pager.breaks.forEach((x, j) => { if (x <= y + 2) i = j; });
    return i;
  }

  // Lay the pages out again (after a resize, a font change…), keeping the
  // same text at the top of the page.
  function relayoutPages() {
    if (!paged()) return;
    const reader = $("reader");
    const anchor = pager.anchor;
    reader.style.clipPath = "";
    reader.style.height = pageWindow() + "px";
    reader.style.setProperty("--page-h", pageWindow() + "px");
    pager.breaks = computeBreaks();
    showPage(pageOf(anchor));
  }

  function setupPages() {
    const reader = $("reader");
    const on = paged();
    reader.classList.toggle("paged", on);
    $("pager").hidden = !on;
    $("page-close").hidden = !on;
    $("side-prev").hidden = !on;
    $("side-next").hidden = !on;
    if (!on) {
      reader.style.height = "";
      reader.style.clipPath = "";
      reader.scrollTop = 0;
      return;
    }
    const newBook = pager.book !== state.book;
    const anchor = newBook ? null : pager.anchor;
    reader.style.clipPath = "";
    reader.style.height = pageWindow() + "px";
    reader.style.setProperty("--page-h", pageWindow() + "px");
    pager.breaks = computeBreaks();
    const i = pager.toEnd ? pager.breaks.length - 1 : pageOf(anchor);
    pager.book = state.book;
    pager.toEnd = false;
    showPage(i);
  }

  function turnPage(d) {
    if (!paged()) return;
    const i = pager.i + d;
    if (i < 0 || i >= pager.breaks.length) {
      const b = state.book + d;
      if (b < 1 || b > 24) return;
      pager.toEnd = d < 0;
      state.book = b;
      $("ed-book").value = b;
      renderReader();
    } else {
      showPage(i);
    }
    const top = $("reader").getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.3) $("reader").scrollIntoView({ block: "start" });
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
        const actions = el("div", "detail-actions");
        const go = () => $("reader-panel").scrollIntoView({ behavior: "smooth", block: "start" });
        const read = el("button", "btn", t("readThis"));
        read.type = "button";
        read.addEventListener("click", () => {
          const next = state.panes.slice();
          next[0] = "o:" + n.id;
          setPanes([...new Set(next)]);
          go();
        });
        actions.appendChild(read);
        if (!state.panes.includes("o:" + n.id) && state.panes.length < MAX_PANES) {
          const cmp = el("button", "btn", t("compare"));
          cmp.type = "button";
          cmp.addEventListener("click", () => { addPane("o:" + n.id); go(); });
          actions.appendChild(cmp);
        }
        box.appendChild(actions);
      } else if (status(n) === "notext") {
        box.appendChild(el("p", "detail-hint", t("notDigitised")));
      }
    }
    startTicker();
  }

  // ---------- page ----------

  // The record's descriptive text (stemma names, dates, notes) is written in
  // English in work.json; i18n.json holds its translations by language.
  function localize(raw, tr) {
    const w = JSON.parse(JSON.stringify(raw));
    const l = lang();
    const o = tr[l] || tr[l.split("-")[0]];
    if (!o) return w;
    if (o.stemmaNote) w.stemmaNote = o.stemmaNote;
    for (const n of w.nodes) Object.assign(n, (o.nodes || {})[n.id] || {});
    return w;
  }

  // ---------- Links to a passage ----------
  // #/work/iliad?text=t:monti&book=1&line=7&to=10, or &page=12&vol=II for
  // prose without line numbers. The text is added to the reader if needed,
  // the passage scrolled to (or its page shown) and highlighted for a moment.
  function readTarget(params) {
    if (!params || !(params.get("book") || params.get("slug"))) return null;
    const book = Number(params.get("book") || 1);
    if (!(book >= 1 && book <= 24)) return null;
    let text = params.get("text");
    const slug = params.get("slug");
    if (slug) {
      // A text named by its folder (texts/ita-monti → "ita-monti").
      const hit = [...work.nodes.map((n) => ["o:" + n.id, n]), ...work.translations.map((x) => ["t:" + x.id, x])]
        .find(([, e]) => e.text && e.text.path && e.text.path.split("/").pop() === slug);
      text = hit ? hit[0] : null;
    }
    const p = text && resolvePane(text);
    return {
      book,
      text: p && p.st === "read" ? text : null,
      line: Number(params.get("line")) || null,
      to: Number(params.get("to")) || null,
      page: params.get("page"),
      vol: params.get("vol"),
      slug: text ? resolvePane(text).ed.text.path.split("/").pop() : null,
    };
  }

  // The canonical address of a target, e.g. /iliad/ita-monti/1/7-10.
  function targetRoute(tg) {
    let r = "/" + work.id;
    if (!tg || !tg.slug) return r;
    r += "/" + tg.slug + "/" + tg.book;
    if (tg.line) r += "/" + tg.line + (tg.to && tg.to !== tg.line ? "-" + tg.to : "");
    else if (tg.page) r += "/" + (tg.vol ? tg.vol + "-" : "") + "p" + encodeURIComponent(tg.page);
    return r;
  }

  function applyTarget(tg) {
    state.book = tg.book;
    if (tg.text && !state.panes.includes(tg.text)) {
      state.panes.splice(Math.min(1, state.panes.length), 0, tg.text);
      state.panes = state.panes.slice(0, MAX_PANES);
    }
  }

  // The passage a link opened, while the address still names it: the Cite
  // window proposes it when nothing is selected.
  let lastTarget = null;

  function colOf(n) {
    const e = n && (n.nodeType === 1 ? n : n.parentElement);
    const c = e && e.closest("[data-col]");
    return c ? Number(c.dataset.col) : null;
  }

  function revealTarget(tg) {
    const reader = $("reader");
    const col = tg.text ? state.panes.indexOf(tg.text) : 0;
    const inCol = (sel) => [...reader.querySelectorAll(sel)].filter((n) => colOf(n) === col);
    let nodes = [];
    let point = null;
    if (tg.line) {
      const to = Math.max(tg.line, tg.to || tg.line);
      nodes = inCol(".line").filter((n) => +n.dataset.n >= tg.line && +n.dataset.n <= to);
      if (!nodes.length) {
        const ps = inCol("[data-from]").filter((n) => +n.dataset.from <= tg.line);
        if (ps.length) nodes = [ps[ps.length - 1]];
      }
    }
    if (!nodes.length && tg.page) {
      const m = inCol(".pb, .pb-inline").find((x) => x.dataset.page === tg.page && (!tg.vol || x.dataset.vol === tg.vol));
      if (m) {
        nodes = [m.closest(".line") || m.closest("p") || m];
        point = m; // the page starts at its mark, not where the paragraph starts
      }
    }
    if (!nodes.length) return;
    lastTarget = { route: Router.current(), col, nodes, point };
    for (const n of nodes) n.classList.add("cited");
    setTimeout(() => nodes.forEach((n) => n.classList.remove("cited")), 4000);
    if (paged()) {
      showPage(pageOf({ node: nodes[0] }));
      $("reader").scrollIntoView({ block: "start" });
    } else {
      nodes[0].scrollIntoView({ block: "center" });
    }
  }

  // Where a point of the text is: its line (or passage) and printed page.
  function pageAt(col, node, offset) {
    const reader = $("reader");
    const el0 = node.nodeType === 1 ? node : node.parentElement;
    const lineEl = el0.closest(".line");
    let found = null;
    for (const m of reader.querySelectorAll(".pb, .pb-inline")) {
      if (colOf(m) !== col) continue;
      let before;
      const ml = m.closest(".line");
      if (ml && lineEl) before = +ml.dataset.n <= +lineEl.dataset.n;
      else {
        const r = document.createRange();
        r.setStartBefore(ml || m);
        before = r.comparePoint(node, offset) >= 0;
      }
      if (before) found = m;
    }
    return found ? { page: found.dataset.page, vol: found.dataset.vol || null } : null;
  }

  function pointInfo(col, node, offset) {
    const e = node.nodeType === 1 ? node : node.parentElement;
    const line = e.closest(".line");
    const passage = e.closest("[data-from]");
    return {
      line: line ? Number(line.dataset.n) : null,
      from: passage ? Number(passage.dataset.from) : null,
      page: pageAt(col, node, offset),
    };
  }

  // The first line or paragraph of a text that is in view.
  function visibleStart(col) {
    const reader = $("reader");
    const top = Math.max(reader.getBoundingClientRect().top, 0);
    for (const n of reader.querySelectorAll(".line, .trans p")) {
      if (colOf(n) !== col) continue;
      const r = n.getBoundingClientRect();
      if (r.height && r.top >= top - 2) return n;
    }
    return null;
  }

  // For the Cite dialog: the passage selected (a Range in the reader), or
  // else what is at the top of the view, in the text of column col.
  function locate(range, col) {
    if (range) {
      const c = colOf(range.startContainer);
      if (c != null && (col == null || c === col)) {
        const a = pointInfo(c, range.startContainer, range.startOffset);
        const b = pointInfo(c, range.endContainer, range.endOffset);
        return { col: c, selected: true, start: a, end: b };
      }
    }
    const tg = lastTarget;
    if (tg && tg.route === Router.current() && (col == null || col === tg.col) && tg.nodes[0].isConnected) {
      const a = pointInfo(tg.col, tg.point || tg.nodes[0], 0);
      const z = tg.point || tg.nodes[tg.nodes.length - 1];
      return { col: tg.col, selected: false, start: a, end: pointInfo(tg.col, z, 0) };
    }
    if (col == null) col = state.panes.findIndex((id) => { const p = resolvePane(id); return p && p.st === "read"; });
    const n = col >= 0 && visibleStart(col);
    if (!n) return { col, selected: false, start: null, end: null };
    const a = pointInfo(col, n, 0);
    return { col, selected: false, start: a, end: a };
  }

  async function render(id, params) {
    const page = $("work");
    try {
      const [raw, tr] = await Promise.all([
        getJSON("data/works/" + id + "/work.json"),
        getJSON("data/works/" + id + "/i18n.json").catch(() => ({})),
      ]);
      work = localize(raw, tr);
    } catch (e) {
      page.querySelector(".work-head h1").textContent = t("nothingFound");
      return;
    }
    if (state.workId !== id) {
      state = { workId: id, panes: [], book: 1, selected: "omega" };
      choosePanes();
    }
    const target = readTarget(params);
    if (target) applyTarget(target);
    // Show the canonical address (an old "?text=…" link becomes /iliad/ita-monti/1/7).
    Router.go(target ? targetRoute(target) : "/" + work.id, true);
    document.title = (pick(work.titles) || work.id) + " — Mouseion";
    renderHeader();
    renderPaneBar();
    fillBookSelect();
    $("stemma-note").textContent = work.stemmaNote;
    renderStemma();
    renderDetail();
    await renderReader();
    if (target) revealTarget(target);
  }

  function rerender() {
    if (!work) return;
    renderPaneBar();
    renderStemma();
    renderDetail();
    renderReader();
  }

  function init() {
    $("work-country").addEventListener("change", (e) => {
      Rights.setCountry(e.target.value);
      rerender();
    });
    document.querySelectorAll("#reader-panel [data-layout]").forEach((b) => {
      b.addEventListener("click", () => {
        prefs.layout = b.dataset.layout;
        savePrefs();
        renderPaneBar();
        renderReader();
      });
    });
    const resize = (d) => {
      prefs.size = Math.max(-2, Math.min(4, prefs.size + d));
      savePrefs();
      $("reader").style.setProperty("--reader-scale", String(1 + prefs.size * 0.12));
      relayoutPages();
    };
    $("text-smaller").addEventListener("click", () => resize(-1));
    $("text-larger").addEventListener("click", () => resize(1));
    $("toggle-numbers").addEventListener("change", (e) => {
      prefs.numbers = e.target.checked;
      savePrefs();
      $("reader").classList.toggle("no-numbers", !prefs.numbers);
      relayoutPages();
    });
    $("toggle-pages").addEventListener("change", (e) => {
      prefs.pages = e.target.checked;
      savePrefs();
      $("reader").classList.toggle("no-pages", !prefs.pages);
    });
    document.querySelectorAll("#reader-panel [data-view]").forEach((b) => {
      b.addEventListener("click", () => {
        if (prefs.view === b.dataset.view) return;
        prefs.view = b.dataset.view;
        savePrefs();
        renderPaneBar();
        setupPages();
        if (paged()) $("reader").scrollIntoView({ block: "start" });
      });
    });
    // Leaving page view: back to scrolling, at the text that was on the page.
    const exitPages = () => {
      if (!paged()) return;
      const anchor = pager.anchor && pager.anchor.node;
      prefs.view = "scroll";
      savePrefs();
      renderPaneBar();
      setupPages();
      if (anchor && anchor.isConnected) anchor.scrollIntoView({ block: "start" });
      $("view-scroll-btn").focus({ preventScroll: true });
    };
    $("page-exit").addEventListener("click", exitPages);
    $("page-close").addEventListener("click", exitPages);
    $("page-prev").addEventListener("click", () => turnPage(-1));
    $("page-next").addEventListener("click", () => turnPage(1));
    $("side-prev").addEventListener("click", () => turnPage(-1));
    $("side-next").addEventListener("click", () => turnPage(1));
    // Arrow keys and Page Up/Down turn pages (not while typing or in a menu).
    document.addEventListener("keydown", (e) => {
      if (!paged() || $("work").hidden || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest && e.target.closest("input, select, textarea, [contenteditable], dialog, #stemma")) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") {
        if (!document.getElementById("language-gate").hidden) return;
        e.preventDefault();
        exitPages();
        return;
      }
      const d = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      turnPage(document.documentElement.dir === "rtl" && e.key.startsWith("Arrow") ? -d : d);
    });
    // Swipe left or right on a phone or tablet.
    let touch = null;
    $("reader").addEventListener("touchstart", (e) => {
      // Only when the text fits the width: otherwise a sideways swipe scrolls to the other columns.
      const r = $("reader");
      if (paged() && e.touches.length === 1 && r.scrollWidth <= r.clientWidth + 1) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    $("reader").addEventListener("touchend", (e) => {
      if (!touch || !paged()) return;
      const dx = e.changedTouches[0].clientX - touch.x;
      const dy = e.changedTouches[0].clientY - touch.y;
      touch = null;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 40 && !String(window.getSelection())) {
        const rtl = document.documentElement.dir === "rtl";
        turnPage((dx < 0) !== rtl ? 1 : -1);
      }
    }, { passive: true });
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(relayoutPages, 150);
    });
    if (document.fonts) document.fonts.ready.then(relayoutPages);
    $("add-pane").addEventListener("click", () => addPane());
    let selTimer;
    document.addEventListener("selectionchange", () => {
      clearTimeout(selTimer);
      selTimer = setTimeout(syncSelection, 120);
    });
    // Once the reader moves on, the address no longer names a passage.
    const leavePassage = () => { if (work) Router.go("/" + work.id, true); };
    $("ed-book").addEventListener("change", (e) => { state.book = Number(e.target.value); leavePassage(); renderReader(); });
    const step = (d) => {
      state.book = Math.min(24, Math.max(1, state.book + d));
      $("ed-book").value = state.book;
      leavePassage();
      renderReader();
      $("reader-panel").scrollIntoView({ block: "start" });
    };
    $("book-prev").addEventListener("click", () => step(-1));
    $("book-next").addEventListener("click", () => step(1));
  }

  init();

  // For the download dialog (js/download.js).
  const api = {
    work: () => work,
    book: () => state.book,
    panes: () => state.panes.slice(),
    t, pick, lang, langName, status, resolvePane, shortName, optionLabel,
    pageLabel, locate,
    reader: () => $("reader"),
    bookLabel: (n) => t("book") + " " + n + " · " + (work.bookLetters || BOOK_LETTERS)[n - 1],
    bookData: (ed, n) => getJSON(base() + ed.text.path + "/" + String(n).padStart(2, "0") + ".json"),
  };
  return { render, api };
})();
window.Work = Work;
