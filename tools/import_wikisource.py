"""Import a translation of a work from Wikisource into Mouseion's per-book JSON.

Usage:
  python3 -I tools/import_wikisource.py monti        # one translation
  python3 -I tools/import_wikisource.py all          # every entry in SOURCES

Output formats (one file per book, 01.json … 24.json):
  verse:  {"book": 1, "lines": [[1, "…"], …], "breaks": [1, 8, 22, …]}
          lines numbered from 1 in the translation's own count; "breaks" are
          the lines that start a new paragraph (stanza).
  prose:  {"book": 1, "passages": [{"from": 1, "text": "…"}, …]}
          "from" is the line of the ORIGINAL where the passage starts.
"""
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wikisource import parse  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ROMAN = [None, "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
         "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV"]
RU_ORD = [None, "первая", "вторая", "третья", "четвертая", "пятая", "шестая", "седьмая",
          "восьмая", "девятая", "десятая", "одиннадцатая", "двенадцатая", "тринадцатая",
          "четырнадцатая", "пятнадцатая", "шестнадцатая", "семнадцатая", "восемнадцатая",
          "девятнадцатая", "двадцатая", "двадцать первая", "двадцать вторая",
          "двадцать третья", "двадцать четвертая"]

SOURCES = {
    "monti": {
        "host": "it.wikisource.org", "format": "verse",
        "page": lambda b: f"Iliade (Monti)/Libro {ROMAN[b]}",
        "out": "data/works/iliad/texts/ita-monti",
    },
    "gnedich": {
        "host": "ru.wikisource.org", "format": "verse",
        "page": lambda b: f"Илиада (Гомер; Гнедич)/Песнь {RU_ORD[b]}",
        "out": "data/works/iliad/texts/rus-gnedich",
    },
    "segala": {
        "host": "es.wikisource.org", "format": "prose",
        "page": lambda b: f"La Ilíada (Luis Segalá y Estalella)/Canto {ROMAN[b]}",
        "out": "data/works/iliad/texts/spa-segala",
    },
}

VOID = {"br", "img", "link", "meta", "hr", "wbr", "input", "source", "area", "col"}

# Elements whose contents are never part of the text.
SKIP_CLASSES = {"numeropagina", "numeroriga", "linenum", "pagenum", "reference", "mw-cite-backlink",
                "ws-noexport", "noprint", "mw-editsection"}


def _skip(attrs):
    cls = set((dict(attrs).get("class") or "").split())
    return bool(cls & SKIP_CLASSES)


