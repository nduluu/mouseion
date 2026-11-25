# Builds docs/mouseion-pipeline-guide.pdf (A4, for printing):
#   python3 docs/make_pipeline_guide.py docs/mouseion-pipeline-guide.pdf
# Shares its look with docs/make_plan.py. Needs reportlab and the Liberation and DejaVu fonts.
import os
import sys
from xml.sax.saxutils import escape

sys.argv = [sys.argv[0], sys.argv[1] if len(sys.argv) > 1 else "docs/mouseion-pipeline-guide.pdf"]
OUT = sys.argv[1]

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether, Preformatted, CondPageBreak)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

F = "/usr/share/fonts/truetype/"
for name, f in [("Serif", "liberation/LiberationSerif-Regular.ttf"), ("Serif-B", "liberation/LiberationSerif-Bold.ttf"),
                ("Serif-I", "liberation/LiberationSerif-Italic.ttf"), ("Serif-BI", "liberation/LiberationSerif-BoldItalic.ttf"),
                ("Sans", "liberation/LiberationSans-Regular.ttf"), ("Sans-B", "liberation/LiberationSans-Bold.ttf"),
                ("Sym", "dejavu/DejaVuSans.ttf"), ("Mono", "dejavu/DejaVuSansMono.ttf")]:
    pdfmetrics.registerFont(TTFont(name, F + f))
addMapping("Serif", 0, 0, "Serif"); addMapping("Serif", 1, 0, "Serif-B")
addMapping("Serif", 0, 1, "Serif-I"); addMapping("Serif", 1, 1, "Serif-BI")
addMapping("Sans", 0, 0, "Sans"); addMapping("Sans", 1, 0, "Sans-B")

INK = colors.HexColor("#1a1a1a"); MUTED = colors.HexColor("#666666")
LINE = colors.HexColor("#cccccc"); TINT = colors.HexColor("#f3f1ec"); CODEBG = colors.HexColor("#f6f6f4")

body = ParagraphStyle("body", fontName="Serif", fontSize=10.5, leading=14.2, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=9, leading=12, textColor=MUTED)
cell = ParagraphStyle("cell", parent=body, fontSize=9.2, leading=12, spaceAfter=0)
cellb = ParagraphStyle("cellb", parent=cell, fontName="Sans-B", fontSize=8.8)
h1 = ParagraphStyle("h1", fontName="Sans-B", fontSize=22, leading=26, textColor=INK, spaceAfter=4)
sub = ParagraphStyle("sub", fontName="Sans", fontSize=11, leading=15, textColor=MUTED, spaceAfter=14)
h2 = ParagraphStyle("h2", fontName="Sans-B", fontSize=13.5, leading=17, textColor=INK, spaceBefore=12, spaceAfter=6)
h3 = ParagraphStyle("h3", fontName="Sans-B", fontSize=10.5, leading=14, textColor=INK, spaceBefore=7, spaceAfter=3)
bullet = ParagraphStyle("bullet", parent=body, leftIndent=12, bulletIndent=1, spaceAfter=2.5)
check = ParagraphStyle("check", parent=body, leftIndent=17, bulletIndent=0, spaceAfter=3.5,
                       bulletFontName="Sym", bulletFontSize=11)
code = ParagraphStyle("code", fontName="Mono", fontSize=8.2, leading=10.6, textColor=INK)


def P(t, s=body):
    return Paragraph(t, s)


def C(t):
    """Inline code."""
    return '<font face="Mono" size="8.8">%s</font>' % escape(t)


def bullets(items):
    return [Paragraph(t, bullet, bulletText="•") for t in items]


def checks(items):
    return [Paragraph(t, check, bulletText="☐") for t in items]


def block(text):
    t = Table([[Preformatted(text.strip("\n"), code)]], colWidths=[170 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CODEBG), ("BOX", (0, 0), (-1, -1), 0.4, LINE),
                           ("LEFTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    return [t, Spacer(1, 6)]


def table(rows, widths):
    data = [[P(c, cellb if i == 0 else cell) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                           ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                           ("BACKGROUND", (0, 0), (-1, 0), TINT), ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK)]))
    return t


def note(text):
    t = Table([[P(text, cell)]], colWidths=[170 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), TINT), ("BOX", (0, 0), (-1, -1), 0.4, LINE),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                           ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return [t, Spacer(1, 6)]


