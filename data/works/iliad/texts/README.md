# Iliad texts

| Folder | Edition | Source |
| --- | --- | --- |
| `grc-monro-allen/` | Homeri Opera, ed. D. B. Monro & T. W. Allen, Oxford 1908–1920 | [Perseus `tlg0012.tlg001.perseus-grc2.xml`](https://github.com/PerseusDL/canonical-greekLit/blob/master/data/tlg0012/tlg001/tlg0012.tlg001.perseus-grc2.xml) |
| `eng-murray/` | The Iliad, trans. A. T. Murray, Loeb Classical Library, London/New York 1924–1925 | [Perseus `tlg0012.tlg001.perseus-eng3.xml`](https://github.com/PerseusDL/canonical-greekLit/blob/master/data/tlg0012/tlg001/tlg0012.tlg001.perseus-eng3.xml) |

The digital texts come from the **Perseus Digital Library** (Trustees of Tufts
University, https://www.perseus.tufts.edu/) and are licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The files in
these folders are adaptations (converted to JSON with `tools/import_perseus.py`;
Loeb footnotes removed, lines editors bracket shown in `[ ]`) and are shared
under the same licence. Perseus asks that corrections be offered back to them.

Each book is one file (`01.json` … `24.json`):

- verse: `{"book": 1, "lines": [[1, "μῆνιν ἄειδε θεὰ …"], …]}`
- prose: `{"book": 1, "passages": [{"from": 1, "text": "…"}, …]}`: `from` is the
  Greek line the passage starts at, which lines the translation up with the original.

## Translations from Wikisource

| Folder | Translation | Source |
| --- | --- | --- |
| `spa-segala/` | La Ilíada, trans. Luis Segalá y Estalella, Barcelona 1908 | [es.wikisource](https://es.wikisource.org/wiki/La_Il%C3%ADada_(Luis_Segal%C3%A1_y_Estalella)) |
| `rus-gnedich/` | Илиада, trans. Н. И. Гнедич (1829), from the Moscow 1978 edition | [ru.wikisource](https://ru.wikisource.org/wiki/%D0%98%D0%BB%D0%B8%D0%B0%D0%B4%D0%B0_(%D0%93%D0%BE%D0%BC%D0%B5%D1%80;_%D0%93%D0%BD%D0%B5%D0%B4%D0%B8%D1%87)) |
| `ita-monti/` | Iliade, trans. Vincenzo Monti, 4th edition revised by the translator, 1825 | [it.wikisource](https://it.wikisource.org/wiki/Iliade_(Monti)) |
| `fra-leconte/` | Iliade, trans. Leconte de Lisle, Paris 1866 (Lemerre) | [fr.wikisource](https://fr.wikisource.org/wiki/Iliade_(trad._Leconte_de_Lisle)) |
| `cat-roure/` | Iliada, trans. Conrad Roure, Barcelona 1879 (prose) | [ca.wikisource](https://ca.wikisource.org/wiki/Iliada), via Wikimedia's HTML dump |

Wikisource transcriptions are licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/);
these folders are adaptations (converted with `tools/import_wikisource.py`; notes
and editors' summaries removed) shared under the same licence.

Monti's files record the pages of the printed edition the transcription was
made from (Milano, Società Tipografica de' Classici Italiani, 1825, 4th edition,
2 vols.): `"pages": [[first line, printed page, scan image, volume], …]`.
Books 1–12 are in vol. I (pp. 1–311), books 13–24 in vol. II (pp. 1–323).
The scan image number opens that page on it.wikisource
(`work.json` → `text.pages.scan`).

The prose translations record their printed pages per passage:
`"pages": [[character offset in the passage text, printed page, scan image], …]`,
a break that splits a word being moved to the end of that word.
Leconte de Lisle: Paris, Lemerre, 1866, pp. 1–465. Segalá: Barcelona, Montaner
y Simón, 1908, pp. 9–391 (full-page illustrations have no text, so no mark;
the Wikisource transcription is not yet proofread). Roure: Barcelona 1879,
pp. 3–335 (the page a book opens on is worked out from the next page, as its
marker carries an anchor instead of a number).

Gnedich's transcription on ru.wikisource is not linked to scans, so it has no
page numbers.
Alignment: Segalá by passage (it prints the Greek line numbers), Gnedich by line,
Monti, Leconte de Lisle and Roure by book only.
