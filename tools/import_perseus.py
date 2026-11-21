"""Convert a Perseus (CTS/TEI) Homer text into Mouseion's per-book JSON files.

Usage:
  python3 -I tools/import_perseus.py verse  SOURCE.xml OUT_DIR   # Greek: numbered lines
  python3 -I tools/import_perseus.py prose  SOURCE.xml OUT_DIR   # translation: passages ("cards")

Verse output (one file per book, e.g. 01.json):
  {"book": 1, "lines": [[1, "μῆνιν ἄειδε θεὰ ..."], ...]}
Prose output:
  {"book": 1, "passages": [{"from": 1, "text": "The wrath sing, goddess, ..."}, ...]}
"from" is the Greek line where the passage starts, so passages line up with the original.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

TEI = "{http://www.tei-c.org/ns/1.0}"


def local(tag):
    return tag.split("}")[-1]


def text_of(el, quotes=False):
    """Plain text of an element, skipping editorial notes; optionally wrap <quote> in “ ”."""
    parts = []

    def walk(e):
        name = local(e.tag)
        if name == "note":
            if e.tail:
                parts.append(e.tail)
            return
        if name == "milestone":
            # A line marker can sit between two words with no space around it.
            parts.append(" ")
            if e.tail:
                parts.append(e.tail)
            return
        open_q = quotes and name == "quote"
        # Editors' suspected later additions: print in [brackets], as editions do.
        if name == "del":
            parts.append("[")
            if e.text:
                parts.append(e.text)
            for c in e:
                walk(c)
            parts.append("]")
            if e.tail:
                parts.append(e.tail)
            return
        if open_q:
            parts.append("“")
        if e.text:
            parts.append(e.text)
        for c in e:
            walk(c)
        if open_q:
            parts.append("”")
        if e.tail:
            parts.append(e.tail)

    if el.text:
        parts.append(el.text)
    for c in el:
        walk(c)
    s = "".join(parts)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"“\s+", "“", s)
    s = re.sub(r"\s+”", "”", s)
    return s


def books(root):
    for div in root.iter(TEI + "div"):
        if div.get("type") == "textpart" and (div.get("subtype") or "").lower() == "book":
            yield int(div.get("n")), div


def write(out_dir, n, data):
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, f"{n:02d}.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def verse(src, out_dir):
    total = 0
    for n, div in books(ET.parse(src).getroot()):
        lines = []
        for l in div.iter(TEI + "l"):
            num = l.get("n")
            if num is None:
                continue
            lines.append([int(re.sub(r"\D", "", num) or 0), text_of(l)])
        write(out_dir, n, {"book": n, "lines": lines})
        total += len(lines)
        print(f"book {n:2d}: {len(lines)} lines")
    print("total lines:", total)


def prose(src, out_dir):
    for n, div in books(ET.parse(src).getroot()):
        passages = []
        for card in div:
            if local(card.tag) != "div" or (card.get("subtype") or "").lower() != "card":
                continue
            paras = [text_of(p, quotes=True) for p in card.iter(TEI + "p")]
            passages.append({"from": int(card.get("n")), "text": "\n\n".join(p for p in paras if p)})
        write(out_dir, n, {"book": n, "passages": passages})
        print(f"book {n:2d}: {len(passages)} passages")


if __name__ == "__main__":
    mode, src, out = sys.argv[1:4]
    {"verse": verse, "prose": prose}[mode](src, out)