def on_page(c, doc):
    c.saveState(); c.setFont("Sans", 8); c.setFillColor(MUTED)
    c.drawString(20 * mm, 12 * mm, "Mouseion — collecting public-domain texts: the laptop pipeline · 25 November 2026")
    c.drawRightString(190 * mm, 12 * mm, "Page %d" % doc.page)
    c.setStrokeColor(LINE); c.line(20 * mm, 16 * mm, 190 * mm, 16 * mm); c.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=22 * mm,
                      title="Mouseion — collecting public-domain texts", author="Mouseion project",
                      subject="Step-by-step pipeline for downloading, OCR and checking texts on a MacBook Air M1")
doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)],
                                   onPage=on_page)])
W = 170 * mm
s = []

# ---------------------------------------------------------------- title
s += [P("Collecting public-domain texts", h1),
      P("A step-by-step pipeline for a MacBook Air M1 (8 GB) with an external drive · Mouseion · 25 November 2026", sub)]

s += [P("In short", h2)]
s += bullets([
    "<b>Two tracks, run side by side.</b> Track A collects texts that already exist as transcriptions "
    "(Wikisource, Project Gutenberg, Perseus, GRETIL and others): fast, accurate, a few minutes per work. "
    "Track B turns scans into text (OCR) for works that exist only as page images: slow, and the error rate must be measured.",
    "<b>Never OCR what someone has already transcribed.</b> Before any scan is downloaded, the work card records "
    "where a transcription was searched for. This one habit saves more time than any software.",
    "<b>Docling is the wrong main tool for this collection.</b> It is built for modern reports and papers: it turns "
    "verse into paragraphs, trusts the old text layer inside archive PDFs, and its OCR engines know few historical "
    "scripts. Use it only for modern, born-digital PDFs. For scans, use Tesseract, Apple's built-in recogniser and Kraken, "
    "chosen per script (section 4).",
    "<b>The laptop is enough.</b> 8 GB of memory rules out the large AI reading models, but the engines that matter run "
    "comfortably. Expect a few thousand pages per night for Latin-script print, fewer for difficult scripts.",
    "<b>Start with three pilot books in rising difficulty</b>, all translations of the Iliad already found on the "
    "Internet Archive: Portuguese 1874, Croatian 1883, Arabic 1904 (section 3). The first month is about learning where "
    "the errors come from, not about volume.",
    "<b>The scripts are in the repository</b> (folder " + C("pipeline/") + "). This guide tells you when to run each one.",
])

# ---------------------------------------------------------------- 1 what first
s += [P("1. What to collect first", h2)]
s += [P("Mouseion shows an original next to its translations, matched by book and line (or chapter and verse). "
        "So the first works are those with a fixed numbering system, many public-domain translations, and an original "
        "that already exists as a reliable digital text. That gives the most value per hour and tests the reader with many languages.")]
s += [table([
    ["Wave", "Works", "Why these", "Original text from"],
    ["1 (now)", "Iliad, Odyssey: complete the translations", "Reader and tools already built; dozens of translations in many languages and scripts",
     "Perseus (already imported)"],
    ["2", "Aeneid, Metamorphoses, Divine Comedy, Hesiod", "Book.line numbering like Homer; many translations; Italian connection",
     "Perseus / Latin Library; Wikisource it (Petrocchi is modern: use an older public-domain text)"],
    ["3", "Bhagavad Gita, Dhammapada, Tao Te Ching, Analects, Qur'an", "Chapter.verse numbering; the core texts of Asian and Middle Eastern traditions; "
     "translations in almost every language", "GRETIL (Sanskrit), SuttaCentral (Pali, CC0), Wikisource zh, Tanzil (Arabic; its licence allows verbatim copies only)"],
    ["4", "Shahnameh, Kalevala, Beowulf, Nibelungenlied, Song of Roland, Gilgamesh", "Epics of single languages; strong national translation traditions",
     "Ganjoor (Persian), Wikisource fi / de / fr, ETCSL/ORACC transliterations (check terms)"],
    ["5", "Prose: Thousand and One Nights, Don Quixote, Decameron, Tale of Genji, Journey to the West",
     "Needs passage alignment (Mouseion already supports it for prose); large but popular", "Wikisource, Aozora Bunko, Bulaq 1835 Nights (scans)"],
], [16 * mm, 42 * mm, 58 * mm, 54 * mm])]
s += [Spacer(1, 4), P("Within each work, collect in this order: (1) the original; (2) translations already transcribed "
                      "(Track A); (3) translations in languages and scripts Mouseion does not have yet, from scans (Track B). "
                      "Diversity of languages beats a fifth English version.", small)]

