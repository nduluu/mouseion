// Addresses.
//
// On the real site every page has a plain, permanent address:
//   /                         home
//   /search?q=homer           search
//   /authors, /author/homer   authors
//   /browse/era/archaic-greece
//   /iliad                    a work
//   /iliad/ita-monti          a work with one text open
//   /iliad/ita-monti/1        … at book 1
//   /iliad/ita-monti/1/7-10   … at lines 7 to 10
//   /iliad/fra-leconte/1/p5   … at printed page 5 (II-p12: vol. II, p. 12)
// A text is named by its folder (data/works/<work>/texts/<folder>), which is
// unique and readable: grc-monro-allen, ita-monti, deu-voss …
//
// The server must answer every such address with index.html (see
// dev_server.py). Where it can't, as in an embedded preview, the same routes
// live after "#" (…/index.html#/iliad/ita-monti/1/7). Old "#/work/…" links
// keep working in both.
const Router = (() => {
  const cfg = window.MOUSEION_ROUTING || { mode: "hash", root: "/" };
  const pathMode = cfg.mode === "path";
  const root = cfg.root.endsWith("/") ? cfg.root : cfg.root + "/";
  let listener = null;

  // Any form of a route → its canonical form: "#/work/iliad?x" → "/iliad?x",
  // "#/home" → "/".
  function normalize(r) {
    r = String(r || "").replace(/^#/, "");
    if (!r.startsWith("/")) r = "/" + r;
    if (r === "/home" || r.startsWith("/home?")) r = "/" + r.slice(5);
    return r.replace(/^\/work\/(?=[^/?])/, "/");
  }

  // The href for a route, as this site is served.
  function href(r) {
    r = normalize(r);
    return pathMode ? root + r.slice(1) : "#" + r;
  }

  // A full address to share or cite.
  function absolute(r) {
    return pathMode ? location.origin + href(r) : location.href.split("#")[0] + href(r);
  }

  // The route shown now.
  function current() {
    if (!pathMode) return normalize(location.hash || "#/");
    let p = location.pathname;
    p = p.startsWith(root) ? "/" + p.slice(root.length) : p;
    if (p === "/index.html") p = "/";
    return normalize(p + location.search);
  }

  function notify() {
    if (listener) listener(current());
  }

  // Go to a route; with replace, only correct the address bar (no new
  // history entry, nothing re-rendered).
  function go(r, replace) {
    const h = href(r);
    if (replace) {
      const now = pathMode ? location.pathname + location.search : location.hash;
      if (h !== now) history.replaceState(history.state, "", h);
      return;
    }
    if (pathMode) {
      if (normalize(r) !== current()) history.pushState(null, "", h);
      notify();
    } else if (location.hash === h) {
      notify();
    } else {
      location.hash = h; // hashchange notifies
    }
  }

  function onChange(fn) {
    listener = fn;
  }

  if (pathMode) {
    // An old "#/…" link opened on the real site: move it to the plain address.
    if (location.hash.startsWith("#/")) history.replaceState(null, "", href(location.hash));
    window.addEventListener("popstate", notify);

    // Links written as "#/…" in the page and in scripts get plain addresses.
    const fix = (a) => {
      const h = a.getAttribute("href");
      if (h && h.startsWith("#/")) a.setAttribute("href", href(h));
    };
    const fixAll = (node) => {
      if (node.nodeType !== 1) return;
      if (node.tagName === "A") fix(node);
      node.querySelectorAll && node.querySelectorAll('a[href^="#/"]').forEach(fix);
    };
    fixAll(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "attributes") fix(m.target);
        else m.addedNodes.forEach(fixAll);
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });

    // Following a link inside the site doesn't reload the page.
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(root)) return;
      if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return; // a file, not a page
      e.preventDefault();
      go("/" + url.pathname.slice(root.length) + url.search);
    });
  } else {
    window.addEventListener("hashchange", notify);
  }

  return { mode: cfg.mode, href, absolute, current, go, onChange, normalize };
})();
window.Router = Router;
