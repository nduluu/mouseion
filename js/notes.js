// Notes: select words in the reader and a small bar appears above them with
// "Make a note" and "Cite". A note keeps the quoted words, where they are
// (a label and the passage's route, e.g. /iliad/ita-monti/1/7-10), and what
// the reader wrote. Notes belong to
// the signed-in account and are listed on the "My notes" page (#/notes),
// where they can be read, edited and deleted.
//
// Accounts live in this browser for now (localStorage), so notes do too:
// they are kept per account e-mail until there is a server.
const Notes = (() => {
  const KEY = "mouseion.notes";
  const USER_KEY = "mouseion.user";
  const MAX_QUOTE = 2000;
  const RTL = new Set(["ar", "arc", "dv", "fa", "he", "ps", "sd", "syr", "ug", "ur", "yi", "ckb"]);

  const t = (k, v) => M.t(k, v);
  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch (e) { return null; }
  }

  function dirOf(code) {
    const base = String(code || "").split("-")[0];
    const known = typeof LANGUAGES !== "undefined" && LANGUAGES.find((l) => l.c === base);
    return (known ? known.rtl : RTL.has(base)) ? "rtl" : "ltr";
  }

  // ---------- storage ----------

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; }
  }

  function list() {
    const u = user();
    if (!u) return [];
    const mine = readAll()[u.email.toLowerCase()];
    return Array.isArray(mine) ? mine : [];
  }

  function store(notes) {
    const u = user();
    if (!u) return false;
    const all = readAll();
    all[u.email.toLowerCase()] = notes;
    try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; }
  }

  function put(note) {
    const notes = list().filter((n) => n.id !== note.id);
    notes.push(note);
    return store(notes);
  }

  function remove(id) {
    return store(list().filter((n) => n.id !== id));
  }

  // ---------- the bar above a selection ----------

  let bar = null;
  let barRange = null;

  function selectionInReader() {
    const sel = window.getSelection();
    const reader = $("reader");
    if (!sel || !sel.rangeCount || sel.isCollapsed || !reader || $("work").hidden) return null;
    const r = sel.getRangeAt(0);
    if (!reader.contains(r.commonAncestorContainer)) return null;
    if (!String(sel).trim()) return null;
    return r;
  }

  function buildBar() {
    bar = el("div", "sel-bar");
    bar.setAttribute("role", "toolbar");
    const note = el("button", null, t("makeNote"));
    note.type = "button";
    note.dataset.act = "note";
    const cite = el("button", null, t("cite"));
    cite.type = "button";
    cite.dataset.act = "cite";
    bar.append(note, el("span", "sel-sep"), cite);
    bar.hidden = true;
    // Keep the selection: pressing a button must not clear it first.
    bar.addEventListener("mousedown", (e) => e.preventDefault());
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b || !barRange) return;
      const r = barRange.cloneRange();
      hideBar();
      if (b.dataset.act === "cite") { if (window.Cite) Cite.open(r); }
      else openNew(r);
    });
    document.body.appendChild(bar);
  }

  function hideBar() {
    if (bar) bar.hidden = true;
    barRange = null;
  }

  function showBar(r) {
    if (!bar) buildBar();
    bar.querySelector('[data-act="note"]').textContent = t("makeNote");
    bar.querySelector('[data-act="cite"]').textContent = t("cite");
    barRange = r.cloneRange();
    const rects = [...r.getClientRects()].filter((x) => x.width || x.height);
    if (!rects.length) return hideBar();
    bar.hidden = false;
    const w = bar.offsetWidth, h = bar.offsetHeight;
    // Touch screens draw their own menu above the words, so ours goes below.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const firstR = rects[0], lastR = rects[rects.length - 1];
    let anchor = touch ? lastR : firstR;
    let top = touch ? anchor.bottom + 12 : anchor.top - h - 10;
    if (!touch && top < 8) { anchor = lastR; top = anchor.bottom + 10; }
    if (touch && top + h > window.innerHeight - 8) { anchor = firstR; top = anchor.top - h - 12; }
    let left = anchor.left + anchor.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, document.documentElement.clientWidth - w - 8));
    bar.style.left = left + window.scrollX + "px";
    bar.style.top = top + window.scrollY + "px";
  }

  let pending = 0;
  function onSelection() {
    clearTimeout(pending);
    pending = setTimeout(() => {
      const r = selectionInReader();
      if (r) showBar(r);
      else hideBar();
    }, 180);
  }

  // ---------- the note window ----------

  let dialog = null;

  function quoteBlock(note) {
    const box = el("div", "note-quote");
    const q = el("blockquote", null, note.quote);
    q.lang = note.lang || "";
    q.dir = dirOf(note.lang);
    const a = el("a", "note-ref", note.label);
    a.dir = "auto";
    a.href = Router.href(note.route);
    a.addEventListener("click", () => dialog && dialog.close());
    box.append(q, a);
    return box;
  }

  function openDialog(build) {
    if (dialog) dialog.close();
    dialog = el("dialog", "dl-dialog note-dialog");
    const form = el("form");
    form.method = "dialog";
    build(form);
    dialog.appendChild(form);
    dialog.addEventListener("close", () => { if (dialog) dialog.remove(); dialog = null; });
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  async function openNew(r) {
    const quote = String(r).replace(/\s+/g, " ").trim().slice(0, MAX_QUOTE);
    const where = window.Cite ? await Cite.passage(r) : null;
    const note = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      quote,
      lang: where ? where.lang : "",
      label: where ? where.label : document.title.replace(/ — Mouseion$/, ""),
      route: where ? where.route : Router.current(),
      body: "",
      created: new Date().toISOString(),
    };
    window.getSelection().removeAllRanges();
    edit(note, true);
  }

  // The editor: the quoted words in grey with their link, then the note.
  function edit(note, isNew, onDone) {
    openDialog((form) => {
      form.appendChild(el("h3", "dl-title", t("makeNote")));
      form.appendChild(quoteBlock(note));
      if (!user()) {
        form.appendChild(el("p", "note-signin", t("noteSignIn")));
        const actions = el("div", "dl-actions");
        const close = el("button", "btn", t("close"));
        close.value = "cancel";
        const go = el("a", "btn btn-primary", t("signIn"));
        go.href = "#/account";
        go.addEventListener("click", () => dialog && dialog.close());
        actions.append(close, go);
        form.appendChild(actions);
        return;
      }
      const area = el("textarea", "note-text");
      area.id = "note-text";
      area.value = note.body || "";
      area.placeholder = t("notePlaceholder");
      area.setAttribute("aria-label", t("notePlaceholder"));
      area.rows = 6;
      area.dir = "auto";
      form.appendChild(area);
      const status = el("p", "dl-status");
      form.appendChild(status);
      const actions = el("div", "dl-actions");
      if (!isNew) {
        const del = el("button", "btn note-delete", t("noteDelete"));
        del.type = "button";
        del.addEventListener("click", () => {
          if (del.dataset.sure) {
            remove(note.id);
            dialog.close();
            if (onDone) onDone();
          } else {
            del.dataset.sure = "1";
            del.textContent = t("noteDeleteSure");
          }
        });
        actions.appendChild(del);
      }
      const cancel = el("button", "btn", t("cancel"));
      cancel.value = "cancel";
      const save = el("button", "btn btn-primary", t("noteSave"));
      save.type = "button";
      save.addEventListener("click", () => {
        const saved = Object.assign({}, note, { body: area.value, updated: new Date().toISOString() });
        if (!put(saved)) { status.textContent = t("copyFailed"); return; }
        dialog.close();
        if (onDone) onDone();
        else toast();
      });
      actions.append(cancel, save);
      form.appendChild(actions);
      setTimeout(() => area.focus(), 0);
    });
  }

  // "Saved." with a link to the notes, for a few seconds.
  function toast() {
    const box = el("div", "note-toast");
    box.setAttribute("role", "status");
    box.append(el("span", null, t("saved") + " "));
    const a = el("a", null, t("myNotes"));
    a.href = "#/notes";
    box.appendChild(a);
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  // ---------- the "My notes" page ----------

  function renderPage() {
    const box = $("notes-list");
    if (!box) return;
    box.textContent = "";
    if (!user()) {
      const p = el("p", "notes-empty", t("noteSignIn") + " ");
      const a = el("a", null, t("signIn"));
      a.href = "#/account";
      p.appendChild(a);
      box.appendChild(p);
      return;
    }
    const notes = list().slice().sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created));
    if (!notes.length) {
      box.appendChild(el("p", "notes-empty", t("noNotes")));
      return;
    }
    const fmt = new Intl.DateTimeFormat(M.lang(), { dateStyle: "medium" });
    for (const n of notes) {
      const card = el("article", "note-card");
      const q = el("blockquote", null, n.quote);
      q.lang = n.lang || "";
      q.dir = dirOf(n.lang);
      const ref = el("a", "note-ref", n.label);
      ref.dir = "auto";
      ref.href = Router.href(n.route);
      const quote = el("div", "note-quote");
      quote.append(q, ref);
      card.appendChild(quote);
      if (n.body.trim()) {
        const body = el("div", "note-body", n.body);
        body.dir = "auto";
        card.appendChild(body);
      }
      const foot = el("div", "note-foot");
      foot.appendChild(el("span", null, fmt.format(new Date(n.updated || n.created))));
      const e = el("button", "btn btn-small", t("noteEdit"));
      e.type = "button";
      e.addEventListener("click", () => edit(n, false, renderPage));
      foot.appendChild(e);
      card.appendChild(foot);
      box.appendChild(card);
    }
  }

  // ---------- events ----------

  document.addEventListener("selectionchange", onSelection);
  window.addEventListener("resize", () => { const r = selectionInReader(); if (r) showBar(r); else hideBar(); });
  window.addEventListener("hashchange", hideBar);
  // Paged view moves the text without a selection change.
  document.addEventListener("scroll", () => { if (bar && !bar.hidden) { const r = selectionInReader(); if (r) showBar(r); else hideBar(); } }, true);

  return { renderPage, list };
})();
window.Notes = Notes;