# ---------------------------------------------------------------- 2 two tracks
s += [P("2. The two tracks", h2)]
s += [table([
    ["", "Track A: existing transcriptions", "Track B: scans → OCR"],
    ["Sources", "Wikisource (all languages), Project Gutenberg, Perseus / Scaife, First1KGreek, Deutsches Textarchiv, GRETIL, "
     "SuttaCentral, Ganjoor, Aozora Bunko, Liber Liber, Biblioteca Italiana",
     "Internet Archive, HathiTrust (full view), Google Books, Gallica, Europeana, national libraries (e.g. Biblioteca Digital Hispánica, "
     "Polona, Digi.Kansalliskirjasto)"],
    ["Effort per work", "15–60 minutes (find, download, convert, check line counts)", "1–2 evenings of setup and testing, a night of OCR, then proofreading"],
    ["Quality", "Usually proofread by volunteers; check numbering and editions", "Must be measured (section 6); never published unmeasured"],
    ["Tools", "Mouseion's import scripts (" + C("tools/import_wikisource.py") + ", " + C("import_dta.py") + ", " + C("import_perseus.py") + ")",
     "The " + C("pipeline/") + " scripts, plus one new importer for checked OCR text (to be written when the first pilot text is ready)"],
], [24 * mm, 73 * mm, 73 * mm])]

# ---------------------------------------------------------------- 3 pilot books
s += [P("3. Three pilot books for Track B", h2)]
s += [P("All three were found on the Internet Archive while writing this guide (25 November 2026). "
        "Each teaches something new; do them in this order.")]
s += [table([
    ["", "1 · Portuguese, 1874", "2 · Croatian, 1883", "3 · Arabic, 1904"],
    ["Book", "<i>Iliada de Homero: em verso portuguez</i>, Manuel Odorico Mendes (died 1864)",
     "<i>Iliada</i> (1883); catalogue gives no translator, probably Tomo Maretić (died 1938): confirm on the title page",
     "<i>Ilyādhat Hūmīrūs</i>, Sulaymān al-Bustānī (died 1925): verse translation with a long historical commentary"],
    ["Archive item", C("iliadadehomeroe00mendgoog"), C("homerova-iliada-1883"), C("20221225_20221225_1724")],
    ["What it offers", "Google scan, 357 pages; PDF and the Archive's own OCR text; no full-quality page images",
     "Full-quality page images (104 MB), PDF, the Archive's OCR text", "600 ppi page images (1.08 GB), PDF, the Archive's OCR text"],
    ["What it teaches", "The basic loop: pages → OCR → measure → proofread. Latin script with accents; long s possible; Google-scan artefacts",
     "Diacritics (č ć š ž đ); metadata that cannot be trusted (it claims 72 ppi)",
     "Right-to-left, connected script, vowel signs; separating verse from commentary; the catalogue says the language is Urdu (wrong)"],
    ["Engines to compare", "Tesseract " + C("por") + " vs Apple Vision " + C("pt-BR"), "Tesseract " + C("hrv") + " (best) vs standard " + C("hrv") + " vs the Archive’s OCR (Apple Vision has no Croatian)",
     "Tesseract " + C("ara") + " vs Apple Vision " + C("ar-SA") + " vs a Kraken Arabic print model"],
], [26 * mm, 48 * mm, 48 * mm, 48 * mm])]
s += [Spacer(1, 4), P("Already digital, so Track A, not OCR: Iakovos Polylas's Modern Greek Odyssey is on Project Gutenberg "
                      "(nos. 30613–30616). It is a good first Track A import in a non-Latin script.", small)]

# ---------------------------------------------------------------- 4 difficulties
s += [CondPageBreak(60 * mm), P("4. Why scans are hard, and what to do about each problem", h2)]
s += [P("This is the core of the work. Generic tools, Docling included, are trained on modern business documents. "
        "Old books in many scripts break them in predictable ways. Each row names the problem, what goes wrong, and the remedy.")]
