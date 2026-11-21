"""Discover a work's editions and translations on Wikidata.

Usage:
  python3 -I tools/discover.py iliad            # write the report only
  python3 -I tools/discover.py iliad --apply    # also add new translations to work.json

The work's record needs its Wikidata id, e.g. "wikidata": "Q8275".

For every item Wikidata records as an "edition or translation of" the work
(P629) it collects: language, translators (P655) and editors (P98) with their
death dates, publication date, title, and where a digital text already
exists: Wikisource pages, Project Gutenberg (P2034) and Internet Archive
(P724) ids. It then compares them with the work's record and writes
data/discovery/<work>.md (for people) and .json (for tools).

--apply adds translations that are not in the record yet, marked
"needsReview": true, and fills in Wikidata ids and digital sources for
translations it can match. Editions in the original language are only
reported: placing them in the stemma needs a scholar.
"""
import json
import os
import urllib.parse
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wikidata import sparql, qid  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ITEMS = """
SELECT ?e ?eLabel ?title ?langCode ?pub ?person ?personLabel ?role ?died ?gut ?ia ?ws WHERE {
  ?e wdt:P629 wd:%(q)s .
  OPTIONAL { ?e wdt:P1476 ?title }
  OPTIONAL { ?e wdt:P407 ?lang .
             OPTIONAL { ?lang wdt:P218 ?c1 } OPTIONAL { ?lang wdt:P220 ?c3 }
             BIND(COALESCE(?c1, ?c3) AS ?langCode) }
  OPTIONAL { ?e wdt:P577 ?pub }
  OPTIONAL { { ?e wdt:P655 ?person . BIND("translator" AS ?role) }
             UNION { ?e wdt:P98 ?person . BIND("editor" AS ?role) }
             OPTIONAL { ?person wdt:P570 ?died } }
  OPTIONAL { ?e wdt:P2034 ?gut }
  OPTIONAL { ?e wdt:P724 ?ia }
  OPTIONAL { ?ws schema:about ?e ; schema:isPartOf ?site .
             FILTER(CONTAINS(STR(?site), "wikisource")) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,fr,de,it,es,ru". }
}
"""

def year(s):
    m = re.match(r"-?\d+", s or "")
    return int(m.group()) if m else None


def load_work(work_id):
    path = os.path.join(ROOT, "data", "works", work_id, "work.json")
    with open(path, encoding="utf-8") as f:
        return path, json.load(f)


def site_languages():
    """Language codes the site knows (from js/languages.js), lower-case → code."""
    with open(os.path.join(ROOT, "js", "languages.js"), encoding="utf-8") as f:
        codes = re.findall(r'\{ c: "([^"]+)"', f.read())
    return {c.lower(): c for c in codes}


def collect(q):
    items = defaultdict(lambda: {"langs": set(), "people": {}, "pub": None, "titles": set(),
                                 "wikisource": set(), "gutenberg": set(), "ia": set(), "label": ""})
    for r in sparql(ITEMS % {"q": q}):
        it = items[qid(r["e"])]
        it["label"] = r.get("eLabel", "")
        if r.get("title"):
            it["titles"].add(r["title"])
        if r.get("langCode"):
            it["langs"].add(r["langCode"])
        y = year(r.get("pub"))
        if y and (it["pub"] is None or y < it["pub"]):
            it["pub"] = y
        if r.get("person"):
            pq = qid(r["person"])
            name = r.get("personLabel", pq)
            if "/.well-known/genid/" in r["person"]:  # Wikidata's "unknown value"
                name = "unknown"
            it["people"][pq] = {"name": name, "role": r["role"], "died": year(r.get("died"))}
        if r.get("gut"):
            it["gutenberg"].add(r["gut"])
        if r.get("ia"):
            it["ia"].add(r["ia"])
        if r.get("ws"):
            it["wikisource"].add(r["ws"])
    return items


# Wikidata language codes that Mouseion files under another code.
LANG_ALIASES = {"nb": "no", "nn": "no", "zh": "zh-Hans"}


def norm_lang(code):
    return LANG_ALIASES.get(code, code).split("-")[0]


def surname(name):
    return re.split(r"\s+", name.strip())[-1].lower() if name else ""


def norm_url(u):
    return urllib.parse.unquote(u or "").replace(" ", "_").rstrip("/")


def match(entry, items, used):
    """Find the Wikidata item for an existing translation: by id; by the
    Wikisource page its text came from; else by language + a shared
    translator surname + publication year within 15 (Wikidata often dates a
    different printing)."""
    if entry.get("wikidata") in items:
        return entry["wikidata"]
    src = norm_url((entry.get("text") or {}).get("sourceUrl"))
    for q, it in items.items():
        if q not in used and src and any(norm_url(w) == src for w in it["wikisource"]):
            return q
    names = {surname(c["name"]) for c in entry.get("creators", [])}
    best = None
    for q, it in items.items():
        if q in used:
            continue
        lang_ok = any(norm_lang(l) == entry["lang"].split("-")[0] for l in it["langs"])
        people = {surname(p["name"]) for p in it["people"].values()}
        gap = abs(it["pub"] - entry["year"]) if it["pub"] and entry.get("year") else 0
        if lang_ok and names & people and gap <= 15 and (best is None or gap < best[0]):
            best = (gap, q)
    return best[1] if best else None


def pd_summary(it):
    died = [p["died"] for p in it["people"].values() if p["role"] == "translator"]
    if not died:
        return "translator unknown"
    if any(d is None for d in died):
        return "translator's death date unknown (perhaps living)"
    last = max(died)
    s = f"translator died {last}: public domain under life+70 from {last + 71}"
    if it["pub"] and it["pub"] < 1978:
        s += f"; US from {it['pub'] + 96}"
    return s


