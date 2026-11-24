# Odyssey texts

| Folder | Edition | Source | Licence |
| --- | --- | --- | --- |
| `grc-murray/` | Greek text, ed. A. T. Murray, Loeb Classical Library 1919 | [Perseus `tlg0012.tlg002.perseus-grc2.xml`](https://github.com/PerseusDL/canonical-greekLit/blob/master/data/tlg0012/tlg002/tlg0012.tlg002.perseus-grc2.xml) | CC BY-SA 4.0 |
| `eng-murray/` | The Odyssey, trans. A. T. Murray, 1919 | [Perseus `tlg0012.tlg002.perseus-eng3.xml`](https://github.com/PerseusDL/canonical-greekLit/blob/master/data/tlg0012/tlg002/tlg0012.tlg002.perseus-eng3.xml) | CC BY-SA 4.0 |
| `deu-voss/` | Homers Odüßee, trans. Johann Heinrich Voß, Hamburg 1781 (original spelling) | [Deutsches Textarchiv](https://www.deutschestextarchiv.de/book/show/voss_oduessee_1781), Berlin-Brandenburgische Akademie der Wissenschaften | CC BY-SA 4.0 |

All files here are adaptations (converted with `tools/import_perseus.py` and
`tools/import_dta.py`) shared under CC BY-SA 4.0. Voss's lines are numbered by
the margin numbers printed in his edition, which follow the Greek line numbers.

Voss's files also record the pages of the printed 1781 edition:
`"pages": [[first line, printed page, scan image], …]`, taken from the DTA's
`<pb n="…" facs="#f…"/>` page breaks. Unnumbered pages keep the DTA's square
brackets (`"[9]"`). The scan image number opens that page on the DTA site
(`work.json` → `text.pages.scan`), so a citation by page can be checked against
the original print.