rows = [["Problem", "What goes wrong", "What to do"]]
rows += [
    ["<b>Verse</b>", "Layout tools (Docling, most PDF converters) join lines into paragraphs and lose the line numbering Mouseion depends on.",
     "OCR line by line (Tesseract " + C("--psm 4") + "; Vision returns lines). Keep one printed line per text line; count lines per book against the original."],
    ["<b>Old text layer in archive PDFs</b>", "Internet Archive and Google PDFs contain an invisible OCR layer, often poor. Docling and copy-paste read it instead of the image.",
     "Use the page images (JP2) or render the PDF to images (" + C("pages.sh") + "). Treat the Archive's " + C("_djvu.txt") + " as one more engine to measure, not as truth."],
    ["<b>Historical typefaces</b>", "Fraktur, long s (ſ), ligatures (ct, st), old Cyrillic (ѣ, і, ѳ), polytonic Greek accents: modern engines guess modern letters.",
     "Fraktur: Tesseract " + C("deu_latf") + ". Polytonic Greek: Tesseract " + C("grc") + " or Kraken Greek models. Keep the original spelling; normalise only in a separate copy."],
    ["<b>Right-to-left and connected scripts</b>", "Arabic, Persian, Urdu Nastaliq, Hebrew, Syriac: wrong letter forms, lost vowel signs, reversed punctuation and numbers.",
     "Compare engines on a sample; Kraken is the strongest open option for Arabic-script print. Nastaliq (Urdu, Persian poetry) is very hard: postpone."],
    ["<b>Stacked and complex scripts</b>", "Devanagari, Bengali, Tamil, Tibetan, Burmese, Ethiopic: conjunct letters split or merged; vowel signs placed wrongly.",
     "Tesseract has models for all of these; quality varies. Measure, and expect more proofreading."],
    ["<b>Chinese and Japanese</b>", "Vertical columns read right to left; no punctuation in classical texts; old character forms; small reading glosses (furigana) mixed in.",
     "Prefer existing transcriptions (Wikisource, Aozora Bunko, CBETA). Apple Vision reads modern print; Tesseract has vertical models (" + C("chi_tra_vert") + ", " + C("jpn_vert") + ")."],
    ["<b>Several languages on one page</b>", "Bilingual editions (e.g. Loeb: Greek left, English right), Greek quotations in a Latin commentary: one engine per page fails on the other language.",
     "Split facing pages before OCR; give Tesseract both languages (" + C("grc+eng") + "); or OCR each column separately."],
    ["<b>Page furniture</b>", "Running headers, page numbers, footnotes, marginal line numbers, catchwords, the editor's apparatus all end up inside the text.",
     "Remove by position (top and bottom bands) and by pattern; keep page numbers separately: Mouseion uses them for citation."],
    ["<b>Hyphenation</b>", "Words split at line and page ends (\"Achil-/les\"); joining them wrongly breaks verse lines.",
     "In prose, rejoin; in verse almost never needed. Check pages ending in a hyphen by hand."],
    ["<b>Scan quality</b>", "Low resolution, curved pages near the spine, fingers, bleed-through, skew, missing or doubled pages (common in Google scans).",
     "Look at the page thumbnails before OCR. Missing pages: find a second copy. ScanTailor Advanced can straighten and split pages."],
    ["<b>Invisible encoding differences</b>", "The same letter in different Unicode forms (Greek tonos vs oxia; Arabic presentation forms; decomposed accents); "
     "Latin and Cyrillic look-alikes.", "Normalise to NFC; run " + C("charset.py") + " and read the rarest characters; search must find all forms."],
    ["<b>Wrong catalogue data</b>", "Wrong language, date, translator or resolution (the Arabic Iliad is catalogued as Urdu).",
     "The title page is the source of truth; write it on the work card."],
]
s += [table(rows, [30 * mm, 66 * mm, 74 * mm])]