def main(work_id, apply=False):
    path, work = load_work(work_id)
    q = work.get("wikidata")
    if not q:
        sys.exit(f"{work_id}: add \"wikidata\": \"Q…\" to its work.json first")
    langs = site_languages()
    orig = work["originalLanguage"]

    items = collect(q)
    titles = {}
    rows = sparql("SELECT ?l ?label WHERE { wd:%s rdfs:label ?label . BIND(LANG(?label) AS ?l) }" % q)
    for r in rows:
        code = langs.get(r["l"].lower())
        if code:
            titles[code] = r["label"]

    used, matched = set(), {}
    for t in work["translations"]:
        m = match(t, items, used)
        if m:
            used.add(m)
            matched[t["id"]] = m

    originals = {k: v for k, v in items.items() if orig in v["langs"]}
    translations = {k: v for k, v in items.items() if k not in originals and v["langs"]}
    new = {k: v for k, v in translations.items() if k not in used}
    unknown_lang = {k: v for k, v in items.items() if not v["langs"]}

    def sources(it):
        out = {}
        if it["wikisource"]:
            out["wikisource"] = sorted(it["wikisource"])
        if it["gutenberg"]:
            out["gutenberg"] = sorted(it["gutenberg"])
        if it["ia"]:
            out["internetArchive"] = sorted(it["ia"])
        return out

    # ---- report
    lines = [f"# Discovery report: {work_id} ({q})", "",
             "Generated from Wikidata (CC0) by `tools/discover.py`. Facts on Wikidata can be wrong",
             "or incomplete: check before relying on them.", "",
             f"- {len(items)} editions/translations on Wikidata; {len(originals)} in the original language,",
             f"  {len(translations)} translations, {len(unknown_lang)} without a language.",
             f"- {len(matched)} of the record's {len(work['translations'])} translations matched; "
             f"{len(new)} translations are not in the record yet.", ""]
    missing_titles = sorted(set(titles) - set(work["titles"]))
    if missing_titles:
        lines += [f"Titles in {len(missing_titles)} more site languages: "
                  + ", ".join(f"{c} “{titles[c]}”" for c in missing_titles), ""]

    def row(k, it):
        people = "; ".join(f"{p['name']} ({p['role']}, †{p['died'] or '?'})" for p in it["people"].values()) or "—"
        src = sources(it)
        src_s = ", ".join(f"{name}: {len(v)}" for name, v in src.items()) or "no digital text linked"
        title = next(iter(it["titles"]), it["label"])
        return f"| {k} | {'/'.join(sorted(it['langs'])) or '?'} | {it['pub'] or '?'} | {title} | {people} | {src_s} |"

    head = ["| Wikidata | Lang | Year | Title | People | Digital text |", "| --- | --- | --- | --- | --- | --- |"]
    lines += ["## Translations already in Mouseion", ""] + head
    for tid, k in matched.items():
        lines.append(row(k, items[k]).replace(f"| {k} |", f"| {k} ({tid}) |", 1))
    lines += ["", "## Translations not in Mouseion yet", ""] + head
    for k, it in sorted(new.items(), key=lambda kv: (sorted(kv[1]["langs"]), kv[1]["pub"] or 9999)):
        lines.append(row(k, it))
    lines += ["", f"## Editions in the original language ({orig})", "",
              "Listed for the scholar who maintains the stemma; not added automatically.", ""] + head
    for k, it in sorted(originals.items(), key=lambda kv: kv[1]["pub"] or 9999):
        lines.append(row(k, it))
    if unknown_lang:
        lines += ["", "## Items without a language on Wikidata", ""] + head
        for k, it in unknown_lang.items():
            lines.append(row(k, it))

    out_dir = os.path.join(ROOT, "data", "discovery")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, f"{work_id}.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    dump = {k: {**{kk: sorted(vv) if isinstance(vv, set) else vv for kk, vv in it.items()},
                "rights": pd_summary(it)} for k, it in items.items()}
    with open(os.path.join(out_dir, f"{work_id}.json"), "w", encoding="utf-8") as f:
        json.dump({"work": work_id, "wikidata": q, "matched": matched, "items": dump},
                  f, ensure_ascii=False, indent=1)
    print("\n".join(lines[:9]))

    # ---- apply
    if apply:
        added = 0
        for t in work["translations"]:
            k = matched.get(t["id"])
            if k:
                t["wikidata"] = k
                src = sources(items[k])
                if src:
                    t["sources"] = src
        for k, it in new.items():
            translators = [p for p in it["people"].values() if p["role"] == "translator" and p["name"] != "unknown"]
            code = sorted(it["langs"])[0]
            lang = langs.get(LANG_ALIASES.get(code, code).lower())
            if not translators or not lang:
                continue  # without a translator or a site language it can't be judged
            work["translations"].append({
                "id": "wd-" + k.lower(), "wikidata": k, "lang": lang,
                "title": next(iter(it["titles"]), it["label"]),
                "date": str(it["pub"]) if it["pub"] else "?", "year": it["pub"],
                "creators": [{"name": p["name"], "died": p["died"]} for p in translators],
                **({"sources": sources(it)} if sources(it) else {}),
                "needsReview": True,
            })
            added += 1
        for code, label in titles.items():
            work["titles"].setdefault(code, label)
        with open(path, "w", encoding="utf-8") as f:
            f.write(json.dumps(work, ensure_ascii=False, indent=2) + "\n")
        print(f"\napplied: {added} translations added (needsReview), {len(matched)} matched, "
              f"{len(missing_titles)} titles added")


if __name__ == "__main__":
    main(sys.argv[1], apply="--apply" in sys.argv)
