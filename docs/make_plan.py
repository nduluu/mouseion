# Builds docs/mouseion-plan.pdf (A4, for printing): python3 docs/make_plan.py docs/mouseion-plan.pdf
# Needs reportlab and the Liberation and DejaVu fonts.
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether, PageBreak)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
import sys

OUT = sys.argv[1]
F = "/usr/share/fonts/truetype/"
pdfmetrics.registerFont(TTFont("Serif", F + "liberation/LiberationSerif-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Serif-B", F + "liberation/LiberationSerif-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Serif-I", F + "liberation/LiberationSerif-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Serif-BI", F + "liberation/LiberationSerif-BoldItalic.ttf"))
addMapping("Serif", 0, 0, "Serif"); addMapping("Serif", 1, 0, "Serif-B")
addMapping("Serif", 0, 1, "Serif-I"); addMapping("Serif", 1, 1, "Serif-BI")
pdfmetrics.registerFont(TTFont("Sans", F + "liberation/LiberationSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Sans-B", F + "liberation/LiberationSans-Bold.ttf"))
addMapping("Sans", 0, 0, "Sans"); addMapping("Sans", 1, 0, "Sans-B")
pdfmetrics.registerFont(TTFont("Sym", F + "dejavu/DejaVuSans.ttf"))

INK = colors.HexColor("#1a1a1a")
MUTED = colors.HexColor("#666666")
LINE = colors.HexColor("#cccccc")
TINT = colors.HexColor("#f3f1ec")

body = ParagraphStyle("body", fontName="Serif", fontSize=10.5, leading=14.2, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=9, leading=12, textColor=MUTED)
cell = ParagraphStyle("cell", parent=body, fontSize=9.5, leading=12.4, spaceAfter=0)
cellb = ParagraphStyle("cellb", parent=cell, fontName="Sans-B", fontSize=9)
h1 = ParagraphStyle("h1", fontName="Sans-B", fontSize=22, leading=26, textColor=INK, spaceAfter=4)
sub = ParagraphStyle("sub", fontName="Sans", fontSize=11, leading=15, textColor=MUTED, spaceAfter=14)
h2 = ParagraphStyle("h2", fontName="Sans-B", fontSize=13.5, leading=17, textColor=INK, spaceBefore=12, spaceAfter=6)
h3 = ParagraphStyle("h3", fontName="Sans-B", fontSize=10.5, leading=14, textColor=INK, spaceBefore=6, spaceAfter=3)
bullet = ParagraphStyle("bullet", parent=body, leftIndent=12, bulletIndent=1, spaceAfter=2.5)
check = ParagraphStyle("check", parent=body, leftIndent=17, bulletIndent=0, spaceAfter=3.5,
                       bulletFontName="Sym", bulletFontSize=11)

BOX = "☐"
DONE = "☑"


def P(t, s=body):
    return Paragraph(t, s)


def bullets(items, s=bullet):
    return [Paragraph(t, s, bulletText="•") for t in items]


def checks(items):
    out = []
    for t in items:
        done = t.startswith("DONE ")
        out.append(Paragraph(t[5:] if done else t, check, bulletText=DONE if done else BOX))
    return out


def table(rows, widths, head=True, zebra=False):
    data = [[P(c, cellb if (head and i == 0) else cell) for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    st = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    if head:
        st += [("BACKGROUND", (0, 0), (-1, 0), TINT), ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK)]
    t.setStyle(TableStyle(st))
    return t


def note_box(text):
    t = Table([[P(text, cell)]], colWidths=[170 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), TINT), ("BOX", (0, 0), (-1, -1), 0.4, LINE),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                           ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return t


def on_page(c, doc):
    c.saveState()
    c.setFont("Sans", 8)
    c.setFillColor(MUTED)
    c.drawString(20 * mm, 12 * mm, "Mouseion — plan for going online · 24 November 2026")
    c.drawRightString(190 * mm, 12 * mm, "Page %d" % doc.page)
    c.setStrokeColor(LINE)
    c.line(20 * mm, 16 * mm, 190 * mm, 16 * mm)
    c.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=22 * mm,
                      title="Mouseion — plan for going online", author="Mouseion project",
                      subject="Costs, structure, operation and next steps")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=on_page)])