# ---------------------------------------------------------------- 5 tools
s += [CondPageBreak(60 * mm), P("5. Which software for which job", h2)]
s += [table([
    ["Tool", "Best for", "Limits on this laptop"],
    ["<b>Tesseract 5</b> (tessdata_best models)", "The workhorse: over 100 languages and scripts, including Ancient Greek, Latin, Fraktur, Arabic, Hebrew, Syriac, "
     "Devanagari, Tamil, Tibetan, Ethiopic. Free, fast, predictable.", "None worth mentioning; run 3 pages at once."],
    ["<b>Apple Vision</b> (built into macOS; via " + C("ocrmac") + ")", "Very fast and accurate on clean modern print in the languages Apple supports. On your Mac: Arabic, German, English, "
     "Spanish, French, Italian, Portuguese, Russian, Ukrainian, Chinese, Cantonese, Japanese, Korean, Thai, Vietnamese.", "No Croatian, no Greek of any kind, no historical forms, no Fraktur. "
     "The list depends on the macOS version: " + C("ocr_vision.py --languages") + " shows it."],
    ["<b>Kraken</b>", "Historical print and difficult scripts; models for polytonic Greek and Arabic-script print in its public model repository; "
     "can be trained on your own corrected pages.", "Slower; CPU only. Fine overnight."],
    ["<b>OCRmyPDF</b>", "Makes a searchable PDF from scans (handy for proofreading next to the image).", "Uses Tesseract; a plugin can use Apple Vision."],
    ["<b>Docling</b>", "Modern born-digital PDFs: articles, reports, prose with headings and tables.", "Not for verse, not for archive scans. Skip for now."],
    ["<b>Surya</b>", "Layout and reading order; 90+ languages.", "Heavier; on Apple Silicon older versions need " + C("TORCH_DEVICE=cpu") + ". Optional, later."],
    ["<b>Large AI reading models</b>", "Excellent on hard pages.", "7-billion-parameter models do not fit well in 8 GB; online services cost money and send your scans elsewhere. "
     "If ever used, only for correction suggestions you review, never silently."],
    ["<b>ScanTailor Advanced</b>", "Splitting two-page spreads, straightening, cropping margins.", "Desktop app; use when a scan needs it."],
    ["<b>eScriptorium</b>", "Correcting OCR in the browser and training Kraken models.", "Needs a server; a later step, possibly with a university partner."],
], [38 * mm, 74 * mm, 58 * mm])]
s += [Spacer(1, 4), P("Speeds below are estimates to replace with your own measurements in week 2: Apple Vision about 1 second "
                      "per page; Tesseract 2–6 seconds per page per job (3 jobs at once); Kraken 5–20 seconds per page. "
                      "So one night (8 hours) is roughly 3,000–10,000 Latin-script pages, or 1,500–5,000 pages of a difficult script.", small)]

# ---------------------------------------------------------------- 6 quality
s += [P("6. Measuring quality: the rule that keeps the library trustworthy", h2)]
s += bullets([
    "<b>Character error rate (CER)</b>: the share of characters that are wrong, added or missing. "
    "Measured with " + C("cer.py") + " against 5–10 pages you corrected by hand (the <i>proof pages</i>).",
    "<b>Under 1 %</b>: publish after one read-through, with a visible \"from OCR, lightly corrected\" note. "
    "<b>1–3 %</b>: proofread fully before publishing. <b>Over 5 %</b>: change the engine, settings or scan first.",
    "<b>Choose the engine per book, not per language</b>: the typeface and the scan matter as much as the language.",
    "<b>Structure checks</b> before import: number of books; lines per book compared with the original; no page numbers "
    "or headers left in the text; " + C("charset.py") + " shows no foreign characters.",
    "<b>Record everything on the work card</b>: engine, settings, CER, who proofread which pages.",
])

# ---------------------------------------------------------------- 7 setup
s += [CondPageBreak(70 * mm), P("7. Week 1: setting up (one step per evening)", h2)]
s += [P("<b>Evening 1: prepare the external drive.</b> Open Disk Utility, select the drive, Erase, format "
        "<i>APFS</i>, name <i>Mouseion</i>. (This deletes what is on it: copy anything you need first.) "
        "Keep a second backup copy later, on another drive or a cloud service.")]