class VerseParser(HTMLParser):
    """Collect lines from <div class="poem"> blocks; <br> ends a line,
    an empty line marks a paragraph break."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth_poem = 0
        self.skip = 0
        self.stack = []
        self.cur = []
        self.lines = []       # list of strings; "" = paragraph break
        self.marks = []       # (line number printed in the source, index in self.lines)

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            if tag == "br" and self.depth_poem and not self.skip:
                self._end_line()
            return
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        entering_skip = _skip(attrs) or tag in ("sup", "style", "script")
        if entering_skip and self.depth_poem and ("numeroriga" in cls or "linenum" in cls):
            self._pending_mark = True
        self.stack.append((tag, "poem" in cls, entering_skip))
        if "poem" in cls:
            self.depth_poem += 1
        if entering_skip:
            self.skip += 1

    def handle_endtag(self, tag):
        # "<br />" also fires an end tag; and stray end tags must not unwind the stack.
        if tag in VOID or tag not in (x[0] for x in self.stack):
            return
        while self.stack:
            t, was_poem, was_skip = self.stack.pop()
            if was_skip:
                self.skip -= 1
            if was_poem:
                self.depth_poem -= 1
                self._end_line()
            if t == tag:
                break
        if tag == "p" and self.depth_poem and not self.skip:
            self._end_line()

    def handle_data(self, data):
        if not self.depth_poem:
            return
        if self.skip:
            if getattr(self, "_pending_mark", False):
                m = re.search(r"\d+", data)
                if m:
                    self.marks.append((int(m.group()), len(self.lines)))
                    self._pending_mark = False
            return
        self.cur.append(data)

    def _end_line(self):
        s = re.sub(r"\s+", " ", "".join(self.cur)).strip()
        self.cur = []
        if s:
            self.lines.append(s)
        elif self.lines and self.lines[-1] != "":
            self.lines.append("")


def verse(html_text):
    p = VerseParser()
    p.feed(html_text)
    p._end_line()
    lines, breaks, n, start_para = [], [], 0, True
    index_to_n = {}
    for i, s in enumerate(p.lines):
        if s == "":
            start_para = True
            continue
        n += 1
        index_to_n[i] = n
        if start_para:
            breaks.append(n)
            start_para = False
        lines.append([n, s])
    # Check our count against the numbers printed in the source.
    mismatches = []
    for printed, idx in p.marks:
        j = idx
        while j < len(p.lines) and p.lines[j] == "":
            j += 1
        if j in index_to_n and index_to_n[j] != printed:
            mismatches.append((printed, index_to_n[j]))
    return {"lines": lines, "breaks": breaks}, mismatches


class ProseParser(HTMLParser):
    """Paragraphs marked with the original's line number, e.g.
    <span title="I:1" id="I:1">1</span> Canta, oh diosa …"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_p = 0
        self.skip = 0
        self.stack = []
        self.marker = None
        self.in_marker = False
        self.cur = []
        self.paras = []   # (from or None, text)

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        a = dict(attrs)
        is_marker = tag == "span" and re.fullmatch(r"[IVXL]+:\d+", a.get("title") or "")
        skip = (_skip(attrs) or tag in ("sup", "style", "script")) and not is_marker
        self.stack.append((tag, skip, bool(is_marker)))
        if skip:
            self.skip += 1
        if is_marker and self.in_p:
            self.marker = int(a["title"].split(":")[1])
            self.in_marker = True
        if tag == "p":
            self.in_p += 1

    def handle_endtag(self, tag):
        if tag in VOID or tag not in (x[0] for x in self.stack):
            return
        while self.stack:
            t, skip, marker = self.stack.pop()
            if skip:
                self.skip -= 1
            if marker:
                self.in_marker = False
            if t == "p":
                self.in_p -= 1
                self._end_para()
            if t == tag:
                break

    def handle_data(self, data):
        if self.in_p and not self.skip and not self.in_marker:
            self.cur.append(data)

    def _end_para(self):
        s = re.sub(r"\s+", " ", "".join(self.cur)).strip()
        if s:
            self.paras.append((self.marker, s))
        self.cur = []
        self.marker = None


def prose(html_text):
    p = ProseParser()
    p.feed(html_text)
    passages = []
    for frm, text in p.paras:
        if frm is not None:
            passages.append({"from": frm, "text": text})
        elif passages:  # unmarked paragraph continues the previous passage
            passages[-1]["text"] += "\n\n" + text
        # text before the first marker (titles, captions) is dropped
    return {"passages": passages}


def run(name):
    cfg = SOURCES[name]
    out = os.path.join(ROOT, cfg["out"])
    os.makedirs(out, exist_ok=True)
    total = 0
    for b in range(1, 25):
        title = cfg["page"](b)
        h, _ = parse(cfg["host"], title)
        h = re.sub(r"<style[^>]*>.*?</style>", "", h, flags=re.S)
        if cfg["format"] == "verse":
            data, mism = verse(h)
            n = len(data["lines"])
            note = f"  ({len(mism)} line-number mismatches, first: {mism[:3]})" if mism else ""
            print(f"{name} book {b:2d}: {n} lines{note}", flush=True)
        else:
            data = prose(h)
            n = len(data["passages"])
            print(f"{name} book {b:2d}: {n} passages, from {[p['from'] for p in data['passages'][:4]]}…", flush=True)
        total += n
        with open(os.path.join(out, f"{b:02d}.json"), "w", encoding="utf-8") as f:
            json.dump({"book": b, **data}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{name}: {total} total", flush=True)


if __name__ == "__main__":
    names = list(SOURCES) if sys.argv[1] == "all" else sys.argv[1:]
    for n in names:
        run(n)
