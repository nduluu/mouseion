# Adding works and texts to Mouseion

Mouseion keeps its own copy of every text it shows. Texts come from open
collections; this is the workflow and the tools for each step. All tools are
plain Python 3 (no packages to install) and are run from the repository root.

## 1. Discover what exists: Wikidata

Wikidata (CC0) records, for most well-known works, their editions and
translations, with language, translator, dates and links to digital texts.

1. Add the work's Wikidata id to its record, e.g. `"wikidata": "Q8275"` in
   `data/works/iliad/work.json`.
2. Run `python3 -I tools/discover.py iliad`.
   It writes `data/discovery/iliad.md`: translations already in Mouseion,
   translations not yet in Mouseion (with where a digital text exists:
   Wikisource, Project Gutenberg, Internet Archive), and editions in the
   original language for the stemma.
3. Run it again with `--apply` to add the new translations to the record.
   They are marked `"needsReview": true` and shown in the menus as “from
   Wikidata, not yet reviewed”. Check each against a library catalogue
   (title, first publication, translator's death date), fix what's wrong and
   remove `needsReview`. Wikidata is often right but not always: it can date a
   later printing, or give the wrong language.
4. Editions in the original language are **not** added automatically: placing
   them in the stemma is a scholar's decision.

## 2. Get the texts in bulk

| Source | Tool | How it is fetched |
| --- | --- | --- |
| Wikisource (any language) | `tools/wikisource_dump.py fetch <lang>`, then `tools/import_wikisource.py` | One download of the whole language (Wikimedia's rendered HTML dump), read locally; pages missing from the dump are fetched live, politely. |
| Perseus Digital Library (Greek, Latin, English) | `tools/import_perseus.py` | `git clone` of PerseusDL repositories. |
| Deutsches Textarchiv (historical German) | `tools/import_dta.py` | The DTA's official corpus downloads (`/download`), TEI. |
| Project Gutenberg | (to do) | Gutenberg's catalogue file and mirrors, not its website. |

Rendered dumps are snapshots (the newest Wikisource run is listed by
`tools/wikisource_dump.py runs`). Live requests from cloud machines are
rate-limited by Wikimedia; the dumps avoid that.

To import a Wikisource translation, add an entry to `SOURCES` in
`tools/import_wikisource.py` (host, page name of each book, format) and run
`python3 -I tools/import_wikisource.py <name>`. Formats:

- `verse`: poems; lines numbered in the translation's own count, checked
  against the line numbers printed in the source.
- `prose`: paragraphs that carry the original's line numbers (aligned by passage).
- `plain`: paragraphs without line numbers (shown book by book).

Then connect the text in the work's record (`"text": {"path": …, "format": …,
"align": "lines" | "passages" | "book", "source": …, "sourceUrl": …}`) and run
`python3 -I tools/build_catalog.py`.

## 3. Check before committing

- Line counts against the original (the import tools print them; books that
  differ get a `lineCounts` note the reader shows).
- The first and last lines of a few books.
- The source edition (which printing the digital text reproduces) in the
  work's record and in the texts' `README.md`.
- Licences: Wikisource, Perseus and the DTA are CC BY-SA 4.0: credit them
  (the reader shows each text's source) and share the converted files under
  the same licence.
