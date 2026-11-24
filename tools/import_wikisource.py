"""Import a translation of a work from Wikisource into Mouseion's per-book JSON.

Usage:
  python3 -I tools/import_wikisource.py monti        # one translation
  python3 -I tools/import_wikisource.py all          # every entry in SOURCES

Output formats (one file per book, 01.json … 24.json):
  verse:  {"book": 1, "lines": [[1, "…"], …], "breaks": [1, 8, 22, …]}
          lines numbered from 1 in the translation's own count; "breaks" are
          the lines that start a new paragraph (stanza). Where the transcription
          is linked to scans of a printed edition, "pages": [[first line,
          printed page, scan image(, volume)], …] records where each printed
          page begins (from the page markers Wikisource puts in the text).
  prose:  {"book": 1, "passages": [{"from": 1, "text": "…"}, …]}
          "from" is the line of the ORIGINAL where the passage starts.
          With scans, a passage may carry "pages": [[offset, printed page,
          scan image], …]: the printed page that begins at that character of
          its text (moved past a word the page break splits, "sacer|dote").
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
        # Milano 1825, two volumes in one scan: images from 326 on are vol. II.
        "volumes": [(1, "I"), (326, "II")],
    },
    "gnedich": {
        "host": "ru.wikisource.org", "format": "verse",
        "page": lambda b: f"Илиада (Гомер; Гнедич)/Песнь {RU_ORD[b]}",
        "out": "data/works/iliad/texts/rus-gnedich",
    },
    "lecontedelisle": {
        "host": "fr.wikisource.org", "format": "plain",
        "page": lambda b: f"Iliade/Rhapsodie {ROMAN[b]}",
        "out": "data/works/iliad/texts/fra-leconte",
    },
    "roure": {
        "host": "ca.wikisource.org", "format": "plain",
        "page": lambda b: f"Iliada/Cant {ROMAN[b]}",
        "out": "data/works/iliad/texts/cat-roure",
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
        self.pages = []       # [printed page, scan image, index of the first line on it]
        self.page_label = False

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            if tag == "br" and self.depth_poem and not self.skip:
                self._end_line()
            return
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if "numeropagina" in cls and (a.get("data-pagenum") or "").isdigit():
            # A printed page starts here. If a line is half collected, the
            # page starts with the next line.
            at = len(self.lines) + (1 if "".join(self.cur).strip() else 0)
            self.pages.append([None, int(a["data-pagenum"]), at])
            self.page_label = True
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
        if self.page_label and re.fullmatch(r"\s*[0-9ivxlcIVXLC]+\s*", data):
            self.pages[-1][0] = data.strip()   # the printed number: "[p. <a>12</a>]"
            self.page_label = False
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


def verse(html_text, volumes=None):
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
    pages = []
    ordered = sorted(index_to_n)
    for label, scan, at in p.pages:
        first = next((index_to_n[i] for i in ordered if i >= at), None)
        if first is None or label is None:
            continue
        if pages and pages[-1][0] == first:
            pages.pop()      # two markers before the same line: the later counts
        entry = [first, label, scan]
        if volumes:
            entry.append([v for start, v in volumes if scan >= start][-1])
        pages.append(entry)
    out = {"lines": lines, "breaks": breaks}
    if pages:
        out["pages"] = pages
    return out, mismatches


# Page markers inside collected prose (private-use characters, never in the texts).
PB_OPEN, PB_SEP, PB_CLOSE = "\ue000", "\ue002", "\ue001"
PB_RE = re.compile("\ue000[^\ue001]*\ue001")


def finish_pages(data):
    """Take the page markers out of each passage's text and record them as
    "pages": [[offset, printed page, scan image], …]. A break inside a word
    moves to the end of that word. A marker whose id is not a page number
    (an anchor such as "Cant_I") gets its number from the next marker:
    printed page = scan image - (that marker's scan image - its page)."""
    found = []
    for ps in data["passages"]:
        text, out, marks = ps["text"], [], []
        pos = 0
        for m in PB_RE.finditer(text):
            out.append(text[pos:m.start()])
            label, scan = m.group()[1:-1].split(PB_SEP)
            marks.append([sum(len(x) for x in out), label, int(scan)])
            pos = m.end()
        out.append(text[pos:])
        clean = "".join(out)
        if clean != clean.strip() or "  " in clean:
            # a marker between two spaces leaves a double space
            shift = []
            fixed = ""
            for i, ch in enumerate(clean):
                if ch == " " and (fixed.endswith(" ") or fixed.endswith("\n") or not fixed):
                    shift.append(i)
                    continue
                fixed += ch
            for mk in marks:
                mk[0] -= sum(1 for i in shift if i < mk[0])
            clean = fixed.rstrip()
        pages = []
        for off, label, scan in marks:
            off = min(off, len(clean))
            if 0 < off < len(clean) and clean[off - 1].isalnum() and clean[off].isalnum():
                while off < len(clean) and not clean[off].isspace():
                    off += 1
                while off < len(clean) and clean[off] == " ":
                    off += 1
            if pages and pages[-1][0] == off:
                pages.pop()
            pages.append([off, label, scan])
            found.append(pages[-1])
        ps["text"] = clean
        if pages:
            ps["pages"] = pages
    for i, pg in enumerate(found):
        if not re.fullmatch(r"[0-9]+|[ivxlcdm]+|[IVXLCDM]+", pg[1]):
            nxt = next((q for q in found[i + 1:] if q[1].isdigit()), None)
            pg[1] = str(pg[2] - (nxt[2] - int(nxt[1]))) if nxt else None
    for ps in data["passages"]:
        if "pages" in ps:
            ps["pages"] = [q for q in ps["pages"] if q[1]]
            if not ps["pages"]:
                del ps["pages"]
    return data


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
        self.pending = []  # page markers met outside a paragraph

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if tag == "span" and "pagenum" in cls:
            # <span class="pagenum" id="12" title="Page:Book.djvu/18">: printed
            # page 12 begins here. Kept in the text as a marker, read out later.
            m = re.search(r"/(\d+)$", a.get("title") or "")
            if m:
                mark = PB_OPEN + (a.get("id") or "") + PB_SEP + m.group(1) + PB_CLOSE
                (self.cur if self.in_p else self.pending).append(mark)
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
        marks = PB_RE.findall(s)
        if not re.search(r"\w", PB_RE.sub("", s).replace("_", "")):
            # Nothing but page markers (a page that starts before a heading):
            # they belong to the next paragraph with text.
            self.pending.extend(marks)
        elif s:
            self.paras.append((self.marker, "".join(self.pending) + s))
            self.pending = []
        self.cur = []
        self.marker = None


def prose(html_text):
    p = ProseParser()
    p.feed(html_text)
    passages = []
    carry = ""
    for frm, text in p.paras:
        if frm is not None:
            passages.append({"from": frm, "text": carry + text})
            carry = ""
        elif passages:  # unmarked paragraph continues the previous passage
            passages[-1]["text"] += "\n\n" + text
        else:
            # text before the first marker (titles, captions) is dropped, but
            # not the page it starts on
            carry += "".join(PB_RE.findall(text))
    return finish_pages({"passages": passages})


class PlainParser(ProseParser):
    """Like ProseParser, but a <br> inside a paragraph also starts a new one:
    some transcriptions put a whole chapter in one <p>, one line per paragraph."""

    def handle_starttag(self, tag, attrs):
        if tag == "br" and self.in_p and not self.skip:
            self._end_para()
            return
        super().handle_starttag(tag, attrs)


def plain(html_text):
    """Prose without markers: every paragraph, in order (shown book by book).
    Decorative rules ("______", "* * *") are dropped."""
    p = PlainParser()
    p.feed(html_text)
    paras = [text for _, text in p.paras if re.search(r"\w", PB_RE.sub("", text).replace("_", ""))]
    return finish_pages({"passages": [{"from": None, "text": text} for text in paras]})


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
            data, mism = verse(h, cfg.get("volumes"))
            n = len(data["lines"])
            if data.get("pages"):
                pg = data["pages"]
                vol = (pg[0][3] + " ") if len(pg[0]) > 3 else ""
                mism.append(f"pages {vol}{pg[0][1]}–{pg[-1][1]}")
            note = f"  ({len(mism)} line-number mismatches, first: {mism[:3]})" if mism else ""
            print(f"{name} book {b:2d}: {n} lines{note}", flush=True)
        elif cfg["format"] == "plain":
            data = plain(h)
            n = len(data["passages"])
            print(f"{name} book {b:2d}: {n} paragraphs", flush=True)
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
