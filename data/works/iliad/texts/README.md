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