s = []
s += [P("Mouseion", h1), P("Plan for going online: costs, structure, funding, operation and next steps · 24 November 2026", sub)]

s += [P("In short", h2)]
s += bullets([
    "<b>Hosting stays cheap, even at full size.</b> About $0–5 a month at launch, $10–40 when the "
    "collection reaches some 10,000 works, and roughly $100–400 a month for “all of the public domain” "
    "with millions of visitors. The domain costs about $10–25 a year.",
    "<b>The real costs are people and advice:</b> legal advice on the public-domain rules and terms of use (a one-off "
    "cost in the thousands), proofreading and digitising, and the time to run the project.",
    "<b>Keep the site static.</b> Ready-made files served from a content delivery network (CDN) are the cheapest, "
    "fastest and most robust design, and the one Mouseion already uses.",
    "<b>Plain web addresses, split language and catalogue files are done</b>; the interface is fully translated "
    "into 137 of 170 languages. Before launch: settle how texts are versioned and let the host tell the site the visitor’s country.",
    "<b>Money without ads is realistic, but modest at first:</b> grants and institutional partners are the main "
    "sources; donations, “adopt a text” sponsorship, print-on-demand books and course packs add to them. Paying only "
    "to be linked is weak as a product on its own; selling a partnership with useful services works better (section 4).",
    "<b>Check the name first.</b> “Mouseion” is already the title of a classics journal (Classical Association "
    "of Canada), and Museion is the museum of contemporary art in Bolzano. Confirm with a lawyer and the trademark "
    "registers (UIBM, EUIPO) before buying a domain.",
])

s += [P("1. What it would cost", h2)]
s += [table([
    ["Stage", "Collection", "Visitors / month", "Cost / month"],
    ["Launch", "Homer and a few hundred works; under 10 GB", "up to ~50,000", "<b>$0–5</b> (free hosting tiers; domain only)"],
    ["Growing", "about 10,000 works; 50–100 GB", "a few hundred thousand", "<b>$10–40</b>"],
    ["“All of the public domain”", "about 1 million editions; around 1 TB of text", "millions", "<b>$100–400</b>"],
], [32 * mm, 58 * mm, 32 * mm, 48 * mm])]
s += [Spacer(1, 6), P("<b>Why it stays cheap</b>", h3)]
s += bullets([
    "<b>Text, not scans.</b> A book is about 0.5–1 MB as text. The scans stay at Wikisource, the Deutsches "
    "Textarchiv and the Internet Archive, and Mouseion links to them. One million editions is roughly 1 TB: about "
    "$15–20 a month in cloud storage (e.g. Cloudflare R2).",
    "<b>No server work per visit.</b> Visitors receive ready-made files. Choose a host that does not charge for "
    "traffic (Cloudflare: free; Bunny CDN: about $0.01 per GB). Netlify and Vercel get expensive at large scale.",
    "<b>Search is the largest later item.</b> Searching inside a million books needs either an index split into "
    "small files (cheap) or a small search server ($20–150 a month).",
])
s += [P("<b>One-off and yearly costs</b>", h3)]
s += [table([
    ["Item", "Estimate", "Note"],
    ["Domain name (.org or .com)", "$10–25 / year", "Some country domains cost more."],
    ["Legal advice", "a few thousand, once; then occasional reviews",
     "Public-domain rules by country, terms of use, takedown process, privacy."],
    ["Legal entity (association or foundation)", "varies by country", "Limits personal liability; allows donations and grants."],
    ["Backup copy at a second provider", "about $6 per TB / month", "e.g. Backblaze B2; plus a free deposit at the Internet Archive or Zenodo."],
    ["Visitor statistics without tracking", "$0–9 / month", "Cloudflare Web Analytics (free) or Plausible."],
    ["Accounts (only if wanted later)", "$0–25 / month", "e.g. Supabase. Postpone: accounts bring personal data and duties."],
], [52 * mm, 44 * mm, 74 * mm])]
s += [Spacer(1, 4), P("Prices are typical figures as of late 2026 and change often; check them before committing.", small)]

s += [P("2. How the website is built", h2)]
s += [P("Mouseion is a static website: it has no database or program running on a server. An automatic build step "
        "turns the master data into ready-made files; those are stored behind a CDN, which serves them from "
        "a location near each visitor. This is how Project Gutenberg and many digital libraries work.")]
