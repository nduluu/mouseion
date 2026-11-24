// Download or print a public-domain text: PDF (through the browser's print
// window, "Save as PDF"), EPUB for e-readers, or plain text. Every file
// carries the text's bibliographic details and the credit its licence asks for.
const Download = (() => {
  const W = () => Work.api;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const BOOKS = 24;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Texts the visitor may read here (public domain in their country, digitised).
  function readableTexts() {
    const { work, status } = W();
    const w = work();
    const origs = w.nodes.filter((n) => n.kind === "edition" && n.lang === w.originalLanguage && status(n) === "read")
      .map((ed) => "o:" + ed.id);
    const trans = w.translations.filter((x) => status(x) === "read").map((x) => "t:" + x.id);
    return [...origs, ...trans];
  }

  // ---------- the dialog ----------

  let dialog = null;

  function radio(name, value, label, checked) {
    const l = el("label", "dl-choice");
    const i = el("input");
    i.type = "radio";
    i.name = name;
    i.value = value;
    i.checked = !!checked;
    l.appendChild(i);
    l.appendChild(el("span", null, label));
    return l;
  }

  function open() {
    const { t, panes, resolvePane, shortName, book, bookLabel } = W();
    const ids = readableTexts();
    if (dialog) dialog.remove();
    dialog = el("dialog", "dl-dialog");
    const form = el("form");
    form.method = "dialog";
    form.appendChild(el("h3", "dl-title", t("dlTitle")));

    if (!ids.length) {
      form.appendChild(el("p", null, t("dlNoText")));
      const close = el("button", "btn", t("cancel"));
      close.value = "cancel";
      form.appendChild(close);
      dialog.appendChild(form);
      document.body.appendChild(dialog);
      dialog.showModal();
      return;
    }

    // Text: the readable texts, the one in the first pane chosen.
    const textLabel = el("label", "dl-field");
    textLabel.appendChild(el("span", "dl-legend", t("dlText")));
    const sel = el("select");
    sel.id = "dl-text";
    for (const id of ids) {
      const o = el("option", null, shortName(resolvePane(id)));
      o.value = id;
      sel.appendChild(o);
    }
    const shown = panes().find((id) => ids.includes(id));
    if (shown) sel.value = shown;
    textLabel.appendChild(sel);
    form.appendChild(textLabel);

    const books = el("fieldset", "dl-field");
    books.appendChild(el("legend", "dl-legend", t("dlBooks")));
    books.appendChild(radio("dl-range", "book", t("dlThisBook", { book: bookLabel(book()) }), true));
    books.appendChild(radio("dl-range", "all", t("dlAllBooks", { n: BOOKS })));
    form.appendChild(books);

    const fmt = el("fieldset", "dl-field");
    fmt.appendChild(el("legend", "dl-legend", t("dlFormat")));
    fmt.appendChild(radio("dl-format", "pdf", t("fmtPdf"), true));
    fmt.appendChild(radio("dl-format", "epub", t("fmtEpub")));
    fmt.appendChild(radio("dl-format", "txt", t("fmtTxt")));
    fmt.appendChild(radio("dl-format", "view", t("fmtView")));
    form.appendChild(fmt);

    form.appendChild(el("p", "dl-note", t("dlLicence")));
    const status = el("p", "dl-status");
    status.setAttribute("role", "status");
    form.appendChild(status);

    const actions = el("div", "dl-actions");
    const cancel = el("button", "btn", t("cancel"));
    cancel.value = "cancel";
    const go = el("button", "btn btn-primary");
    go.type = "button";
    actions.appendChild(cancel);
    actions.appendChild(go);
    form.appendChild(actions);

    const sync = () => {
      const f = form.elements["dl-format"].value;
      const print = f === "pdf" || f === "view";
      go.textContent = print ? t("dlPrint") : t("dlDownload");
      // "This page" prints what the reader shows: its texts and its book.
      sel.disabled = f === "view";
      for (const r of form.querySelectorAll("[name=dl-range]")) r.disabled = f === "view";
    };
    form.addEventListener("change", sync);
    sync();

    go.addEventListener("click", async () => {
      const f = form.elements["dl-format"].value;
      const range = form.elements["dl-range"].value;
      go.disabled = true;
      status.textContent = t("dlPreparing");
      try {
        if (f === "view") printView();
        else {
          const doc = await collect(sel.value, range === "all" ? null : book());
          if (f === "txt") save(toTxt(doc), "text/plain;charset=utf-8", doc.file + ".txt");
          if (f === "epub") save(toEpub(doc), "application/epub+zip", doc.file + ".epub");
          if (f === "pdf") printDoc(doc);
        }
        dialog.close();
      } catch (e) {
        console.error(e);
        status.textContent = t("dlFailed");
      } finally {
        go.disabled = false;
      }
    });

    dialog.appendChild(form);
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  // ---------- the document ----------

  async function collect(id, only) {
    const { work, t, pick, lang, langName, resolvePane, bookLabel, bookData } = W();
    const w = work();
    const p = resolvePane(id);
    const ed = p.ed;
    const numbers = only ? [only] : Array.from({ length: BOOKS }, (_, i) => i + 1);
    const books = [];
    for (const n of numbers) {
      const d = await bookData(ed, n);
      books.push({ n, label: bookLabel(n), lines: d.lines || null, passages: d.passages || null,
        pages: new Map((d.pages || []).map(([line, label]) => [line, label])) });
    }
    const creators = (ed.creators || []).map((c) => c.name + (c.died ? " (†" + c.died + ")" : "")).join(", ");
    const country = Rights.countryName(Rights.country(), lang());
    const today = new Intl.DateTimeFormat(lang(), { dateStyle: "long" }).format(new Date());
    const digital = t("digitalText");
    const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    return {
      lang: p.lang,
      workTitle: pick(w.titles),
      originalTitle: w.titles[w.originalLanguage] || "",
      title: ed.title,
      creators,
      date: ed.date,
      language: langName(p.lang),
      source: ed.text.source,
      sourceUrl: ed.text.sourceUrl,
      credit: digital.charAt(0).toUpperCase() + digital.slice(1) + " " + ed.text.source + ".",
      licence: t("dlLicence"),
      pagesNote: ed.text.pages ? t("dlPagesNote", { edition: ed.text.pages.edition }) : "",
      page: (label) => "[" + t("pageAbbr") + "\u00a0" + String(label).replace(/^\[(.*)\]$/, "$1") + "]",
      pd: t("pdIn", { country }),
      from: t("dlFromMouseion", { date: today }),
      books,
      file: [w.id, slug((ed.creators || [{ name: ed.id }])[0].name) || ed.id, only ? "book-" + String(only).padStart(2, "0") : "complete"].join("_"),
      id: "mouseion:" + w.id + ":" + ed.id,
    };
  }

  function metaLines(doc) {
    return [
      doc.workTitle + (doc.originalTitle && doc.originalTitle !== doc.workTitle ? " (" + doc.originalTitle + ")" : ""),
      doc.title + (doc.creators ? " — " + doc.creators : "") + (doc.date ? ", " + doc.date : ""),
      doc.language,
      "",
      doc.credit,
      doc.sourceUrl,
      doc.licence,
      ...(doc.pagesNote ? [doc.pagesNote] : []),
      doc.pd,
      doc.from,
    ];
  }

  // ---------- plain text ----------

  function toTxt(doc) {
    const out = [...metaLines(doc), ""];
    for (const b of doc.books) {
      out.push("", "=".repeat(40), b.label, "=".repeat(40), "");
      if (b.lines) {
        for (const [n, text] of b.lines) {
          if (b.pages.has(n)) out.push(" ".repeat(7) + doc.page(b.pages.get(n)));
          out.push((n % 5 === 0 ? String(n) : "").padStart(5) + "  " + text);
        }
      } else {
        for (const ps of b.passages) {
          const paras = ps.text.split("\n\n");
          paras.forEach((para, i) => out.push((i === 0 && ps.from != null ? "[" + ps.from + "] " : "") + para, ""));
        }
      }
    }
    return out.join("\n") + "\n";
  }

  // ---------- HTML of the text (for print and EPUB) ----------

  function bookHtml(b, doc) {
    let h = "<h2>" + esc(b.label) + "</h2>\n";
    if (b.lines) {
      for (const [n, text] of b.lines) {
        if (b.pages.has(n)) h += '<p class="pgb">' + esc(doc.page(b.pages.get(n))) + "</p>\n";
        h += '<p class="l"><span class="n">' + (n % 5 === 0 ? n : "") + "</span>" + esc(text) + "</p>\n";
      }
    } else {
      for (const ps of b.passages) {
        ps.text.split("\n\n").forEach((para, i) => {
          const ref = i === 0 && ps.from != null ? '<span class="ref">' + ps.from + "</span> " : "";
          h += "<p>" + ref + esc(para) + "</p>\n";
        });
      }
    }
    return h;
  }

  function titleHtml(doc) {
    return '<h1>' + esc(doc.workTitle) + "</h1>\n" +
      (doc.originalTitle && doc.originalTitle !== doc.workTitle ? '<p class="orig-title">' + esc(doc.originalTitle) + "</p>\n" : "") +
      '<p class="ed">' + esc(doc.title) + "</p>\n" +
      (doc.creators ? '<p class="by">' + esc(doc.creators) + (doc.date ? ", " + esc(doc.date) : "") + "</p>\n" : "") +
      '<div class="credits"><p>' + esc(doc.credit) + "<br/>" + esc(doc.sourceUrl) + "</p><p>" + esc(doc.licence) +
      (doc.pagesNote ? "</p><p>" + esc(doc.pagesNote) : "") + "</p><p>" + esc(doc.pd) + "</p><p>" + esc(doc.from) + "</p></div>\n";
  }

  // ---------- print / PDF ----------

  function printArea() {
    let a = $("print-area");
    if (!a) {
      a = el("div");
      a.id = "print-area";
      document.body.appendChild(a);
    }
    return a;
  }

  function doPrint() {
    document.body.classList.add("printing");
    const done = () => {
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 50);
  }

  function printDoc(doc) {
    const a = printArea();
    a.className = "print-doc";
    a.lang = doc.lang;
    a.innerHTML = '<section class="title-page">' + titleHtml(doc) + "</section>" +
      doc.books.map((b) => '<section class="book">' + bookHtml(b, doc) + "</section>").join("");
    doPrint();
  }

  // What the reader shows now, side by side, with the credits.
  function printView() {
    const a = printArea();
    a.className = "print-view";
    a.textContent = "";
    a.appendChild(el("h1", null, $("work-title").textContent + " — " + $("ed-book").selectedOptions[0].textContent));
    const names = el("p", "print-panes");
    names.textContent = [...document.querySelectorAll("#pane-bar select")].map((s) => s.selectedOptions[0] && s.selectedOptions[0].textContent).filter(Boolean).join("  |  ");
    a.appendChild(names);
    a.appendChild($("reader").cloneNode(true)).removeAttribute("id");
    const credit = $("reader-credit").cloneNode(true);
    credit.removeAttribute("id");
    a.appendChild(credit);
    a.appendChild(el("p", "credit", W().t("dlLicence")));
    doPrint();
  }

  // ---------- EPUB ----------

  function toEpub(doc) {
    const lang = doc.lang;
    const files = [];
    const xhtml = (title, body) => '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="' + lang + '" lang="' + lang + '">\n' +
      "<head><meta charset=\"UTF-8\"/><title>" + esc(title) + '</title><link rel="stylesheet" href="style.css"/></head>\n<body>\n' + body + "</body>\n</html>\n";
    files.push(["mimetype", "application/epub+zip"]);
    files.push(["META-INF/container.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n']);
    files.push(["OEBPS/style.css", "body{font-family:serif;line-height:1.5}h1,h2{text-align:center}p{margin:0 0 .8em}p.l{margin:0;padding-left:3em;text-indent:-3em}.n{display:inline-block;width:3em;text-indent:0;font-size:.7em;color:#888}.ref{font-size:.7em;color:#888}p.pgb{margin:.4em 0 .2em;text-align:right;font-size:.7em;color:#888}.credits{margin-top:3em;font-size:.8em}.orig-title,.ed,.by{text-align:center}\n"]);
    files.push(["OEBPS/title.xhtml", xhtml(doc.workTitle, titleHtml(doc))]);
    doc.books.forEach((b, i) => files.push(["OEBPS/book" + (i + 1) + ".xhtml", xhtml(b.label, bookHtml(b, doc))]));
    const nav = '<nav epub:type="toc"><h1>' + esc(doc.workTitle) + "</h1><ol>" +
      doc.books.map((b, i) => '<li><a href="book' + (i + 1) + '.xhtml">' + esc(b.label) + "</a></li>").join("") + "</ol></nav>\n";
    files.push(["OEBPS/nav.xhtml", xhtml(doc.workTitle, nav)]);
    const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    const items = doc.books.map((b, i) => '<item id="b' + (i + 1) + '" href="book' + (i + 1) + '.xhtml" media-type="application/xhtml+xml"/>').join("");
    const spine = doc.books.map((b, i) => '<itemref idref="b' + (i + 1) + '"/>').join("");
    files.push(["OEBPS/content.opf", '<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="' + lang + '">\n' +
      '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      '<dc:identifier id="uid">' + esc(doc.id + ":" + doc.file) + "</dc:identifier>" +
      "<dc:title>" + esc(doc.workTitle + " — " + doc.title) + "</dc:title>" +
      "<dc:language>" + esc(lang) + "</dc:language>" +
      (doc.creators ? "<dc:contributor>" + esc(doc.creators) + "</dc:contributor>" : "") +
      "<dc:source>" + esc(doc.sourceUrl) + "</dc:source>" +
      "<dc:rights>" + esc(doc.credit + " " + doc.licence) + "</dc:rights>" +
      '<meta property="dcterms:modified">' + modified + "</meta></metadata>\n" +
      '<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' +
      '<item id="css" href="style.css" media-type="text/css"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>' + items + "</manifest>\n" +
      '<spine><itemref idref="title"/>' + spine + "</spine>\n</package>\n"]);
    return zip(files);
  }

  // A minimal ZIP writer (files stored uncompressed, as EPUB allows).
  const CRC = (() => {
    const tbl = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tbl[n] = c >>> 0;
    }
    return (bytes) => {
      let c = 0xffffffff;
      for (let i = 0; i < bytes.length; i++) c = tbl[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
  })();

  function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    for (const [name, content] of files) {
      const nameB = enc.encode(name), data = enc.encode(content), crc = CRC(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true); local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
      local.setUint16(26, nameB.length, true);
      parts.push(local, nameB, data);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true);
      cen.setUint16(28, nameB.length, true); cen.setUint32(42, offset, true);
      central.push(cen, nameB);
      offset += 30 + nameB.length + data.length;
    }
    const size = central.reduce((s, x) => s + x.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end]);
  }

  function save(content, type, name) {
    const blob = content instanceof Blob ? new Blob([content], { type }) : new Blob([content], { type });
    const a = el("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#download-btn")) open();
  });

  return { open, _toTxt: toTxt, _collect: collect };
})();
window.Download = Download;