s += [P("<b>Evening 2: install the tools.</b> Install Homebrew from brew.sh if you do not have it (one command, shown on that page). Then:")]
s += block("""
cd ~
git clone https://github.com/nduluu/mouseion.git
cd mouseion
git checkout claude/great-hamilton-d1yls8
bash pipeline/setup_mac.sh
""")
s += [P("The setup takes 20–40 minutes and downloads about 2 GB. It ends by printing four version numbers. If one is missing, copy the last 20 lines of output and send them to me.")]
s += [P("<b>Evening 3: create the folders and test.</b> First, once: your Mac’s Terminal (zsh) does not treat " + C("#") + " as a comment unless told to, so a comment pasted with a command can break it. Run " + C("echo 'setopt interactivecomments' >> ~/.zshrc") + " and open a new Terminal window.")]
s += block("""
bash pipeline/make_dirs.sh
~/venvs/mouseion/bin/python pipeline/ocr_vision.py --languages
tesseract --list-langs | head -40
""")
s += [P("The first command shows what Apple Vision can read, the second what Tesseract can read. Write both lists into a note: they decide which engine you can try for each language. On the project MacBook Air M1 (25 November 2026) Vision listed 18: Arabic, German, English, Spanish, French, Italian, Japanese, Korean, Portuguese, Russian, Thai, Ukrainian, Vietnamese, Cantonese and Chinese, but no Croatian and no Greek.")]
s += [P("<b>Evening 4: the work cards.</b> A work card is a small text file, one per book, that remembers everything "
        "about that book: who translated it, why it is public domain, where the scan came from, which OCR engine worked best. "
        "The cards for the three pilot books are already filled in with what is known (" + C("pipeline/cards/") + "). "
        "Copy them to the drive, check them, and turn off TextEdit’s curly quotes, which would break a card when you edit it later:")]
s += block("""
cd ~/mouseion
git pull
cp pipeline/cards/*.yaml /Volumes/Mouseion/cards/
~/venvs/mouseion/bin/python pipeline/check_cards.py
""")
s += [P("Each card should print <i>OK</i> and a list of fields that are still empty. That is correct: they are filled in "
        "later, when you look at the book (week 2). To read a card, " + C("open -e /Volumes/Mouseion/cards/mendes-iliad.yaml") + ". "
        "Before you edit one for the first time: in TextEdit, menu Edit → Substitutions, untick Smart Quotes and Smart Dashes. "
        "Rules when editing: keep the space after each colon, keep the indentation (two spaces), put text in straight quotes "
        "\"…\", and write \"\" for unknown. Run " + C("check_cards.py") + " after every edit.")]
s += [P("<b>Evening 5: a Track A import, to see the whole road once.</b> Polylas's Modern Greek Odyssey from Project Gutenberg. "
        "Send me the four Gutenberg numbers (30613–30616) when you get here and I will extend the importer for Gutenberg "
        "texts. Then the result is checked like any other text: books, lines, characters.")]

# ---------------------------------------------------------------- 8 pilot 1
s += [CondPageBreak(70 * mm), P("8. Week 2: pilot 1, Portuguese 1874 (the basic loop)", h2)]
s += [P("<b>Step 1: download.</b> This scan has no full-quality page images, so take the PDF and the Archive's own OCR text.")]
s += block("""
cd ~/mouseion
bash pipeline/fetch_ia.sh iliadadehomeroe00mendgoog pdf
bash pipeline/fetch_ia.sh iliadadehomeroe00mendgoog txt
""")
s += [P("<b>Step 2: look before you OCR.</b> Open the PDF (Preview, sidebar thumbnails). On the work card note: where book 1 starts "
        "(page number of the file), whether pages are missing or doubled, footnotes, running headers, curved pages. "
        "This 10-minute look prevents most surprises.")]
s += [P("<b>Step 3: pages.</b> Turn the PDF into page images (a few minutes):")]
s += block("""
IN=/Volumes/Mouseion/inbox/iliadadehomeroe00mendgoog
bash pipeline/pages.sh mendes-iliad $IN/iliadadehomeroe00mendgoog.pdf
""")
s += [P("<b>Step 4: OCR a sample of 5 pages with two engines.</b> Pick 5 ordinary pages of verse, e.g. 40–44:")]
s += block("""
bash pipeline/ocr_tesseract.sh mendes-iliad por 4 40-44
~/venvs/mouseion/bin/python pipeline/ocr_vision.py mendes-iliad pt-BR 40-44
""")
s += [P("<b>Step 5: make the proof pages.</b> Copy " + C("ocr/mendes-iliad/tesseract/0040.txt") + " … " + C("0044.txt") + " to "
        + C("proof/mendes-iliad/") + ". Open each next to the page image and correct it exactly: every letter, accent and line break as printed. "
        "Remove the running header and page number. This is about an hour, and it is the most valuable hour of the week.")]
