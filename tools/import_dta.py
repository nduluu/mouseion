"""Convert a Deutsches Textarchiv (DTA) TEI file of a verse translation into
Mouseion's per-book JSON (same "verse" format as tools/import_wikisource.py).

Usage:
  python3 -I tools/import_dta.py SOURCE.TEI-P5.xml OUT_DIR [ORIGINAL_DIR]

Books are the <div>s whose heading names a "Gesang" (Erster Gesang …).
Lines end at <lb/>; a new <p> starts a new paragraph. Running headers (<fw>),
page breaks (<pb>) and footnotes are dropped; printers' errors marked
<choice><sic/><corr/></choice> keep the correction. The line numbers printed
in the margin (<note place="right">5</note>) are used to check the count.
If ORIGINAL_DIR is given, each book's line count is compared with the original.

Original spelling is kept exactly (long ſ, ͤ above vowels).
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

TEI = "{http://www.tei-c.org/ns/1.0}"
ORDINALS = ["erster", "zweiter", "dritter", "vierter", "funfter", "sechster", "siebenter", "achter",
            "neunter", "zehnter", "elfter", "zwolfter", "dreizehnter", "vierzehnter", "funfzehnter",
            "sechzehnter", "siebzehnter", "achtzehnter", "neunzehnter", "zwanzigster",
            "einundzwanzigster", "zweiundzwanzigster", "dreiundzwanzigster", "vierundzwanzigster"]


def local(tag):
    return tag.split("}")[-1]


def plain(s):
    """Normalise a heading for matching: long s → s, umlauts dropped
    (Voss writes "Fuͤnfter", "Funfzehnter", "Zwoͤlfter"), no spaces."""
    s = s.replace("ſ", "s").replace("\u0364", "").lower()
    s = s.translate(str.maketrans("äöü", "aou")).replace("ae", "a").replace("oe", "o").replace("ue", "u")
    s = s.replace("achzehnter", "achtzehnter")
    return re.sub(r"\s+|und", lambda m: "" if m.group().isspace() else "und", s)


def book_number(div):
    head = div.find(TEI + "head")
    if head is None:
        return None
    text = plain("".join(head.itertext()))
    if "gesang" not in text:
        return None
    for i, word in sorted(enumerate(ORDINALS, 1), key=lambda x: -len(x[1])):
        if word in text:
            return i
    return None


class Collector:
    def __init__(self):
        self.lines = []      # strings; "" marks a paragraph break
        self.cur = []
        self.marks = []      # (printed number, index of the line it ends)

    def end_line(self):
        s = re.sub(r"\s+", " ", "".join(self.cur)).strip()
        self.cur = []
        if s:
            self.lines.append(s)

    def para_break(self):
        self.end_line()
        if self.lines and self.lines[-1] != "":
            self.lines.append("")

    def walk(self, el):
        name = local(el.tag)
        if name in ("fw", "pb", "head", "milestone"):
            self.tail(el)
            return
        if name == "note":
            if el.get("place") == "right":
                m = re.search(r"\d+", "".join(el.itertext()))
                if m:
                    # the number belongs to the line it stands on (ended by the next <lb/>)
                    self.marks.append((int(m.group()), len(self.lines)))
            self.tail(el)
            return
        if name == "sic":  # keep only the correction
            self.tail(el)
            return
        if name == "lb":
            self.end_line()
            self.tail(el)
            return
        if name == "p":
            self.para_break()
        if el.text:
            self.cur.append(el.text)
        for c in el:
            self.walk(c)
        if name == "p":
            self.para_break()
        self.tail(el)

    def tail(self, el):
        if el.tail:
            self.cur.append(el.tail)


def convert(div):
    c = Collector()
    for child in div:
        c.walk(child)
    c.end_line()
    # Number lines by counting, but follow the translator's printed margin
    # numbers: they record which line of the ORIGINAL a line corresponds to
    # (where the translation compresses or expands, the numbers jump).
    printed = {i: num for num, i in c.marks}
    lines, breaks, n, start = [], [], 0, True
    index_to_n = {}
    counted = {}
    raw = 0
    for i, s in enumerate(c.lines):
        if s == "":
            start = True
            continue
        n += 1
        raw += 1
        counted[i] = raw
        if i in printed and abs(printed[i] - n) <= 5:
            n = printed[i]
        index_to_n[i] = n
        if start:
            breaks.append(n)
            start = False
        lines.append([n, s])
    # Places where the printed numbers disagree with a plain count.
    mismatches = [(p, counted.get(i)) for p, i in c.marks if counted.get(i) not in (p, None)]
    return {"lines": lines, "breaks": breaks}, mismatches


def main(src, out, orig_dir=None):
    root = ET.parse(src).getroot()
    body = root.find(f".//{TEI}body")
    found = {}
    for div in body.iter(TEI + "div"):
        b = book_number(div)
        if b and b not in found:
            found[b] = div
    os.makedirs(out, exist_ok=True)
    for b in sorted(found):
        data, mism = convert(found[b])
        note = ""
        if orig_dir:
            with open(os.path.join(orig_dir, f"{b:02d}.json"), encoding="utf-8") as f:
                last = json.load(f)["lines"][-1][0]
            if data["lines"][-1][0] != last:
                data["lineCounts"] = {"translation": data["lines"][-1][0], "original": last}
            note = f" (original {last})"
        print(f"book {b:2d}: {len(data['lines'])} lines, last numbered {data['lines'][-1][0]}{note}"
              + (f"; {len(mism)} printed-number mismatches, first {mism[:3]}" if mism else ""))
        with open(os.path.join(out, f"{b:02d}.json"), "w", encoding="utf-8") as f:
            json.dump({"book": b, **data}, f, ensure_ascii=False, separators=(",", ":"))
    missing = [b for b in range(1, 25) if b not in found]
    if missing:
        print("books not found:", missing)


if __name__ == "__main__":
    main(*sys.argv[1:4])
