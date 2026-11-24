"""Build the catalogue (data/catalog/ and data/search/: what search and the
category pages use) from
data/works/*/work.json, data/authors/*.json and data/taxonomy.json.

Run after adding or changing a work or author:  python3 -I tools/build_catalog.py
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


taxonomy = load(os.path.join(ROOT, "data", "taxonomy.json"))
terms = {cat: {t["id"] for t in items} for cat, items in taxonomy.items()}
problems = []

works = []
for path in sorted(glob.glob(os.path.join(ROOT, "data", "works", "*", "work.json"))):
    w = load(path)
    c = w.get("classification", {})
    readable = sorted({t["lang"] for t in w["translations"] if t.get("text")})
    for cat, key in (("era", "era"), ("genre", "genres"), ("field", "fields"), ("religion", "religions")):
        vals = c.get(key) or []
        for v in [vals] if isinstance(vals, str) else vals:
            if v not in terms.get(cat, ()):
                problems.append(f"{w['id']}: unknown {cat} '{v}'")
    works.append({
        "id": w["id"],
        "originalLanguage": w["originalLanguage"],
        "titles": w["titles"],
        "author": w["author"],
        "authors": c.get("authors", []),
        "era": c.get("era"),
        "genres": c.get("genres", []),
        "fields": c.get("fields", []),
        "religions": c.get("religions", []),
        "editions": sum(1 for n in w["nodes"] if n["kind"] == "edition"),
        "translations": len(w["translations"]),
        "translationLanguages": sorted({t["lang"] for t in w["translations"]}),
        "readableLanguages": readable,
    })

work_ids = {w["id"] for w in works}
authors = []
for path in sorted(glob.glob(os.path.join(ROOT, "data", "authors", "*.json"))):
    a = load(path)
    for entry in a["works"]:
        if "work" in entry and entry["work"] not in work_ids:
            problems.append(f"author {a['id']}: work '{entry['work']}' has no record")
    authors.append({
        "id": a["id"],
        "names": a["names"],
        "originalName": a.get("originalName"),
        "dates": a.get("dates"),
        "era": a.get("era"),
        "works": [e["work"] for e in a["works"] if "work" in e],
        "otherWorks": len([e for e in a["works"] if "work" not in e]),
    })

for w in works:
    for a in w["authors"]:
        if a not in {x["id"] for x in authors}:
            problems.append(f"{w['id']}: unknown author '{a}'")

if problems:
    print("\n".join(problems))
    sys.exit(1)

# ---------- output: many small files instead of one large one ----------
# A visitor's browser only fetches what a page needs, so the catalogue can
# grow to millions of works:
#   data/catalog/index.json                 categories, counts, letters (small)
#   data/catalog/works/<id>.json            one work's card
#   data/catalog/authors/<id>.json          one author's card
#   data/catalog/terms/<cat>/<term>.json    the works (and authors) filed under a term
#   data/catalog/terms/language/<code>.json works written in / readable in / listed in a language
#   data/catalog/authors-az/<letter>.json   the author cards for one letter
#   data/search/<key>.json                  search words starting with two letters (see js/common.js)
import re
import shutil
import unicodedata

OUT = os.path.join(ROOT, "data", "catalog")
SEARCH = os.path.join(ROOT, "data", "search")
for d in (OUT, SEARCH):
    shutil.rmtree(d, ignore_errors=True)
    os.makedirs(d)
old = os.path.join(ROOT, "data", "catalog.json")
if os.path.exists(old):
    os.remove(old)


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


WORK_KEY = {"era": "era", "genre": "genres", "field": "fields", "religion": "religions"}


def terms_of(w, cat):
    v = w.get(WORK_KEY[cat])
    return [v] if isinstance(v, str) else (v or [])


for w in works:
    write(os.path.join(OUT, "works", w["id"] + ".json"), w)
for a in authors:
    write(os.path.join(OUT, "authors", a["id"] + ".json"), a)

counts = {}
for cat in WORK_KEY:
    counts[cat] = {}
    for t in taxonomy.get(cat, []):
        ws = [w["id"] for w in works if t["id"] in terms_of(w, cat)]
        aids = sorted({x for w in works if t["id"] in terms_of(w, cat) for x in w["authors"]}
                      | ({a["id"] for a in authors if a.get("era") == t["id"]} if cat == "era" else set()))
        counts[cat][t["id"]] = len(ws)
        write(os.path.join(OUT, "terms", cat, t["id"] + ".json"), {"works": ws, "authors": aids})

languages = {}
codes = {w["originalLanguage"] for w in works} | {c for w in works for c in w["translationLanguages"]}
for code in sorted(codes):
    entry = {
        "written": [w["id"] for w in works if w["originalLanguage"] == code],
        "readable": [w["id"] for w in works if code in w["readableLanguages"]],
        "listed": [w["id"] for w in works if code in w["translationLanguages"] and code not in w["readableLanguages"]],
    }
    write(os.path.join(OUT, "terms", "language", code + ".json"), entry)
    languages[code] = {k: len(v) for k, v in entry.items()}


def fold(s):
    """Same as norm() in js/common.js: no accents or breathings, lower case,
    final sigma as sigma."""
    s = "".join(ch for ch in unicodedata.normalize("NFD", s) if not unicodedata.category(ch).startswith("M"))
    return s.lower().replace("ς", "σ")


def letter(a):
    name = fold(a["names"].get("en") or next(iter(a["names"].values()), ""))
    return name[:1].upper() if name[:1].isascii() and name[:1].isalpha() else "#"


az = {}
for a in authors:
    az.setdefault(letter(a), []).append(a)
for l, group in az.items():
    group.sort(key=lambda a: fold(a["names"].get("en") or ""))
    write(os.path.join(OUT, "authors-az", ("_" if l == "#" else l) + ".json"), group)

write(os.path.join(OUT, "index.json"), {
    "works": len(works), "authors": len(authors), "taxonomy": taxonomy, "counts": counts,
    "languages": languages, "letters": {l: len(g) for l, g in sorted(az.items())},
})

# Search: every word of every title and name, in all languages, filed by its
# first two letters. Scripts written without spaces (Chinese, Japanese, Thai…)
# also file every tail of a word, so a search can start inside it.
NO_SPACES = re.compile("[\u0e00-\u0eff\u0f00-\u0fff\u1000-\u109f\u1780-\u17ff\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]")


def words(text):
    out = set()
    for w in re.split(r"[\W_]+", fold(text)):
        if not w:
            continue
        out.add(w)
        if NO_SPACES.search(w):
            out.update(w[i:] for i in range(1, len(w)))
    return out


def shard(word):
    return "-".join(format(ord(c), "x") for c in word[:2])


index = {}
for w in works:
    for text in list(w["titles"].values()) + list(w["author"].values()):
        for word in words(text):
            index.setdefault(word, set()).add("w:" + w["id"])
for a in authors:
    for text in a["names"].values():
        for word in words(text):
            index.setdefault(word, set()).add("a:" + a["id"])
shards = {}
for word, refs in index.items():
    if len(word) < 2:
        continue
    shards.setdefault(shard(word), {})[word] = sorted(refs)
for key, data in shards.items():
    write(os.path.join(SEARCH, key + ".json"), data)

print(f"{len(works)} works, {len(authors)} authors -> data/catalog/ ({len(az)} letters), "
      f"data/search/ ({len(shards)} files, {len(index)} words)")