s += [P("<b>Step 6: measure.</b>")]
s += block("""
cd /Volumes/Mouseion
python3 ~/mouseion/pipeline/cer.py --folder proof/mendes-iliad \\
    ocr/mendes-iliad/tesseract ocr/mendes-iliad/vision
""")
s += [P("Also cut the same 5 pages out of the Archive's " + C("_djvu.txt") + " and measure them: if the Archive's OCR is already "
        "under 1 %, you can skip your own OCR for this book. Note all numbers on the work card and choose the engine.")]
s += [P("<b>Step 7: the night run.</b> Put the full job in the queue and start the night:")]
s += block("""
echo 'bash ~/mouseion/pipeline/ocr_tesseract.sh mendes-iliad por 4' \\
    > /Volumes/Mouseion/queue/01-mendes.sh
bash ~/mouseion/pipeline/night.sh
""")
s += [P("<b>Step 8: morning check (15 minutes).</b> Read the last lines of " + C("logs/night-<date>.log") + "; run "
        + C("charset.py ocr/mendes-iliad/tesseract --rare 3") + " and look up each rare character on its page.")]
s += [P("<b>Step 9: structure.</b> Send me the OCR folder (or tell me it is ready, if you push it to the repository). "
        "I will write the importer that removes headers and page numbers, keeps the page breaks for citation, finds the "
        "book divisions, and compares the line counts with the Greek. You then proofread the books where the counts disagree.")]

# ---------------------------------------------------------------- 9 pilots 2,3
s += [CondPageBreak(60 * mm), P("9. Weeks 3–4: pilots 2 and 3", h2)]
s += [P("<b>Croatian 1883.</b> Same loop, but download the full-quality images: " + C("fetch_ia.sh homerova-iliada-1883 jp2") + ", then "
        + C("pages.sh maretic-iliad …/Iliada_jp2.zip") + ". Apple Vision has no Croatian, so compare Tesseract " + C("hrv") + " from the best models with the standard " + C("hrv") + ", and with the Archive’s own OCR. Watch č/ć and đ: "
        "engines confuse them, and a CER of 2 % may hide many wrong names. Confirm the translator on the title page "
        "before anything is published.")]
s += [P("<b>Arabic 1904.</b> The real test. 1.08 GB of images: download overnight. Before OCR, mark on the work card which pages "
        "are introduction, which are verse, and which are commentary: al-Bustānī prints long notes under the verse, and "
        "only the verse goes into the reader at first. Then compare three engines on 5 verse pages:")]
s += block("""
bash pipeline/ocr_tesseract.sh bustani-iliad ara 4 120-124
~/venvs/mouseion/bin/python pipeline/ocr_vision.py bustani-iliad ar-SA 120-124
K=~/venvs/kraken/bin/kraken
$K list | grep -i -E "arab|persian"
$K get <model-id>
$K -i /Volumes/Mouseion/pages/bustani-iliad/0120.png out-0120.txt \\
   segment -bl ocr -m <model-file>
""")
s += [P("Expect higher error rates than in Portuguese, and errors in vowel signs (ḥarakāt). Decide with me whether the first "
        "version keeps all vowel signs (more proofreading) or only those the OCR is sure of. If all engines stay above "
        "5 %, that is a result too: then this book waits for a trained model or for partners who can proofread.")]

# ---------------------------------------------------------------- 10 routine
s += [P("10. The daily routine after the pilots", h2)]
s += [table([
    ["When", "What", "Time"],
    ["Evening", "Pick the next work from the list; search for a transcription (Track A); if none, find the best scan, fill in the "
     "work card, download, make pages, test 5 pages, queue the night job.", "30–45 min"],
    ["Night", C("night.sh") + ": downloads and OCR run unattended.", "0 min"],
    ["Morning", "Read the log; " + C("charset.py") + "; note problems on the card.", "10–15 min"],
    ["Weekend", "Proofread pages; prepare imports; push to the repository; back up the drive.", "2–3 h"],
], [22 * mm, 118 * mm, 30 * mm])]

