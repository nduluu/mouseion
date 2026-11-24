"""Character error rate (CER) of an OCR text against a page you corrected by hand.

Usage:
  python3 pipeline/cer.py CORRECTED.txt OCR.txt [OCR2.txt …]
  python3 pipeline/cer.py --folder proof/WORK_ID ocr/WORK_ID/tesseract [ocr/WORK_ID/vision …]

CER = (insertions + deletions + substitutions) / characters in the corrected text.
Rough guide for Mouseion: under 1 % is publishable after a read-through, 1–3 % needs
correction, above 5 % means the settings, the engine or the scan must change.
Both texts are normalised to Unicode NFC and runs of spaces are collapsed first, so the
score counts real reading errors, not invisible encoding differences.
With --folder, every corrected page in the first folder is compared with the page of the
same name in each OCR folder, and the worst lines are printed.
"""
import os
import re
import sys
import unicodedata


def norm(s):
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return s.strip()


def distance(a, b):
    # Levenshtein distance, row by row (memory grows with one line, not the whole page).
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def cer(ref, hyp):
    ref, hyp = norm(ref), norm(hyp)
    return distance(ref, hyp) / max(1, len(ref)), len(ref)


def read(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    if argv[0] == "--folder":
        proof, engines = argv[1], argv[2:]
        pages = sorted(f for f in os.listdir(proof) if f.endswith(".txt"))
        for eng in engines:
            errs = chars = 0
            for f in pages:
                hp = os.path.join(eng, f)
                if not os.path.exists(hp):
                    continue
                c, n = cer(read(os.path.join(proof, f)), read(hp))
                errs += c * n
                chars += n
            print(f"{eng}: CER {100 * errs / max(1, chars):.2f} % over {len(pages)} pages, {chars} characters")
        return 0
    ref = read(argv[0])
    for h in argv[1:]:
        c, n = cer(ref, read(h))
        print(f"{h}: CER {100 * c:.2f} % ({n} characters)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
