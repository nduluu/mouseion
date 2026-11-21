"""Polite Wikisource fetcher with an on-disk cache.

One request at a time, a pause between requests, and backing off when
Wikimedia answers 429 (too many requests). Every response is cached, so
re-running never fetches a page twice.

Usage (from Python):
    from wikisource import parse
    html, links = parse("it.wikisource.org", "Iliade (Monti)/Libro I")

Command line, to list a page's links:
    python3 -I tools/wikisource.py it.wikisource.org "Iliade (Monti)"
"""
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "MouseionImporter/0.1 (personal non-commercial digital library project; one request at a time)"
CACHE = os.environ.get("WS_CACHE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "wikisource"))
PAUSE = float(os.environ.get("WS_PAUSE", "3"))
_last = [0.0]


def _get(url):
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".json")
    if os.path.exists(key):
        with open(key, encoding="utf-8") as f:
            return json.load(f)
    delay = 30
    for attempt in range(8):
        wait = PAUSE - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
            with open(key, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                retry = e.headers.get("Retry-After")
                sleep_for = int(retry) if retry and retry.isdigit() else delay
                print(f"  HTTP {e.code}, waiting {sleep_for}s", file=sys.stderr, flush=True)
                time.sleep(sleep_for)
                delay = min(delay * 2, 600)
                continue
            raise
    raise RuntimeError("gave up on " + url)


def parse(host, title, live_only=False):
    """Rendered HTML of a page and its list of links to other pages (main namespace).

    Reads the local bulk dump first (tools/wikisource_dump.py), and only asks
    the live site for pages the dump doesn't have."""
    if not live_only and host.endswith(".wikisource.org"):
        import wikisource_dump
        html = wikisource_dump.page(host.split(".")[0], title)
        if html is not None:
            return html, wikisource_dump.links(html)
    q = urllib.parse.urlencode({
        "action": "parse", "page": title, "prop": "text|links",
        "redirects": 1, "format": "json", "formatversion": 2,
    })
    data = _get(f"https://{host}/w/api.php?{q}")
    if "error" in data:
        raise RuntimeError(f"{host} {title}: {data['error'].get('info')}")
    p = data["parse"]
    return p["text"], [l["title"] for l in p.get("links", []) if l.get("ns") == 0]


if __name__ == "__main__":
    html, links = parse(sys.argv[1], sys.argv[2])
    print(len(html), "chars of HTML")
    for l in links:
        print(" ", l)
