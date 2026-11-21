"""Build data/catalog.json (what search and the category pages use) from
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

out = os.path.join(ROOT, "data", "catalog.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump({"works": works, "authors": authors, "taxonomy": taxonomy}, f, ensure_ascii=False, indent=1)
print(f"{len(works)} works, {len(authors)} authors -> {os.path.relpath(out, ROOT)}")