flow = Table([[P("<b>Master data</b><br/>texts (TEI XML) and records", cell), P("→", cell),
               P("<b>Build</b><br/>GitHub Actions, automatic and free for a public repository", cell), P("→", cell),
               P("<b>Storage + CDN</b><br/>e.g. Cloudflare Pages / R2", cell), P("→", cell),
               P("<b>Visitor</b><br/>browser on any device", cell)]],
             colWidths=[37 * mm, 6 * mm, 42 * mm, 6 * mm, 36 * mm, 6 * mm, 37 * mm])
flow.setStyle(TableStyle([("BOX", (0, 0), (0, 0), 0.5, LINE), ("BOX", (2, 0), (2, 0), 0.5, LINE),
                          ("BOX", (4, 0), (4, 0), 0.5, LINE), ("BOX", (6, 0), (6, 0), 0.5, LINE),
                          ("BACKGROUND", (0, 0), (0, 0), TINT), ("BACKGROUND", (2, 0), (2, 0), TINT),
                          ("BACKGROUND", (4, 0), (4, 0), TINT), ("BACKGROUND", (6, 0), (6, 0), TINT),
                          ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 6),
                          ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
s += [flow, Spacer(1, 8)]
s += [table([
    ["Part", "Now", "As the collection grows"],
    ["Code and records (who wrote what, editions, dates, rights)", "GitHub repository", "Stays on GitHub."],
    ["Texts", "JSON files in the repository", "Cloud storage once over a few GB, with a list of every file and its checksum "
     "(a fingerprint that shows whether a file changed). A git repository cannot hold a terabyte."],
    ["Master copy of each text", "the JSON files plus the source notes", "TEI XML (the scholarly standard) with full metadata; "
     "the website files are generated from it."],
    ["Search", "one catalogue file read by the browser", "an index split into small files; a small search server only if needed."],
    ["Backups", "GitHub", "a second provider plus an archived copy (Internet Archive or Zenodo), so the project outlives any one company or person."],
], [50 * mm, 40 * mm, 80 * mm])]

s += [P("3. Before launch: changes to the website", h2)]
s += checks([
    "DONE <b>Plain web addresses</b> instead of “#”: mouseion.org/iliad/ita-monti/1/7-10 (lines), "
    "/iliad/fra-leconte/1/p5 (printed page). Google can index them and citations stay clean. Old links still work.",
    "<b>Links that never break, and versioned texts.</b> A link to “Iliad 1.7” must still work in 20 years. "
    "When a text is corrected, keep the old version available and let a reference name the version it cites.",
    "DONE <b>Language files split:</b> one small file per language, loaded only when needed.",
    "DONE <b>Catalogue split</b> into small files per work, author, subject and search prefix.",
    "<b>Country from the host:</b> Cloudflare can tell the site the visitor’s country, so the public-domain rules "
    "start out right. The visitor can still change it.",
    "<b>Server setting:</b> every page address must be answered with index.html. Cloudflare Pages does this "
    "automatically when the site has no 404.html; the local test server already does it.",
    "<b>Master copies and metadata:</b> a metadata file per text folder, the TEI master copy, and the original sources archived.",
    "<b>Accounts:</b> postpone. Launch without sign-in.",
])


s += [P("4. Funding without advertising", h2)]
s += [P("The texts stay free for everyone: no paywall and no ads. Money comes from people and institutions who value "
        "what Mouseion does, and from services and products built around the free texts. The costs to cover are small "
        "(section 1); the aim is to pay for legal advice, proofreading and, later, some of the work time.")]
s += [P("<b>Your idea: institutions pay to be linked</b>", h3)]
s += [P("Feasible, but not in the form “pay and we link to you”. Three problems with that form:")]
s += bullets([
    "<b>Mouseion should link to the best source anyway.</b> Readers need the manuscript scan at the Biblioteca "
    "Marciana or the edition at a university whether or not the library pays. If links can be bought, readers stop "
    "trusting them, and paid links count as advertising: they would have to be labelled as such.",
    "<b>Institutions rarely have a budget line for outbound links.</b> Their money comes from grants and comes with "
    "reporting duties, so they pay for things they can show in a report: visits, use in teaching, data, visibility.",
    "<b>Search engines</b> penalise paid links that are not marked as sponsored.",
])
s += [P("<b>A better version: a partner programme.</b> Linking stays free and editorial: Mouseion links to every "
        "relevant scan, edition and museum object it knows of. Institutions that want more become partners for a "
        "yearly fee (for example €250–2,000, depending on size) and receive services:")]
s += bullets([
    "<b>A yearly report</b> of how many readers went from Mouseion to their collection, and from which texts: "
    "evidence they can put in their own grant reports.",
    "<b>A partner page and a collection</b> on Mouseion (e.g. “The Iliad in the Marciana manuscripts”), credited "
    "as a partner, not as an advertiser.",
    "<b>Links back the other way:</b> a small widget or link format so their catalogue can show “read this text "
    "on Mouseion”, with stable citable addresses.",
    "<b>Priority digitisation:</b> texts they care about are added, proofread and linked to their scans first.",
    "<b>Data:</b> clean exports of the records that concern them (editions, translations, manuscript links).",
])
s += [P("Models that work this way: arXiv (universities pay a yearly membership; papers stay free), OpenEdition "
        "(free texts, paid services for libraries) and Europeana’s partner network. Start with three to five "
        "friendly institutions (your cousin’s department, a local library, a museum with manuscripts) and ask what "
        "they would value before fixing prices.")]
s += [P("<b>Other sources</b>", h3)]
s += [table([
    ["Source", "How it works", "Realistic size", "Needs"],
    ["Grants", "Italian banking foundations (e.g. Cariplo, Compagnia di San Paolo, CRT), Regions, PNRR culture "
     "calls, EU Creative Europe / Horizon digital-humanities calls, DARIAH and CLARIN projects",
     "€5,000–100,000 per project", "Legal entity, a clear project plan, often a university partner; time to write applications"],
    ["Donations", "A yearly appeal on the site (like Wikipedia’s, short and once a year); bank transfer, PayPal, Liberapay",
     "a few hundred to a few thousand € a year at first", "Legal entity for receipts; tax benefits for donors once registered as ETS"],
    ["5 per mille", "Italian taxpayers can give 0.5 % of their income tax to a registered third-sector body at no cost to themselves",
     "small at first, grows with readers", "ETS registration (RUNTS)"],
    ["“Adopt a text”", "A person or institution pays for the digitisation and proofreading of one work and is named in its colophon "
     "(“digitised with the support of …”); also suits crowdfunding for scans that do not exist yet",
     "€50–2,000 per text", "A list of wanted texts with costs"],
    ["Print-on-demand books", "Well-typeset parallel editions (e.g. Greek with Monti side by side) sold through Amazon KDP or Lulu; "
     "no stock, no up-front cost", "a few € per copy", "Credit the sources; texts from CC BY-SA sources stay under that licence"],
    ["Course packs", "Teachers choose passages; Mouseion produces a printable, citable reader for the class (free online, "
     "paid as a service for schools and universities)", "€100–500 per course or a yearly school fee", "Some layout work per order"],
    ["Friends of Mouseion", "Optional yearly support (e.g. €20–50) with small thanks: name in the supporters list, early access "
     "to new features. Never lock texts behind it.", "depends on readership", "Accounts or a simple supporter list"],
], [30 * mm, 66 * mm, 32 * mm, 42 * mm])]
s += [Spacer(1, 6), P("<b>What to avoid</b>", h3)]
s += bullets([
    "Ads and tracking: they conflict with the purpose and with privacy law, and earn little on a site this size.",
    "Charging for the texts themselves: public-domain texts are free elsewhere, and CC BY-SA sources must stay open.",
    "Unlabelled sponsored links or affiliate links to booksellers: if they are used at all, mark them clearly.",
])
s += [P("<b>Legal form in Italy and paid activity</b>", h3)]
s += [P("An association that registers as an ETS (Codice del Terzo Settore, D.Lgs. 117/2017) can receive donations, "
        "5 per mille and most grants. It may also sell services such as partner fees, books and course packs as "
        "secondary activities (“attività diverse”, art. 6), within limits on how large they may be compared with the "
        "main activity. Above those limits, a social enterprise (impresa sociale) or a small company alongside the "
        "association is the usual solution. Your father can check which fits; ask him in particular about VAT on "
        "partner fees and book sales.", )]
s += [P("<b>A realistic picture:</b> in the first year, a few hundred to a few thousand euros from donations and "
        "first partners. Real money (tens of thousands) comes from grants, usually from the second year, once there is "
        "a legal entity, a working site and a partner institution. That is enough to cover the costs in section 1 and "
        "pay for proofreading, but not yet a salary.")]

s += [P("5. Running it as a project", h2)]
s += bullets([
    "<b>Legal entity:</b> a nonprofit association or foundation protects you from personal liability and makes donations and grants possible. "
    "In Italy: an association, later registered as an ETS (third-sector body, RUNTS register); see section 4.",
    "<b>Legal pages:</b> terms of use, privacy policy, a published process for takedown requests, and an imprint (a page naming who runs the site) "
    "where the law requires one, e.g. in Germany or Austria.",
    "<b>Public-domain rules:</b> the per-country rules in the site are simplified; a lawyer must review them before launch, as the site already says.",
    "<b>Licences:</b> texts from Wikisource, Perseus and the Deutsches Textarchiv are CC BY-SA 4.0 and must be credited, as Mouseion does on every page and download.",
    "<b>No tracking:</b> collect no personal data; use privacy-friendly statistics.",
    "<b>Funding and partners:</b> see section 4.",
])

s += [P("6. Going live on Cloudflare Pages, step by step", h2)]
s += [P("Once the name is settled. The site needs no build step yet, so the setup is short.")]
s += checks([
    "Buy the domain (Cloudflare itself sells domains at cost, which keeps everything in one account).",
    "Create a free Cloudflare account.",
    "Workers &amp; Pages → Create → Pages → connect the GitHub repository <i>nduluu/mouseion</i>; production branch: the one you publish from.",
    "Build settings: no framework, no build command, output directory “/”.",
    "Custom domains → add your domain. Cloudflare sets up the address and the secure https connection.",
    "Test: open a deep address such as /iliad/ita-monti/1/7-10 directly, use Back and Forward, try Cite, Download and printing.",
    "Turn on Cloudflare Web Analytics if you want visitor numbers without tracking.",
    "From then on, every change pushed to that branch goes live within about a minute.",
])

s += [P("7. Steps in order", h2)]
phases = [
    ("Now", ["Check the name (journal “Mouseion”, trademark registers); choose the final name.",
             "Decide on a legal form and the country it is based in.",
             "Find a lawyer for the public-domain rules and the legal pages."]),
    ("Prepare (website)", ["DONE Plain web addresses.",
                           "DONE Split language and catalogue files.",
                           "Text versions and permanent-link policy.",
                           "Metadata file and TEI master copy per text; archive the sources.",
                           "Interface text: 137 of 170 languages done; finish the rest and have native speakers review them."]),
    ("Launch", ["Buy the domain; set up Cloudflare Pages as in section 6.",
                "Publish terms of use, privacy policy, imprint and takedown process.",
                "Deposit a first archived copy (Internet Archive or Zenodo)."]),
    ("Grow", ["More works with the import tools and the Mac workflow; proofreading.",
              "Search index split into small files; a search server only if needed.",
              "First grant applications; approach the first five partner institutions (section 4).",
              "Print-on-demand editions and course packs; yearly donation appeal."]),
]
for name, items in phases:
    s += [KeepTogether([P(name, h3)] + checks(items))]

s += [P("8. Questions to decide", h2)]
s += bullets([
    "Final name and domain?",
    "Which country will the project be based in, and as what kind of organisation?",
    "Who reviews the public-domain rules, and for which countries first?",
    "Will Mouseion ever have accounts, or stay without sign-in?",
    "Which partner services to offer first, and at what price?",
    "Which grant to apply for first, and who writes the application?",
    "Which works and languages come next?",
])
s += [Spacer(1, 10), note_box("This plan reflects the state of the project on 24 November 2026 (branch "
                              "claude/great-hamilton-d1yls8). Cost figures are estimates; the legal points are not legal advice.")]

doc.build(s)
print("written", OUT)
