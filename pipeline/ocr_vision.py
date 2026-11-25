"""OCR of a folder of pages with Apple's built-in text recognition (Vision framework), macOS only.

Usage:
  ~/venvs/mouseion/bin/python pipeline/ocr_vision.py WORK_ID LANG [FIRST-LAST]
  ~/venvs/mouseion/bin/python pipeline/ocr_vision.py --languages     # what this Mac can read

LANG is a locale from the --languages list, such as pt-BR, ar-SA, ru-RU, it-IT, zh-Hans, ja-JP.
Output: $DRIVE/ocr/WORK_ID/vision/0001.txt …, one line of text per recognised line,
ordered top to bottom (right to left is handled by the system for Arabic).

Apple's recogniser is fast and good on clean modern print, but it knows only the languages
the current macOS offers (18 on the project MacBook Air in November 2026: no Croatian,
no Greek) and no historical forms: no polytonic Greek, no Fraktur, no pre-1918 Russian letters. Check the output with cer.py before trusting it.
"""
import os
import sys
import time


def drive():
    return os.environ.get("MOUSEION_DRIVE", "/Volumes/Mouseion")


def list_languages():
    import Vision  # from pyobjc, installed with ocrmac
    req = Vision.VNRecognizeTextRequest.alloc().init()
    req.setRecognitionLevel_(0)  # accurate
    langs, err = req.supportedRecognitionLanguagesAndReturnError_(None)
    print("\n".join(sorted(langs)))


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "--languages":
        return list_languages()
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    from ocrmac import ocrmac

    work, lang = sys.argv[1], sys.argv[2]
    first, last = 1, 10 ** 6
    if len(sys.argv) > 3:
        first, last = (int(x) for x in sys.argv[3].split("-"))
    src = os.path.join(drive(), "pages", work)
    out = os.path.join(drive(), "ocr", work, "vision")
    os.makedirs(out, exist_ok=True)
    pages = sorted(f for f in os.listdir(src) if f.endswith(".png") and first <= int(f[:-4]) <= last)
    t0 = time.time()
    for i, f in enumerate(pages, 1):
        res = ocrmac.OCR(os.path.join(src, f), recognition_level="accurate",
                         language_preference=[lang]).recognize()
        # res: (text, confidence, (x, y, w, h)) with y measured from the bottom of the page.
        lines = sorted(res, key=lambda r: (-round(r[2][1] + r[2][3], 3), r[2][0]))
        with open(os.path.join(out, f[:-4] + ".txt"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(r[0] for r in lines) + "\n")
        print(f"\r{i}/{len(pages)}", end="", flush=True)
    secs = round(time.time() - t0)
    msg = f"{time.strftime('%F %T')} vision {work} {lang}: {len(pages)} pages in {secs}s"
    print("\n" + msg)
    with open(os.path.join(drive(), "logs", "ocr.log"), "a") as fh:
        fh.write(msg + "\n")


if __name__ == "__main__":
    main()
