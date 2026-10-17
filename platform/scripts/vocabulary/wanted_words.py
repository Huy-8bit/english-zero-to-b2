"""Print the headwords to extract from Wiktionary: CEFR-J + NGSL + NAWL + curriculum vocabulary tables."""
import csv
import re
import sys
from pathlib import Path

src = Path(sys.argv[1])
root = Path(__file__).resolve().parents[3]
ws = set()
for r in csv.DictReader(open(src / "cefrj-vocabulary-profile-1.5.csv", encoding="utf-8")):
    ws.update(h.strip().lower() for h in r["headword"].split("/"))
for r in csv.DictReader(open(src / "NGSL_12_stats.csv", encoding="utf-8")):
    ws.add(r["Lemma"].strip().lower())
for line in open(src / "NAWL_12_lemmatized_for_teaching.csv", encoding="latin-1"):
    if not line.startswith("#"):
        ws.add(line.split(",")[0].strip().lower())
for md in (root / "07-VOCABULARY").glob("VOC-*.md"):
    for line in md.read_text(encoding="utf-8").splitlines():
        if line.startswith("| ") and not line.startswith("|---"):
            cell = re.sub(r"[*_`]|\(.*?\)", "", line.split("|")[1]).split("/")[0].strip().lower()
            if cell and len(cell) < 40:
                ws.add(cell)
print("\n".join(sorted(w for w in ws if w)))
