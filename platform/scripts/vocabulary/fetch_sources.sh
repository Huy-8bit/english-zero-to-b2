#!/usr/bin/env bash
# Download the openly licensed lexical sources used by build_lexicon.py into platform/vocab-sources/ (git-ignored).
# Licences and required attribution: backend/app/vocabulary/data/SOURCES.md
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/vocab-sources"
mkdir -p "$OUT"
cd "$OUT"
curl -fsSL -o cefrj-vocabulary-profile-1.5.csv https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv
for f in NGSL_12_stats.csv NAWL_12_lemmatized_for_teaching.csv; do
  curl -fsSL -A "Mozilla/5.0" -o "$f" "https://www.newgeneralservicelist.com/s/$f"
done
for f in vie/vie_sentences.tsv vie/vie-eng_links.tsv eng/eng_sentences.tsv; do
  curl -fsSL "https://downloads.tatoeba.org/exports/per_language/$f.bz2" | bunzip2 > "$(basename "$f")"
done
# Build the wanted-word list, then stream the kaikki.org English Wiktionary extract (~520 MB gz) through the filter.
python3 -I "$ROOT/scripts/vocabulary/wanted_words.py" "$OUT" > want.txt
curl -fsSL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz | gunzip -c \
  | python3 -I "$ROOT/scripts/vocabulary/wiktionary_filter.py" want.txt wiktionary-slim.jsonl
echo "Sources ready in $OUT. Next: backend/.venv/bin/python scripts/vocabulary/build_lexicon.py"
