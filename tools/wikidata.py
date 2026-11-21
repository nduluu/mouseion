"""Polite Wikidata SPARQL client with an on-disk cache.

One query at a time, honours Retry-After on 429, caches every answer
(delete .cache/wikidata to refresh). Wikidata's data is CC0.

    from wikidata import sparql
    rows = sparql("SELECT ?x WHERE { ... }")   # list of {var: value} dicts
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
ENDPOINT = "https://query.wikidata.org/sparql"
CACHE = os.environ.get("WD_CACHE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "wikidata"))
_last = [0.0]


def sparql(query, pause=2.0):
    os.makedirs(CACHE, exist_ok=True)
    key = os.path.join(CACHE, hashlib.sha1(query.encode()).hexdigest() + ".json")
    if os.path.exists(key):
        with open(key, encoding="utf-8") as f:
            return json.load(f)
    body = urllib.parse.urlencode({"query": query}).encode()
    delay = 20
    for _ in range(8):
        wait = pause - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        req = urllib.request.Request(ENDPOINT, data=body, headers={
            "User-Agent": UA, "Accept": "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read().decode("utf-8"))
            rows = [{k: v["value"] for k, v in b.items()} for b in data["results"]["bindings"]]
            with open(key, "w", encoding="utf-8") as f:
                json.dump(rows, f, ensure_ascii=False)
            return rows
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                retry = e.headers.get("Retry-After")
                s = int(retry) if retry and retry.isdigit() else delay
                print(f"  Wikidata HTTP {e.code}, waiting {s}s", file=sys.stderr, flush=True)
                time.sleep(s)
                delay = min(delay * 2, 600)
                continue
            raise
    raise RuntimeError("Wikidata: gave up")


def qid(uri):
    return uri.rsplit("/", 1)[-1]
