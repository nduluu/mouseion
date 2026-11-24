// Cite: a ready-made reference to the passage being read, in a few common
// styles, with a link that opens the reader at that passage.
//
// The passage is the text selected in the reader, or else what is at the top
// of the view. A reference names the printed edition (with volume and page
// where the text records them), the book and lines, the digital source and
// licence, and Mouseion with the date and a link.
const Cite = (() => {
  const W = () => window.Work && Work.api;
  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ---------- where the passage is ----------

  // The selection is read when the button is pressed (some browsers clear
  // it on the click).
  let captured = null;
  function capture() {
    captured = null;
    const sel = window.getSelection();
    const api = W();
    if (!api || !sel || !sel.rangeCount || sel.isCollapsed) return;
    const r = sel.getRangeAt(0);
    if (api.reader().contains(r.commonAncestorContainer)) captured = r.cloneRange();
  }

  // The printed page a verse line is on, from the text's data.
  function pageForLine(data, n) {
    let hit = null;
    for (const [first, page, , vol] of data.pages || []) {
      if (first <= n) hit = { page: String(page), vol: vol || null };
      else break;
    }
    return hit;
  }

  // ---------- the reference ----------

  const dash = "–";
  const range = (a, b) => (a == null ? "" : b != null && b !== a ? a + dash + b : String(a));
  const plainPage = (p) => String(p).replace(/^\[(.*)\]$/, "[$1]");

  function pagesEn(a, b) {
    if (!a) return "";
    const vol = a.vol ? "vol. " + a.vol + ", " : "";
    if (!b || (b.page === a.page && b.vol === a.vol)) return vol + "p. " + plainPage(a.page);
    if (b.vol !== a.vol) return vol + "p. " + a.page + dash + "vol. " + b.vol + ", p. " + b.page;
    return vol + "pp. " + a.page + dash + b.page;
  }

  function yearOf(c) {
    const m = String(c.edition || c.date || "").match(/1[4-9]\d\d|20\d\d/g);
    return m ? m[m.length - 1] : "";
  }

  function names(list) {
    if (list.length <= 1) return list.join("");
    return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }

  // Everything a reference needs, in one object.
  function facts(id, loc, lines) {
    const api = W();
    const { work, pick, resolvePane } = api;
    const w = work();
    const p = resolvePane(id);
    const ed = p.ed;
    const book = api.book();
    const start = loc && loc.start;
    const end = loc && loc.end;
    const verse = !!lines;
    return {
      p, ed, book,
      orig: p.kind === "orig",
      author: (w.author && (w.author.en || pick(w.author))) || "",
      authorLocal: (w.author && pick(w.author)) || "",
      workEn: (w.titles && (w.titles.en || pick(w.titles))) || "",
      workLocal: (w.titles && pick(w.titles)) || "",
      title: ed.title,
      people: (ed.creators || []).map((c) => c.name),
      edition: ed.text.pages ? ed.text.pages.edition : "",
      date: ed.date,
      source: ed.text.source,
      lineFrom: verse ? lines.from : start && start.from,
      lineTo: verse ? lines.to : end && end.from && end.from !== start.from ? end.from : null,
      lineKind: verse ? "lines" : start && start.from ? "from" : null,
      pageFrom: (verse ? lines.pageFrom : start && start.page) || null,
      pageTo: (verse ? lines.pageTo : end && end.page) || null,
    };
  }

  // The passage's permanent address: /iliad/ita-monti/1/8-10, or
  // /iliad/fra-leconte/1/p5 (II-p12 with a volume) for prose without lines.
  function link(f) {
    const slug = f.ed.text.path.split("/").pop();
    let r = "/" + W().work().id + "/" + slug + "/" + f.book;
    if (f.lineFrom) r += "/" + f.lineFrom + (f.lineTo && f.lineTo !== f.lineFrom ? "-" + f.lineTo : "");
    else if (f.pageFrom) r += "/" + (f.pageFrom.vol ? f.pageFrom.vol + "-" : "") + "p" + encodeURIComponent(f.pageFrom.page);
    return Router.absolute(r);
  }

  // "1.7–10": book and line(s) in the original's numbering.
  const canon = (f) => f.book + (f.lineFrom ? "." + range(f.lineFrom, f.lineTo) : "");

  // "bk. 1, ll. 7–10"; for prose that refers to the Greek line numbers,
  // "bk. 1, at Greek l. 22".
  function whereEn(f) {
    let s = "bk. " + f.book;
    if (!f.lineFrom) return s;
    const many = f.lineTo && f.lineTo !== f.lineFrom;
    if (f.lineKind === "from") return s + ", at " + (f.orig ? "" : "Greek ") + (many ? "ll. " : "l. ") + range(f.lineFrom, f.lineTo);
    return s + (many ? ", ll. " : ", l. ") + range(f.lineFrom, f.lineTo);
  }

  // Join parts into sentences without doubling a full stop ("2 voll.").
  const stop = (s) => (/[.!?]$/.test(s) ? s : s + ".");

  function chicago(f, url, today) {
    const pub = f.edition || f.date;
    const pages = pagesEn(f.pageFrom, f.pageTo);
    let h;
    if (f.orig) {
      h = esc(f.author) + ", <i>" + esc(f.workEn) + "</i> " + esc(canon(f)) + ", ed. " + esc(names(f.people)) +
        ", <i>" + esc(f.title) + "</i> (" + esc(pub) + ")" + (pages ? ", " + esc(pages) : "");
    } else {
      h = esc(f.author) + ", <i>" + esc(f.title) + "</i>, trans. " + esc(names(f.people)) + " (" + esc(pub) + "), " +
        (pages ? esc(pages) + " (" + esc(whereEn(f)) + ")" : esc(whereEn(f)));
    }
    h += ", digital text from " + esc(f.source) + ", via Mouseion, accessed " + esc(today.en) + ", " + esc(url) + ".";
    return h;
  }

  function mla(f, url, today) {
    const pub = f.edition || f.date;
    const pages = pagesEn(f.pageFrom, f.pageTo);
    let h = esc(f.author) + ". <i>" + esc(f.title) + "</i>. " + (f.orig ? "Edited by " : "Translated by ") +
      esc(names(f.people)) + ", " + esc(stop(pub)) + " ";
    h += f.orig ? esc(f.workEn) + " " + esc(canon(f)) + (pages ? ", " + esc(pages) : "") + ". "
      : (pages ? esc(pages.charAt(0).toUpperCase() + pages.slice(1)) + ", " : "") + esc(whereEn(f)) + ". ";
    h += "<i>Mouseion</i>, " + esc(url) + ". Accessed " + esc(today.mla) + ".";
    return h;
  }

  function bibtex(f, url, today) {
    const ascii = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
    const who = f.people.length ? f.people[0].split(" ").pop() : f.ed.id;
    const year = yearOf(f);
    const key = [ascii(f.author) || "anon", ascii(who), year].filter(Boolean).join("_");
    const people = f.people.map((n) => "{" + n + "}").join(" and ");
    const fields = [
      ["author", "{" + f.author + "}"],
      [f.orig ? "editor" : "translator", people],
      ["title", "{" + f.title + "}"],
      ["year", year],
      ["note", [String(f.edition || f.date).replace(/\.$/, ""), "Book " + f.book + (f.lineFrom ? (f.lineTo && f.lineTo !== f.lineFrom ? ", lines " + f.lineFrom + "--" + f.lineTo : ", line " + f.lineFrom) : ""),
        "Digital text: " + f.source].filter(Boolean).join(". ")],
      ["url", url],
      ["urldate", today.iso],
    ];
    if (f.pageFrom) {
      if (f.pageFrom.vol) fields.splice(4, 0, ["volume", f.pageFrom.vol]);
      const pp = f.pageTo && f.pageTo.page !== f.pageFrom.page ? f.pageFrom.page + "--" + f.pageTo.page : f.pageFrom.page;
      fields.splice(4, 0, ["pages", String(pp)]);
    }
    const body = fields.filter(([, v]) => v).map(([k, v]) => "  " + k + " = {" + v + "}").join(",\n");
    return esc("@book{" + key + ",\n" + body + "\n}");
  }

  // A short reference in the visitor's language.
  function short(f, url, today) {
    const { t, pageLabel } = W();
    const pg = f.pageFrom ? pageLabel(f.pageFrom.page, f.pageFrom.vol) +
      (f.pageTo && f.pageTo.page !== f.pageFrom.page ? dash + f.pageTo.page : "") : "";
    const role = f.orig ? t("citeEdBy") : t("citeTransBy");
    // The original and prose keyed to it use the Greek numbering ("1.7–10");
    // a verse translation's own line numbers come after its page.
    const own = !f.orig && f.lineKind === "lines";
    let s = esc(f.authorLocal) + ", <i>" + esc(f.workLocal) + "</i> " + esc(own ? String(f.book) : canon(f));
    s += " — " + esc(role) + " " + esc(f.people.join(", ")) + ", <i>" + esc(f.title) + "</i>, " + esc(f.edition || f.date);
    if (pg) s += ", " + esc(pg);
    if (own) s += ", " + esc(t("citeLinesShort")) + " " + esc(range(f.lineFrom, f.lineTo));
    s += " — Mouseion, " + esc(today.local) + ": " + esc(url);
    return s;
  }

  // ---------- a personal format (set in the account settings) ----------
  //
  // A template with fields in braces, e.g.
  //   {author}: *{title}*.[ Übers. von {translator}.] {edition}[, Bd. {volume}][, S. {pages}].
  // *Stars* make italics; a part in [square brackets] appears only when all
  // the fields in it have a value (a page number, a translator …).

  const FIELDS = ["author", "work", "title", "translator", "editor", "edition", "year", "book", "lines", "ref",
    "volume", "pages", "source", "url", "accessed"];

  function fieldValues(f, url, today) {
    const pages = f.pageFrom
      ? plainPage(f.pageFrom.page) + (f.pageTo && f.pageTo.page !== f.pageFrom.page ? dash + plainPage(f.pageTo.page) : "")
      : "";
    return {
      author: f.authorLocal || f.author,
      work: f.workLocal || f.workEn,
      title: f.title,
      translator: f.orig ? "" : f.people.join(", "),
      editor: f.orig ? f.people.join(", ") : "",
      edition: f.edition || f.date || "",
      year: yearOf(f),
      book: String(f.book),
      lines: f.lineFrom ? range(f.lineFrom, f.lineTo) : "",
      ref: canon(f),
      volume: (f.pageFrom && f.pageFrom.vol) || "",
      pages,
      source: f.source || "",
      url,
      accessed: today.local,
    };
  }

  function fill(template, values) {
    const render = (s) => esc(s).replace(/\{(\w+)\}/g, (m, k) => (k in values ? esc(values[k] || "") : m));
    let html = "";
    let i = 0;
    const re = /\[([^[\]]*)\]/g;
    let m;
    while ((m = re.exec(template))) {
      html += render(template.slice(i, m.index));
      const keys = [...m[1].matchAll(/\{(\w+)\}/g)].map((x) => x[1]).filter((k) => k in values);
      if (!keys.length) html += render(m[0]); // ordinary brackets
      else if (keys.every((k) => values[k])) html += render(m[1]);
      i = re.lastIndex;
    }
    html += render(template.slice(i));
    return html.replace(/\*([^*\n]+)\*/g, "<i>$1</i>").replace(/\n/g, "<br>").replace(/ {2,}/g, " ").trim();
  }

  // Starting points for a personal format. Common conventions, to be
  // adjusted to what a university or journal asks for.
  const PRESETS = {
    chicago: "{author}, *{title}*[, trans. {translator}][, ed. {editor}] ({edition})[, vol. {volume}][, {pages}], bk. {book}[, ll. {lines}], {url}.",
    mla: "{author}. *{title}*.[ Translated by {translator},][ Edited by {editor},] {edition}.[ Vol. {volume},][ p. {pages},] bk. {book}[, ll. {lines}]. *Mouseion*, {url}. Accessed {accessed}.",
    apa: "{author}. ({year}). *{title}*[ ({translator}, Trans.)][ ({editor}, Ed.)]. Mouseion. {url}",
    harvard: "{author} ({year}) *{title}*.[ Translated by {translator}.][ Edited by {editor}.] {edition}.[ Vol. {volume},][ p. {pages}.] Available at: {url} (Accessed: {accessed}).",
    de: "{author}: *{title}*.[ Übers. von {translator}.][ Hrsg. von {editor}.] {edition}[, Bd. {volume}][, S. {pages}] ({ref}). Online: Mouseion, {url} (Zugriff: {accessed}).",
    blank: "",
  };

  function userFormat() {
    try {
      const u = JSON.parse(localStorage.getItem("mouseion.user") || "null");
      return u && u.citation && u.citation.template ? u.citation : null;
    } catch (e) {
      return null;
    }
  }

  function mine(f, url, today) {
    const c = userFormat();
    return c ? fill(c.template, fieldValues(f, url, today)) : "";
  }

  const STYLES = [
    ["mine", "styleMine", mine],
    ["short", "styleShort", short],
    ["chicago", null, chicago],
    ["mla", null, mla],
    ["bibtex", null, bibtex],
  ];

  // ---------- copying ----------

  async function copy(html, text) {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        })]);
        return true;
      }
      if (navigator.clipboard) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall through */ }
    try {
      const ta = el("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  // ---------- the dialog ----------

  let dialog = null;
  let style = null; // the style last chosen during this visit

  async function open(range) {
    const api = W();
    if (!api || !api.work()) return;
    const { t, resolvePane, shortName, lang } = api;
    const panes = api.panes();
    const readable = panes.map((id, col) => ({ id, col, p: resolvePane(id) })).filter((x) => x.p && x.p.st === "read");

    if (dialog) dialog.remove();
    dialog = el("dialog", "dl-dialog cite-dialog");
    const form = el("form");
    form.method = "dialog";
    form.appendChild(el("h3", "dl-title", t("citeTitle")));
    if (!readable.length) {
      form.appendChild(el("p", null, t("dlNoText")));
      const close = el("button", "btn", t("close"));
      close.value = "cancel";
      form.appendChild(close);
      dialog.appendChild(form);
      document.body.appendChild(dialog);
      dialog.showModal();
      return;
    }

    let loc = api.locate(range, null);
    const first = readable.find((x) => x.col === loc.col) || readable[0];

    const textLabel = el("label", "dl-field");
    textLabel.appendChild(el("span", "dl-legend", t("dlText")));
    const sel = el("select");
    sel.id = "cite-text";
    for (const x of readable) {
      const o = el("option", null, shortName(x.p));
      o.value = String(x.col);
      sel.appendChild(o);
    }
    sel.value = String(first.col);
    textLabel.appendChild(sel);
    form.appendChild(textLabel);

    // Passage: book, and lines (editable for verse).
    const where = el("fieldset", "dl-field cite-where");
    where.appendChild(el("legend", "dl-legend", t("citePassage")));
    const row = el("div", "cite-row");
    const bookSpan = el("span", "cite-book", api.bookLabel(api.book()));
    const linesWrap = el("span", "cite-lines");
    const fromIn = el("input");
    const toIn = el("input");
    for (const i of [fromIn, toIn]) { i.type = "number"; i.min = "1"; i.inputMode = "numeric"; }
    fromIn.setAttribute("aria-label", t("citeLineFrom"));
    toIn.setAttribute("aria-label", t("citeLineTo"));
    linesWrap.append(el("span", null, t("citeLines") + " "), fromIn, el("span", null, " " + dash + " "), toIn);
    row.append(bookSpan, linesWrap);
    where.appendChild(row);
    const hint = el("p", "dl-note cite-hint");
    where.appendChild(hint);
    form.appendChild(where);

    const styles = el("div", "seg cite-styles");
    styles.setAttribute("role", "group");
    styles.setAttribute("aria-label", t("citeStyle"));
    const own = userFormat();
    if (!style || (style === "mine" && !own)) style = own && own.first ? "mine" : "short";
    for (const [key, label] of STYLES) {
      if (key === "mine" && !own) continue;
      const b = el("button", null, label ? t(label) : key === "bibtex" ? "BibTeX" : key === "mla" ? "MLA" : "Chicago");
      b.type = "button";
      b.dataset.style = key;
      styles.appendChild(b);
    }
    form.appendChild(styles);
    // Where to set up one's own format.
    const signedIn = !!localStorage.getItem("mouseion.user");
    const mineLink = el("a", "cite-mine-link", t(own ? "citeEditMine" : signedIn ? "citeMakeMine" : "citeSignInMine"));
    mineLink.href = "#/account";
    mineLink.addEventListener("click", () => dialog && dialog.close());

    form.appendChild(mineLink);
    const out = el("div", "cite-out");
    out.id = "cite-out";
    out.setAttribute("aria-live", "polite");
    form.appendChild(out);

    const linkLabel = el("label", "dl-field cite-link");
    linkLabel.appendChild(el("span", "dl-legend", t("citeLink")));
    const linkIn = el("input");
    linkIn.readOnly = true;
    linkIn.id = "cite-url";
    linkLabel.appendChild(linkIn);
    form.appendChild(linkLabel);

    const status = el("p", "dl-status");
    form.appendChild(status);
    const actions = el("div", "dl-actions");
    const close = el("button", "btn", t("close"));
    close.value = "cancel";
    const copyLink = el("button", "btn", t("copyLink"));
    copyLink.type = "button";
    const copyRef = el("button", "btn btn-primary", t("copy"));
    copyRef.type = "button";
    actions.append(close, copyLink, copyRef);
    form.appendChild(actions);

    const today = new Date();
    const dates = {
      en: new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(today),
      mla: today.getDate() + " " + ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."][today.getMonth()] + " " + today.getFullYear(),
      iso: today.toISOString().slice(0, 10),
      local: new Intl.DateTimeFormat(lang(), { dateStyle: "long" }).format(today),
    };

    let current = { html: "", text: "", url: "" };
    let data = null;
    let col = first.col;

    async function loadData() {
      const p = resolvePane(panes[col]);
      data = null;
      try { data = await api.bookData(p.ed, api.book()); } catch (e) { /* no data: no pages from lines */ }
    }

    function setLinesFromLoc() {
      const verse = data && data.lines;
      linesWrap.hidden = !verse;
      if (verse) {
        const a = loc.start && loc.start.line;
        const b = loc.end && loc.end.line;
        fromIn.value = a || 1;
        toIn.value = b && b !== a ? b : "";
        const last = data.lines.length ? data.lines[data.lines.length - 1][0] : 1;
        fromIn.max = toIn.max = String(last);
      }
      hint.textContent = loc.selected ? t("citeFromSelection") : t("citeHint");
    }

    function update() {
      let lines = null;
      if (data && data.lines) {
        const last = data.lines.length ? data.lines[data.lines.length - 1][0] : 1;
        let a = Math.min(last, Math.max(1, parseInt(fromIn.value, 10) || 1));
        let b = parseInt(toIn.value, 10);
        b = b ? Math.min(last, Math.max(a, b)) : null;
        lines = { from: a, to: b, pageFrom: pageForLine(data, a), pageTo: b ? pageForLine(data, b) : null };
      }
      const f = facts(panes[col], loc, lines);
      const url = link(f);
      const fn = STYLES.find((x) => x[0] === style)[2];
      const html = fn(f, url, dates);
      const tmp = el("div");
      tmp.innerHTML = html;
      current = { html: style === "bibtex" ? "<pre>" + html + "</pre>" : html, text: tmp.textContent, url };
      out.innerHTML = style === "bibtex" ? "<pre>" + html + "</pre>" : html;
      out.classList.toggle("is-code", style === "bibtex");
      linkIn.value = url;
      styles.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.style === style)));
      status.textContent = "";
    }

    sel.addEventListener("change", async () => {
      col = Number(sel.value);
      loc = api.locate(range, col);
      await loadData();
      setLinesFromLoc();
      update();
    });
    fromIn.addEventListener("input", update);
    toIn.addEventListener("input", update);
    styles.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-style]");
      if (!b) return;
      style = b.dataset.style;
      update();
    });
    copyRef.addEventListener("click", async () => {
      status.textContent = (await copy(current.html, current.text)) ? t("copied") : t("copyFailed");
    });
    copyLink.addEventListener("click", async () => {
      status.textContent = (await copy(esc(current.url), current.url)) ? t("copied") : t("copyFailed");
    });
    linkIn.addEventListener("focus", () => linkIn.select());
    dialog.addEventListener("close", () => { dialog.remove(); dialog = null; });

    dialog.appendChild(form);
    document.body.appendChild(dialog);
    await loadData();
    setLinesFromLoc();
    update();
    dialog.showModal();
  }

  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest("#cite-btn")) capture();
  }, true);
  document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest("#cite-btn")) return;
    if (!captured) capture();
    const r = captured;
    captured = null;
    open(r);
  });

  // ---------- the settings box in the account page ----------

  // Two sample passages for the preview: a translation with volume and page,
  // and the original.
  function samples() {
    const { pick } = M;
    const author = { en: "Homer", de: "Homer", fr: "Homère", it: "Omero", es: "Homero", ru: "Гомер" };
    const work = { en: "Iliad", de: "Ilias", fr: "Iliade", it: "Iliade", es: "Ilíada", ru: "Илиада" };
    const base = { author: "Homer", authorLocal: pick(author), workEn: "Iliad", workLocal: pick(work), book: 1 };
    return [
      ["citeSampleTrans", { ...base, orig: false, title: "Iliade", people: ["Vincenzo Monti"],
        edition: "Milano, Società Tipografica de' Classici Italiani, 1825", date: "1825", lineFrom: 8, lineTo: 10,
        lineKind: "lines", pageFrom: { page: "2", vol: "I" }, pageTo: { page: "2", vol: "I" },
        source: "Wikisource (CC BY-SA 4.0)" }, "/iliad/ita-monti/1/8-10"],
      ["citeSampleOrig", { ...base, orig: true, title: "Homeri Opera (Oxford Classical Texts)",
        people: ["David B. Monro", "Thomas W. Allen"], edition: "", date: "1902; 3rd edition 1920", lineFrom: 1, lineTo: 7,
        lineKind: "lines", pageFrom: null, pageTo: null, source: "Perseus Digital Library (CC BY-SA 4.0)" },
        "/iliad/grc-monro-allen/1/1-7"],
    ];
  }

  // Fills the box (#cite-settings) for the signed-in user; changes are saved
  // with the account as they are typed (save merges them into the account).
  function renderSettings(box, user, save) {
    const { t } = M;
    box.textContent = "";
    const c = user.citation || { template: "", first: true };
    box.appendChild(el("h3", "settings-title", t("myCitation")));
    box.appendChild(el("p", "settings-note", t("myCitationIntro")));

    const startRow = el("label", "setting");
    startRow.appendChild(el("span", null, t("citeStartFrom")));
    const start = el("select");
    start.appendChild(el("option", null, dash));
    start.firstChild.value = "";
    for (const [key, label] of [["chicago", "Chicago"], ["mla", "MLA"], ["apa", "APA"], ["harvard", "Harvard"],
      ["de", t("citePresetDe")], ["blank", t("citeBlank")]]) {
      const o = el("option", null, label);
      o.value = key;
      start.appendChild(o);
    }
    startRow.appendChild(start);
    box.appendChild(startRow);

    const area = el("textarea", "cite-template");
    area.id = "cite-template";
    area.rows = 4;
    area.spellcheck = false;
    area.value = c.template || "";
    area.setAttribute("aria-label", t("myCitation"));
    box.appendChild(area);

    box.appendChild(el("p", "settings-note", t("citeFieldsHelp")));
    const chips = el("div", "cite-fields");
    for (const k of FIELDS) {
      const b = el("button", "cite-field", "{" + k + "}");
      b.type = "button";
      b.title = t("cf_" + k);
      b.addEventListener("click", () => {
        const a = area.selectionStart, z = area.selectionEnd;
        area.setRangeText("{" + k + "}", a, z, "end");
        area.focus();
        changed();
      });
      chips.appendChild(b);
    }
    box.appendChild(chips);
    box.appendChild(el("p", "settings-note", t("citeSyntax")));

    const prev = el("div", "cite-previews");
    box.appendChild(el("h4", "settings-sub", t("citePreview")));
    box.appendChild(prev);

    const firstRow = el("label", "check");
    const first = el("input");
    first.type = "checkbox";
    first.checked = c.first !== false;
    firstRow.append(first, el("span", null, " " + t("citeUseFirst")));
    box.appendChild(firstRow);
    const status = el("p", "dl-status");
    box.appendChild(status);

    const today = new Date();
    const dates = { local: new Intl.DateTimeFormat(M.lang(), { dateStyle: "long" }).format(today) };
    function preview() {
      prev.textContent = "";
      for (const [label, f, route] of samples()) {
        prev.appendChild(el("p", "cite-sample-label", t(label)));
        const out = el("div", "cite-out");
        out.innerHTML = area.value.trim() ? fill(area.value, fieldValues(f, Router.absolute(route), dates)) : dash;
        prev.appendChild(out);
      }
    }
    let timer;
    function changed() {
      preview();
      clearTimeout(timer);
      timer = setTimeout(() => {
        save({ citation: { template: area.value, first: first.checked } });
        status.textContent = t("saved");
      }, 400);
    }
    start.addEventListener("change", () => {
      if (!start.value) return;
      area.value = PRESETS[start.value];
      start.value = "";
      changed();
      area.focus();
    });
    area.addEventListener("input", changed);
    first.addEventListener("change", changed);
    preview();
  }

  return { open, renderSettings, fill };
})();
window.Cite = Cite;
