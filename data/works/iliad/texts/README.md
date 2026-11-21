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

Wikisource transcriptions are licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/);
these folders are adaptations (converted with `tools/import_wikisource.py`; notes,
page numbers and editors' summaries removed) shared under the same licence.
Alignment: Segalá by passage (it prints the Greek line numbers), Gnedich by line,
Monti and Leconte de Lisle by book only.
