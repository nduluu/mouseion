# Mouseion text pipeline (laptop)

Small scripts for collecting public-domain texts on a Mac (Apple Silicon, 8 GB RAM is enough).
The step-by-step guide is `docs/mouseion-pipeline-guide.pdf`.

| Script | What it does |
|---|---|
| `setup_mac.sh` | Installs the tools with Homebrew and creates two Python environments. Run once. |
| `make_dirs.sh` | Creates the folder layout on the external drive. |
| `fetch_ia.sh` | Downloads the page images (or PDF) of an Internet Archive item into the inbox. |
| `pages.sh` | Turns the downloaded JP2 images or a PDF into numbered PNG pages. |
| `ocr_tesseract.sh` | OCR of a folder of pages with Tesseract, 3 pages at a time. |
| `ocr_vision.py` | OCR of a folder of pages with Apple's built-in text recognition (macOS only). |
| `cer.py` | Measures the error rate of an OCR text against a page you corrected by hand. |
| `charset.py` | Lists every character in a text with its count, to catch wrong scripts and stray symbols. |
| `night.sh` | Runs the queued jobs overnight while keeping the Mac awake. |
| `workcard.yaml` | Template: one card per work, recording sources, rights and progress. |
| `cards/` | Ready-made cards for the three pilot books (copy them to the drive). |
| `check_cards.py` | Checks that every card on the drive can be read, and lists the fields still empty. |

Everything writes to the external drive (default `/Volumes/Mouseion`; change it with `export MOUSEION_DRIVE=/Volumes/YourDrive`).
