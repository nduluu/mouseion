"""Build data/catalog.json (what the search box searches) from data/works/*/work.json.

Run after adding or changing a work:  python3 -I tools/build_catalog.py
"""
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

works = []
for path in sorted(glob.glob(os.path.join(ROOT, "data", "works", "*", "work.json"))):
    with open(path, encoding="utf-8") as f:
        w = json.load(f)
    works.append({
        "id": w["id"],
        "originalLanguage": w["originalLanguage"],
        "titles": w["titles"],
        "author": w["author"],
        "editions": sum(1 for n in w["nodes"] if n["kind"] == "edition"),
        "translations": len(w["translations"]),
        "languages": sorted({t["lang"] for t in w["translations"]}),
    })

out = os.path.join(ROOT, "data", "catalog.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(works, f, ensure_ascii=False, indent=1)
print(f"{len(works)} work(s) -> {os.path.relpath(out, ROOT)}")
