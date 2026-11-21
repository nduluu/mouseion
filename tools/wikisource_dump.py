"""Bulk access to a whole Wikisource language, from Wikimedia's rendered HTML dumps.

Download a language once, then every importer reads pages from a local
database instead of asking Wikisource page by page (no rate limits).

Usage:
  python3 -I tools/wikisource_dump.py fetch es       # download + build the local database
  python3 -I tools/wikisource_dump.py runs           # list available dump dates
  python3 -I tools/wikisource_dump.py info es        # pages in the local database
  python3 -I tools/wikisource_dump.py get es "La Ilíada (Luis Segalá y Estalella)/Canto I"

Files go to .cache/dumps/ (not in git). The dumps are "Wikimedia Enterprise
HTML" snapshots of the main namespace (fully rendered pages, so text pulled in
from scanned-page subpages is already assembled). They are periodic: pages
created after the snapshot are fetched live by tools/wikisource.py instead.
Wikisource text is CC BY-SA 4.0.
"""
import io
import json
import os
import re
import sqlite3
import subprocess
import sys
import tarfile
import urllib.request
import zlib

UA = "MouseionImporter/0.1 (personal non-commercial digital library project)"
BASE = "https://dumps.wikimedia.org/other/enterprise_html/runs/"
DIR = os.environ.get("WS_DUMPS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "dumps"))


def _open(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120)


def runs():
    with _open(BASE) as r:
        return sorted(re.findall(r'href="(\d{8})/"', r.read().decode()))


def latest_run_with(lang):
    name = f"{lang}wikisource-NS0-"
    for run in reversed(runs()):
        with _open(BASE + run + "/") as r:
            if name in r.read().decode():
                return run
    raise SystemExit(f"no HTML dump found for {lang}wikisource")


def db_path(lang):
    return os.path.join(DIR, f"{lang}wikisource.sqlite")


def norm_title(t):
    return t.replace("_", " ").strip()


def fetch(lang):
    os.makedirs(DIR, exist_ok=True)
    run = latest_run_with(lang)
    fname = f"{lang}wikisource-NS0-{run}-ENTERPRISE-HTML.json.tar.gz"
    path = os.path.join(DIR, fname)
    print(f"{lang}: dump of {run}", flush=True)
    # curl resumes an interrupted download (-C -) and shows nothing but errors.
    subprocess.run(["curl", "-sS", "-L", "-C", "-", "-A", UA, "-o", path, BASE + f"{run}/{fname}"], check=True)
    print(f"{lang}: downloaded {os.path.getsize(path) / 1e6:.0f} MB; building database", flush=True)

    tmp = db_path(lang) + ".tmp"
    if os.path.exists(tmp):
        os.remove(tmp)
    con = sqlite3.connect(tmp)
    con.execute("CREATE TABLE pages (title TEXT PRIMARY KEY, html BLOB, redirect TEXT)")
    con.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)")
    n = 0
    with tarfile.open(path, "r:gz") as tar:
        for member in tar:
            if not member.isfile():
                continue
            f = tar.extractfile(member)
            for line in io.TextIOWrapper(f, encoding="utf-8"):
                doc = json.loads(line)
                title = norm_title(doc.get("name", ""))
                html = (doc.get("article_body") or {}).get("html") or ""
                con.execute("INSERT OR REPLACE INTO pages VALUES (?, ?, NULL)",
                            (title, zlib.compress(html.encode("utf-8"))))
                for r in doc.get("redirects") or []:
                    name = norm_title(r.get("name", ""))
                    if name and name != title:
                        con.execute("INSERT OR IGNORE INTO pages VALUES (?, NULL, ?)", (name, title))
                n += 1
                if n % 20000 == 0:
                    con.commit()
                    print(f"  {n} pages", flush=True)
    con.execute("INSERT INTO meta VALUES ('run', ?)", (run,))
    con.commit()
    con.close()
    os.replace(tmp, db_path(lang))
    print(f"{lang}: {n} pages in {db_path(lang)}", flush=True)
    os.remove(path)  # the database holds everything we need


_cons = {}


def page(lang, title):
    """Rendered HTML of a page from the local dump, or None if not there."""
    p = db_path(lang)
    if not os.path.exists(p):
        return None
    con = _cons.get(lang) or _cons.setdefault(lang, sqlite3.connect(p))
    title = norm_title(title)
    for _ in range(5):  # follow redirects
        row = con.execute("SELECT html, redirect FROM pages WHERE title = ?", (title,)).fetchone()
        if not row:
            return None
        html, redirect = row
        if redirect:
            title = redirect
            continue
        return zlib.decompress(html).decode("utf-8")
    return None


def links(html):
    """Titles of main-namespace pages linked from a page (Parsoid or classic HTML)."""
    out = []
    hrefs = re.findall(r'<a[^>]+href="(?:\./|/wiki/)([^"#?]+)"', html)
    for href in hrefs:
        t = norm_title(urllib.request.unquote(href))
        if ":" not in t.split("/")[0] and t not in out:
            out.append(t)
    return out


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "runs":
        print("\n".join(runs()))
    elif cmd == "fetch":
        for lang in sys.argv[2:]:
            fetch(lang)
    elif cmd == "info":
        con = sqlite3.connect(db_path(sys.argv[2]))
        print(con.execute("SELECT value FROM meta WHERE key='run'").fetchone()[0],
              con.execute("SELECT COUNT(*) FROM pages").fetchone()[0], "pages")
    elif cmd == "get":
        h = page(sys.argv[2], sys.argv[3])
        print(h if h is not None else "not in the dump")
