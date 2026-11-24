"""Lists every character in a text (or a folder of .txt files) with its count and Unicode name.

Usage:
  python3 pipeline/charset.py FILE_OR_FOLDER [--rare 5]

Why: OCR errors often show up as characters that do not belong to the language: Latin
'o' inside Greek words, Cyrillic 'а' inside Latin ones, Arabic presentation forms
(U+FB50–U+FDFF, U+FE70–U+FEFF) instead of normal letters, Greek tonos and oxia mixed,
stray symbols such as ¬ ■ ~. Read the list from the bottom (the rarest characters):
that is where the mistakes are. --rare N prints only characters seen at most N times.
"""
import collections
import os
import sys
import unicodedata


def texts(path):
    if os.path.isdir(path):
        for f in sorted(os.listdir(path)):
            if f.endswith(".txt"):
                with open(os.path.join(path, f), encoding="utf-8") as fh:
                    yield fh.read()
    else:
        with open(path, encoding="utf-8") as fh:
            yield fh.read()


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    rare = None
    if "--rare" in argv:
        rare = int(argv[argv.index("--rare") + 1])
    count = collections.Counter()
    for t in texts(argv[0]):
        count.update(unicodedata.normalize("NFC", t))
    for ch, n in count.most_common():
        if ch in "\n\r\t ":
            continue
        if rare is not None and n > rare:
            continue
        name = unicodedata.name(ch, "?")
        warn = ""
        cp = ord(ch)
        if 0xFB50 <= cp <= 0xFDFF or 0xFE70 <= cp <= 0xFEFF:
            warn = "  <- presentation form: normalise"
        elif 0x1F70 <= cp <= 0x1F7D:
            warn = "  <- Greek oxia: NFC turns it into tonos"
        print(f"{n:8d}  U+{cp:04X}  {ch}  {name}{warn}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
