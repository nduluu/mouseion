"""Checks the work cards on the drive: can each one be read, and what is still empty?

Usage:
  ~/venvs/mouseion/bin/python pipeline/check_cards.py

For every card in $DRIVE/cards it prints either OK with the list of fields still empty,
or the line where the card is broken (usually a missing space after a colon, a
wrong indent, or curly quotes “ ” instead of straight quotes ").
"""
import os
import sys

import yaml

DRIVE = os.environ.get("MOUSEION_DRIVE", "/Volumes/Mouseion")
FOLDER = os.path.join(DRIVE, "cards")
NEEDED = ["id", "work", "kind", "language", "script", "title", "rights", "sources", "status"]


def empty_fields(d, prefix=""):
    out = []
    for k, v in d.items():
        name = prefix + str(k)
        if isinstance(v, dict):
            out += empty_fields(v, name + ".")
        elif v in ("", None):
            out.append(name)
    return out


def main():
    if not os.path.isdir(FOLDER):
        print("No cards folder at", FOLDER, "(is the drive plugged in?)")
        return 1
    cards = sorted(f for f in os.listdir(FOLDER) if f.endswith(".yaml"))
    if not cards:
        print("No cards yet in", FOLDER)
        return 1
    bad = 0
    for f in cards:
        path = os.path.join(FOLDER, f)
        text = open(path, encoding="utf-8").read()
        if "“" in text or "”" in text:
            print(f"{f}: has curly quotes “ ” — replace them with straight quotes \"")
            bad += 1
            continue
        try:
            d = yaml.safe_load(text)
        except yaml.YAMLError as e:
            mark = getattr(e, "problem_mark", None)
            where = f" near line {mark.line + 1}" if mark else ""
            print(f"{f}: cannot be read{where}: {getattr(e, 'problem', e)}")
            bad += 1
            continue
        if not isinstance(d, dict):
            print(f"{f}: not a card: every line must look like  name: value  (with a space after the colon)")
            bad += 1
            continue
        missing = [k for k in NEEDED if k not in d]
        if missing:
            print(f"{f}: missing fields: {', '.join(missing)}")
            bad += 1
            continue
        if d["id"] + ".yaml" != f:
            print(f"{f}: the id inside ({d['id']}) does not match the file name")
            bad += 1
            continue
        todo = empty_fields(d)
        print(f"{f}: OK. Still empty: {', '.join(todo) if todo else 'nothing'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