# ---------------------------------------------------------------- 11 rights
s += [P("11. Rights and terms: check before you download", h2)]
s += bullets([
    "<b>Who must be dead, and for how long</b>: the author of the text you take, which for a translation is the translator; "
    "in most countries 70 years. Mouseion's rights engine handles the per-country rules; the work card records the dates.",
    "<b>Modern editions of old texts</b>: in Italy, a critical or scientific edition of a public-domain work is protected for 20 years "
    "from publication (law 633/1941, art. 85-quater), and other countries have similar rules. Take originals from old editions or "
    "from sources with an open licence.",
    "<b>HathiTrust</b>: \"full view\" can mean public domain in the US only; the rest of the world may be blocked.",
    "<b>Google scans</b> ask for non-commercial use and keeping the Google watermark. Public-domain text does not become protected by "
    "scanning, but Mouseion's paid services (partners, print-on-demand) make this worth a legal check.",
    "<b>Gallica and other national libraries</b> publish their own reuse terms, sometimes distinguishing commercial use. Read them "
    "per library and note them on the work card.",
    "<b>Transcription sites</b>: Wikisource and Perseus texts are CC BY-SA (credit and same licence), Gutenberg asks that its name be "
    "removed if its licence is not kept, Tanzil allows verbatim copies only. Mouseion already credits sources on every page.",
])

# ---------------------------------------------------------------- 12 risks
s += [P("12. What can go wrong, and the safeguard", h2)]
s += [table([
    ["Risk", "Safeguard"],
    ["The drive fails or is lost", "Weekly copy to a second drive or cloud; finished texts are also in the git repository."],
    ["Laptop full or slow", "Everything large lives on the external drive; one heavy job at a time; " + C("night.sh") + " runs jobs one after another."],
    ["Mac goes to sleep at night", C("night.sh") + " keeps it awake while it runs; plugged in, lid open."],
    ["OCR errors reach readers", "The CER rule (section 6) and the visible OCR note; readers can report errors later."],
    ["Wrong edition or translator", "Title page is the source of truth; the work card has a field for it."],
    ["Time runs out", "Track A first in every work; OCR only for languages Mouseion lacks."],
], [55 * mm, 115 * mm])]

# ---------------------------------------------------------------- 13 next
s += [P("13. First checklist", h2)]
s += checks([
    "Format the external drive as APFS, named Mouseion.",
    "Install Homebrew; clone the repository; run " + C("pipeline/setup_mac.sh") + ".",
    "Run " + C("make_dirs.sh") + "; save the two language lists (Vision, Tesseract).",
    "Fill in the three work cards.",
    "Track A: tell me when you are ready for the Polylas Odyssey import.",
    "Pilot 1 (Portuguese): sample, proof pages, CER, night run, morning check.",
    "Send me the CER results and the OCR folder; I write the importer for checked OCR text.",
    "Pilots 2 and 3; then start the daily routine with wave 2.",
])
s += [Spacer(1, 8)]
s += note("Things I could not check from here: the Archive's download servers were not reachable from my environment, so the scan "
          "quality and the Archive's own OCR of the three pilot books are unverified, and the scripts that need macOS "
          + "(" + C("ocr_vision.py") + ", " + C("setup_mac.sh") + ") have not been run on a Mac. If a step fails, send me the error "
          "message and I will fix the script. Speeds and engine choices are starting points to replace with your own measurements.")
s += [P("Sources", h3)]
s += [P("Docling OCR engines: docling-project.github.io/docling/concepts/OCR/ · Apple Vision text recognition: "
        "developer.apple.com/documentation/vision/recognizetextrequest, WWDC 2025 session 272 · OCRmyPDF Apple Vision plugin: "
        "github.com/mkyt/OCRmyPDF-AppleOCR · Surya: pypi.org/project/surya-ocr · Kraken: github.com/mittagessen/kraken, kraken.re · "
        "Kraken models for many scripts (Zenodo record 21788405) · OCR of classical commentaries with polytonic Greek: arXiv 2110.06817 · "
        "Pilot items: archive.org/details/iliadadehomeroe00mendgoog, …/homerova-iliada-1883, …/20221225_20221225_1724 (checked 25 November 2026).", small)]

doc.build(s)
print("written", OUT)
