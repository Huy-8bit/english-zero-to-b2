"""Build the published vocabulary lexicon from the curriculum + openly licensed lexical sources.

Pipeline (offline, deterministic, re-runnable):
  Discover   curriculum VOC tables / other vocabulary tables, CEFR-J 1.5, NGSL 1.2, NAWL 1.2
  Generate   dictionary enrichment: Wiktionary (kaikki.org extract) senses, Vietnamese translations, IPA, forms,
             derived terms; Tatoeba English–Vietnamese sentence pairs as examples
  Normalize  lemma keys, POS codes, IPA notation (ɹ → r), Vietnamese text cleanup
  Validate   every published entry needs a Vietnamese meaning; IPA must come from a dictionary (curriculum IPA is
             checked against Wiktionary); examples must contain the word
  Deduplicate one entry per lemma (POS variants become senses); spelling variants merged
  Review     status: curriculum | sourced | needs_review | pending (not published)
  Store      writes app/vocabulary/data/lexicon.jsonl.gz (+ pending.jsonl.gz, build-report.json); the API imports
             it idempotently into the database. AI enrichment of pending entries runs later (app.vocabulary.enrich).

Usage (backend venv):  python scripts/vocabulary/build_lexicon.py --sources vocab-sources
Sources are downloaded by scripts/vocabulary/fetch_sources.sh (not committed; licences in SOURCES.md).
"""
from __future__ import annotations

import argparse
import collections
import csv
import gzip
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # platform/
sys.path.insert(0, str(ROOT / "backend"))

from app.content.md import bold_segments, fold, parse_tables, split_by_heading, strip_md  # noqa: E402
from app.content.store import ContentStore  # noqa: E402
from app.vocabulary.grading import contains_word  # noqa: E402
from app.vocabulary.topics import CEFRJ_TOPICS, KEYWORDS, TOPIC_IDS, TOPICS, UNIT_TOPICS, WIKT_TOPICS  # noqa: E402

OUT_DIR = ROOT / "backend" / "app" / "vocabulary" / "data"
LEVELS = ["A1", "A2", "B1", "B2", "C1"]
POS_MAP = {
    "noun": "noun", "verb": "verb", "adj": "adj", "adjective": "adj", "adv": "adv", "adverb": "adv", "prep": "prep",
    "preposition": "prep", "conj": "conj", "conjunction": "conj", "pron": "pron", "pronoun": "pron", "det": "det",
    "determiner": "det", "article": "det", "num": "num", "number": "num", "intj": "intj", "interjection": "intj",
    "phrase": "phrase", "prep_phrase": "phrase", "modal auxiliary": "aux", "be-verb": "verb", "do-verb": "verb",
    "have-verb": "verb", "particle": "adv", "contraction": "phrase",
}
CUR_POS = {"n": "noun", "v": "verb", "adj": "adj", "adv": "adv", "prep": "prep", "conj": "conj", "pron": "pron",
           "phr v": "verb", "v phr": "phrase", "phr": "phrase", "n phr": "phrase", "det": "det", "num": "num", "excl": "intj",
           "t": "verb", "k": "verb", "n ": "noun", "t/n": "verb", "idiom": "phrase", "modal": "aux"}
SKIP_LEMMAS = {"a", "an", "the", "to", "'s"}
BAD_SENSE_TAGS = {"obsolete", "archaic", "rare", "dialectal", "vulgar", "offensive", "derogatory", "historical", "slur",
                  "nonstandard", "dated", "euphemistic", "ethnic", "obscure"}
BAD_FORM_TAGS = {"obsolete", "archaic", "dialectal", "nonstandard", "table-tags", "inflection-template", "rare",
                 "misspelling", "romanization", "class", "multiword-construction"}
REGISTER_TAGS = {"formal": "formal", "informal": "informal", "colloquial": "informal", "slang": "slang", "literary": "literary",
                 "uncountable": "[U]", "countable": "[C]", "transitive": "ngoại động từ", "intransitive": "nội động từ",
                 "British": "Anh–Anh", "UK": "Anh–Anh", "US": "Anh–Mỹ", "American": "Anh–Mỹ"}
# narrow topics where a keyword in the selected sense is strong evidence even when a broader topic is already known
SPECIFIC_TOPICS = {"climate-change", "internet-social-media", "global-issues", "social-problems", "psychology-emotions", "daily-routine"}
CJK = re.compile(r"[⺀-鿿豈-﫿\U00020000-\U0002FFFF]")


# ------------------------------------------------------------------ helpers
def key(text: str) -> str:
    """Normalised lemma key: lower-case, straight quotes, single spaces."""
    t = unicodedata.normalize("NFC", text).replace("’", "'").replace("‘", "'").strip().lower()
    return re.sub(r"\s+", " ", t)


def entry_id(lemma: str) -> str:
    s = key(lemma).replace("'", "")
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^a-z0-9_\-.]+", "-", s).strip("-_.")
    return s or hashlib.sha1(lemma.encode()).hexdigest()[:10]


def level_of(text: str) -> str | None:
    m = re.search(r"\b(A1|A2|B1|B2|C1)\b", text or "")
    return m.group(1) if m else None


def norm_ipa(ipa: str) -> str:
    """Notation only (no new data): learner-dictionary style — /r/ for ɹ, /e/ for ɛ, no tie bars / syllable dots."""
    t = ipa.replace("ɹ", "r").replace("ɛ", "e").replace("\u0361", "").replace("\u032f", "").replace(".", "").replace("g", "ɡ")
    body = t.strip().strip("/")
    if body.count("ˈ") == 1 and body.startswith("ˈ") and len(re.findall(r"[aeiouæɑɒɔəɜʊʌɪ]+", body)) == 1:
        body = body[1:]  # stress mark on a one-syllable word
    return f"/{body}/"


def ipa_cmp(ipa: str) -> str:
    t = norm_ipa(ipa).replace("ɫ", "l").replace("ʔ", "").replace("\u0329", "")
    t = re.sub(r"[/\[\]\s()ˌ‿]", "", t)
    return t.replace("əl", "l").replace("ən", "n").lstrip("ˈ")


def clean_vi(words: list[str]) -> list[str]:
    out = []
    for w in words:
        w = unicodedata.normalize("NFC", w).strip().strip(",;")
        if not w or CJK.search(w) or len(w) > 40 or re.search(r"[A-Za-z]{3,}", fold(w)) is None and len(w) < 2:
            continue
        if w.lower() not in [o.lower() for o in out]:
            out.append(w)
    return out


def md_text(text: str) -> str:
    return strip_md(text or "").strip()


# ------------------------------------------------------------------ sources
def load_cefrj(src: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in csv.DictReader(open(src / "cefrj-vocabulary-profile-1.5.csv", encoding="utf-8")):
        variants = [v.strip() for v in r["headword"].split("/") if v.strip()]
        if not variants:
            continue
        k = key(variants[0])
        d = out.setdefault(k, {"lemma": variants[0], "variants": set(), "pos": {}, "cats": set()})
        d["variants"].update(variants[1:])
        if d["lemma"] != variants[0] and variants[0].islower():  # "it" (pronoun) over "IT" (abbreviation)
            d["variants"].add(d["lemma"])
            d["lemma"] = variants[0]
        pos = POS_MAP.get(r["pos"].strip())
        lvl = r["CEFR"].strip()
        if pos and lvl in LEVELS and (pos not in d["pos"] or LEVELS.index(lvl) < LEVELS.index(d["pos"][pos])):
            d["pos"][pos] = lvl
        for c in ("CoreInventory 1", "CoreInventory 2", "Threshold"):
            if r.get(c):
                d["cats"].add(r[c].strip())
    return out


def load_ngsl(src: Path) -> dict[str, int]:
    return {key(r["Lemma"]): int(r["SFI Rank"]) for r in csv.DictReader(open(src / "NGSL_12_stats.csv", encoding="utf-8"))
            if r["Lemma"].strip()}


def load_nawl(src: Path) -> set[str]:
    out = set()
    for line in open(src / "NAWL_12_lemmatized_for_teaching.csv", encoding="latin-1"):
        w = line.split(",")[0].strip()
        if w and not w.startswith("#"):
            out.add(key(w))
    return out


def load_wiktionary(src: Path) -> dict[str, list[dict]]:
    by: dict[str, list[dict]] = collections.defaultdict(list)
    for line in open(src / "wiktionary-slim.jsonl", encoding="utf-8"):
        e = json.loads(line)
        by[key(e["word"])].append(e)
    return by


class Tatoeba:
    """English sentences that have a Vietnamese translation on Tatoeba (CC BY 2.0 FR)."""

    def __init__(self, src: Path):
        links = collections.defaultdict(list)
        for line in open(src / "vie-eng_links.tsv", encoding="utf-8"):
            a, b = line.rstrip("\n").split("\t")[:2]
            links[int(b)].append(int(a))
        vie = {}
        for line in open(src / "vie_sentences.tsv", encoding="utf-8"):
            p = line.rstrip("\n").split("\t")
            if len(p) >= 3:
                vie[int(p[0])] = p[2]
        self.pairs: list[tuple[int, int, str, str]] = []
        for line in open(src / "eng_sentences.tsv", encoding="utf-8"):
            p = line.rstrip("\n").split("\t", 2)
            if len(p) < 3:
                continue
            eid = int(p[0])
            if eid in links:
                vids = [v for v in links[eid] if v in vie]
                if vids:
                    self.pairs.append((eid, vids[0], p[2], vie[vids[0]]))
        self.tokens = [re.findall(r"[a-z']+", s[2].lower()) for s in self.pairs]
        self.index: dict[str, set[int]] = collections.defaultdict(set)
        for i, toks in enumerate(self.tokens):
            for t in toks:
                self.index[t].add(i)

    def find(self, forms: list[str], limit: int = 3) -> list[dict]:
        cands: set[int] = set()
        for f in forms:
            parts = f.lower().split()
            if not parts:
                continue
            post = self.index.get(parts[0], set())
            if len(parts) == 1:
                cands |= post
            else:
                pat = re.compile(r"\b" + r"\s+".join(map(re.escape, parts)) + r"\b")
                cands |= {i for i in post if pat.search(self.pairs[i][2].lower())}
        good = []
        for i in cands:
            n = len(self.tokens[i])
            eng = self.pairs[i][2]
            if not contains_word(eng, forms):  # same whole-word rule as the app ("grown-up" is not "grow")
                continue
            if 4 <= n <= 14 and len(self.pairs[i][3]) <= 160 and not re.search(r"[\"“”]|\b(fuck|shit|damn|kill|sex)", eng.lower()):
                good.append((abs(n - 8), i))
        good.sort()
        out, starts = [], set()
        for _, i in good:
            eid, vid, eng, vi = self.pairs[i]
            st = " ".join(self.tokens[i][:2])
            if st in starts:
                continue
            starts.add(st)
            out.append({"en": eng, "vi": vi, "source": "tatoeba", "ref": f"tatoeba:{eid}-{vid}"})
            if len(out) >= limit:
                break
        return out


# ------------------------------------------------------------------ curriculum
def curriculum(store: ContentStore) -> dict:
    """Vocabulary that already exists in the curriculum (reused first, never regenerated)."""
    cards = store.cards()
    extra: list[dict] = []  # vocabulary tables outside 07-VOCABULARY
    patterns: list[dict] = []
    for u in store.unit_list:
        if u.kind == "vocabulary" or u.path.startswith("12-"):
            continue
        md = (store.root / u.path).read_text(encoding="utf-8")
        for t in parse_tables(md):
            h = [fold(md_text(x)) for x in t.header]
            mi = next((i for i, x in enumerate(h) if "nghia" in x or "meaning" in x), None)
            wi = next((i for i, x in enumerate(h) if x.startswith(("tu", "word", "collocation", "cum", "phrasal"))
                       and not x.startswith(("tu de hoi",))), None)
            pi = next((i for i, x in enumerate(h) if x.startswith(("cau truc", "cau", "mau cau"))), None)
            if mi is None:
                continue
            exi = next((i for i, x in enumerate(h) if x.startswith(("vi du", "example"))), None)
            ipai = next((i for i, x in enumerate(h) if x.startswith("ipa")), None)
            target = extra if wi is not None else patterns if pi is not None else None
            col = wi if wi is not None else pi
            if target is None or col == mi:
                continue
            for r in t.rows:
                if col < len(r) and mi < len(r) and md_text(r[col]) and md_text(r[mi]):
                    target.append({"word": md_text(r[col]), "meaning": md_text(r[mi]), "unit_id": u.id, "level": u.level,
                                   "example": md_text(r[exi]) if exi is not None and exi < len(r) else "",
                                   "ipa": md_text(r[ipai]) if ipai is not None and ipai < len(r) else ""})
    voc = {u.id: (store.root / u.path).read_text(encoding="utf-8") for u in store.unit_list if u.kind == "vocabulary"}
    focus: dict[str, list[str]] = {}  # collocation text → its **bold** key word(s) in the curriculum table
    for md in voc.values():
        for t in parse_tables(md):
            if t.header and fold(md_text(t.header[0])).startswith("collocation"):
                for r in t.rows:
                    if r and (b := bold_segments(r[0])):
                        focus[key(md_text(r[0]))] = b
    return {"cards": cards, "extra": extra, "patterns": patterns, "focus": focus, "voc17": voc.get("VOC-17", ""),
            "voc18": voc.get("VOC-18", ""), "voc19": voc.get("VOC-19", "")}


def parse_voc17(md: str) -> tuple[dict[str, list[str]], list[dict]]:
    """Collocation lists (`*a · b · c*` under a head-word heading, or tables) and the literal-translation mistakes table."""
    colls: dict[str, list[str]] = collections.defaultdict(list)
    mistakes: list[dict] = []
    _, secs = split_by_heading(md, 2)
    for sec in secs:
        title = fold(md_text(sec.title))
        if "bai tap" in title:
            continue
        if "dich thang" in title:
            for t in parse_tables(sec.body):
                for r in t.rows:
                    if len(r) >= 3:
                        right = [x.strip() for x in md_text(r[2]).split("/")]
                        mistakes.append({"vi": md_text(r[0]), "wrong": md_text(r[1]), "right": md_text(r[2]), "right_options": right})
            continue
        _, subs = split_by_heading(sec.body, 3)
        blocks = [(md_text(s.title), s.body) for s in subs] or [("", sec.body)]
        for head, body in blocks:
            for line in body.split("\n"):
                if "·" in line and not line.lstrip().startswith("|"):
                    for item in md_text(line).split("·"):
                        item = re.sub(r"\s*\(.*?\)\s*$", "", item).strip(" *.")
                        if 2 <= len(item.split()) <= 6:
                            colls[item.split()[0].lower() if item.split()[0].lower() not in ("a", "an") else item.split()[-1].lower()].append(item)
            for t in parse_tables(body):
                h = [fold(md_text(x)) for x in t.header]
                for r in t.rows:
                    if len(r) < 2:
                        continue
                    head_word, partners = md_text(r[0]), md_text(r[1])
                    if "dong tu" in h[0] or "trang tu" in h[0]:
                        for hw in head_word.split("/"):
                            hw = hw.strip()
                            for p in re.split(r"·|,", partners):
                                p = re.sub(r"\s*\(.*?\)\s*$", "", p).strip(" *.")
                                if p:
                                    colls[hw.lower()].append(p if p.lower().startswith(hw.lower()) else f"{hw} {p}")
                    elif "danh tu" in h[0]:
                        for noun in head_word.split("/"):
                            for adj in partners.split("/"):
                                if adj.strip() and noun.strip():
                                    colls[noun.strip().lower()].append(f"{adj.strip()} {noun.strip()}")
    return colls, mistakes


def parse_voc18(md: str) -> list[list[str]]:
    fams = []
    for t in parse_tables(md):
        h = [fold(md_text(x)) for x in t.header]
        if h and h[0].startswith("dong tu") and len(h) >= 4:
            for r in t.rows:
                words = [w.strip() for c in r[:4] for w in md_text(c).split(",") if w.strip() and w.strip() not in ("—", "-")]
                if len(words) >= 2:
                    fams.append(words)
    return fams


def parse_voc19(md: str) -> list[dict]:
    out = []
    for t in parse_tables(md):
        h = [fold(md_text(x)) for x in t.header]
        if h and h[0].startswith("cap") and len(t.header) >= 3:
            for r in t.rows:
                words = [w.strip() for w in md_text(r[0]).split("/") if w.strip()]
                if len(words) >= 2:
                    out.append({"words": words, "note_vi": md_text(r[1]), "example": md_text(r[2]) if len(r) > 2 else ""})
    return out


# ------------------------------------------------------------------ dictionary enrichment
def wikt_ipa(records: list[dict]) -> tuple[str | None, str | None]:
    uk = us = generic = None
    uk_rank = 9
    for e in records:
        for s in e.get("sounds", []):
            ipa = s["ipa"]
            if not (ipa.startswith("/") and ipa.endswith("/")):
                continue
            tags = set(s.get("tags", []))
            if tags & {"Received-Pronunciation", "Standard-Southern-British"} and (uk is None or uk_rank > 0):
                uk, uk_rank = norm_ipa(ipa), 0
            elif uk is None and tags & {"UK", "British"}:
                uk, uk_rank = norm_ipa(ipa), 1
            if us is None and tags & {"General-American", "US", "American"}:
                us = norm_ipa(ipa)
            if generic is None and not tags:
                generic = norm_ipa(ipa)
    return uk or generic, us or (generic if uk is None else None)


def wikt_forms(records: list[dict], lemma: str) -> list[str]:
    forms = []
    for e in records:
        for f in e.get("forms", []):
            tags = set(f.get("tags", []))
            form = f.get("f", "").strip()
            if (not form or tags & BAD_FORM_TAGS or form.lower() == lemma.lower() or len(form) > 40
                    or not re.fullmatch(r"[a-z' \-]+", form) or form.count(" ") != lemma.count(" ")
                    or form[:1] != lemma[:1].lower() and len(form) < 3):
                continue
            if form not in forms:
                forms.append(form)
    return forms[:10]


def regular_forms(lemma: str, pos: set[str]) -> list[str]:
    w = lemma.split()
    head, rest = w[0], (" " + " ".join(w[1:])) if len(w) > 1 else ""
    out = []
    if "verb" in pos:
        if head.endswith("e"):
            out += [head + "s", head + "d", head[:-1] + "ing"]
        elif re.search(r"[^aeiou]y$", head):
            out += [head[:-1] + "ies", head[:-1] + "ied", head + "ing"]
        else:
            out += [head + ("es" if re.search(r"(s|x|z|ch|sh)$", head) else "s"), head + "ed", head + "ing"]
    if "noun" in pos and not rest:
        out.append(head[:-1] + "ies" if re.search(r"[^aeiou]y$", head) else head + ("es" if re.search(r"(s|x|z|ch|sh)$", head) else "s"))
    return [o + rest for o in out]


def wikt_senses(records: list[dict], cefr_pos: dict[str, str]) -> list[dict]:
    """Senses that have Vietnamese translations, most widely translated (≈ most common) first."""
    cands = []
    for e in records:
        pos = POS_MAP.get(e.get("pos") or "")
        if pos is None:
            continue
        for g, d in (e.get("tgroups") or {}).items():
            vi = clean_vi(d.get("vi", []))
            if vi:
                cands.append({"pos": pos, "gloss": g, "vi": vi, "n": d.get("n", 0), "tags": [], "topics": [], "cats": [],
                              "syn": [], "ant": [], "examples": []})
        for s in e.get("senses", []):
            tr = s.get("tr") or {}
            vi = clean_vi(tr.get("vi", []))
            if not vi or set(s.get("tags", [])) & BAD_SENSE_TAGS:
                continue
            cands.append({"pos": pos, "gloss": s["gloss"], "vi": vi, "n": tr.get("n", 0), "tags": s.get("tags", []),
                          "topics": s.get("topics", []), "cats": s.get("cats", []), "syn": s.get("syn", []),
                          "ant": s.get("ant", []), "examples": [x for x in s.get("examples", []) if x.get("type") == "example"]})
    cands.sort(key=lambda c: (c["pos"] not in cefr_pos, -c["n"]))
    out: list[dict] = []
    for c in cands:
        dup = next((o for o in out if o["pos"] == c["pos"] and (set(map(str.lower, o["vi"])) & set(map(str.lower, c["vi"]))
                                                             or o["gloss"].lower() == c["gloss"].lower())), None)
        if dup:
            # merge evidence from an equivalent sense (prefer the shorter learner-friendly gloss)
            if len(c["gloss"]) < len(dup["gloss"]) and len(c["gloss"]) > 8:
                dup["gloss"] = c["gloss"]
            for f in ("tags", "topics", "cats", "syn", "ant"):
                dup[f] = list(dict.fromkeys(dup[f] + c[f]))
            dup["examples"] = dup["examples"] + [x for x in c["examples"] if x not in dup["examples"]]
            dup["vi"] = list(dict.fromkeys(dup["vi"] + c["vi"]))
            continue
        top = out[0]["n"] if out else 0
        if len(out) < 4 and (not out or c["n"] >= max(5, top * 0.2) or c["pos"] in cefr_pos and c["pos"] not in {o["pos"] for o in out}):
            out.append(c)
    return out


def wikt_examples(senses: list[dict], forms: list[str]) -> list[dict]:
    out = []
    pat = re.compile(r"\b(" + "|".join(re.escape(f) for f in forms) + r")\b", re.I)
    for s in senses:
        for x in s.get("examples", []):
            t = x.get("t", "").strip()
            if 15 <= len(t) <= 130 and pat.search(t) and contains_word(t, forms) and not re.search(r"[\[\]{}<>]|\(|\bfuck", t):
                out.append({"en": t, "vi": None, "source": "wiktionary", "ref": "wiktionary"})
    return out[:2]


# ------------------------------------------------------------------ build
def build(src: Path, content_root: Path) -> dict:
    store = ContentStore(content_root)
    cur = curriculum(store)
    cefrj, ngsl, nawl = load_cefrj(src), load_ngsl(src), load_nawl(src)
    wikt = load_wiktionary(src)
    tatoeba = Tatoeba(src)
    voc17, mistakes17 = parse_voc17(cur["voc17"])
    fams18, confused19 = parse_voc18(cur["voc18"]), parse_voc19(cur["voc19"])

    entries: dict[str, dict] = {}
    report = collections.Counter()

    def ensure(lemma: str, kind: str = "word") -> dict:
        k = key(lemma)
        if k not in entries:
            entries[k] = {"id": entry_id(lemma), "lemma": lemma.strip(), "headword": lemma.strip(), "kind": kind, "variants": [],
                          "cefr": None, "cefr_source": None, "pos": [], "senses": [], "examples": [], "collocations": [],
                          "family": [], "synonyms": [], "antonyms": [], "confused_with": [], "mistakes": [], "forms": [],
                          "topics": [], "topic_evidence": [], "legacy_ids": [], "units": [], "sources": [], "usage": [],
                          "freq_rank": None, "tier": None, "academic": False, "ipa_uk": None, "ipa_us": None,
                          "ipa_source": None, "ipa_status": "missing", "review_flags": [], "status": "pending"}
        return entries[k]

    # -- Discover 1: curriculum VOC cards (keep their ids for existing learner progress)
    for c in cur["cards"]:
        raw = md_text(c["word"])
        topic_title = c.get("topic", "")
        is_coll = "collocation" in fold(topic_title)
        pos_txt = fold(c.get("pos", ""))
        words = raw.split()
        if is_coll or "/" in raw and len(words) > 2:
            kind = "collocation"
            lemma = raw
        elif "phr" in pos_txt or c["unit_id"] == "VOC-16":
            kind, lemma = "phrasal_verb", re.sub(r"\s*\(.*?\)", "", raw).strip()
        else:
            base = re.sub(r"\s*\(.*?\)", "", raw).split("/")[0].strip()
            kind = "phrase" if len(base.split()) > 1 else "word"
            lemma = base
        e = ensure(lemma, kind)
        if e["kind"] == "word" and kind != "word":
            e["kind"] = kind
        e["legacy_ids"].append(c["id"])
        e["units"].append(c["unit_id"])
        e["sources"].append(f"curriculum:{c['unit_id']}")
        if raw != lemma and kind != "collocation":
            e["headword"] = raw if len(raw) <= 40 else lemma
        lvl = level_of(topic_title)
        if lvl and (e["cefr"] is None or e["cefr_source"] == "curriculum" and LEVELS.index(lvl) < LEVELS.index(e["cefr"])):
            e["cefr"], e["cefr_source"] = lvl, "curriculum"
        pos = [CUR_POS.get(re.sub(r"\[.*?\]", "", p).strip()) for p in re.split(r"[,/]", pos_txt)]
        pos = [p for p in pos if p] or (["verb"] if kind == "phrasal_verb" else ["phrase"] if kind != "word" else [])
        reg = re.findall(r"\[(U|C)\]", c.get("pos", ""))
        e["senses"].append({"pos": pos[0] if pos else "phrase", "meaning_vi": md_text(c["meaning"]), "definition_en": None,
                            "source": f"curriculum:{c['unit_id']}", "status": "curriculum", "usage": [f"[{r}]" for r in reg],
                            "pattern": raw if raw != lemma else None})
        for p in pos:
            if p not in e["pos"]:
                e["pos"].append(p)
        if c.get("example"):
            e["examples"].append({"en": md_text(c["example"]), "vi": None, "source": f"curriculum:{c['unit_id']}", "ref": c["id"]})
        if c.get("ipa"):
            e.setdefault("_cur_ipa", md_text(c["ipa"]))
        for t in UNIT_TOPICS.get(c["unit_id"], []):
            e["topic_evidence"].append(("curriculum", t))
        report["curriculum_cards"] += 1

    # -- Discover 2: vocabulary tables in grammar/skills units
    for x in cur["extra"]:
        word = re.sub(r"\s*\(.*?\)", "", x["word"]).split("/")[0].strip()
        if not word or len(word) > 40 or len(word.split()) > 5:
            continue
        k = key(word)
        e = ensure(word, "word" if len(word.split()) == 1 else "phrase")
        e["sources"].append(f"curriculum:{x['unit_id']}")
        e["units"].append(x["unit_id"])
        if not any(s["source"].startswith("curriculum") and fold(s["meaning_vi"]) == fold(x["meaning"]) for s in e["senses"]):
            e["senses"].append({"pos": "phrase" if " " in word else None, "meaning_vi": x["meaning"], "definition_en": None,
                                "source": f"curriculum:{x['unit_id']}", "status": "curriculum", "usage": [], "pattern": None})
        if x["example"]:
            e["examples"].append({"en": x["example"], "vi": None, "source": f"curriculum:{x['unit_id']}", "ref": x["unit_id"]})
        if x["ipa"] and "_cur_ipa" not in e:
            e["_cur_ipa"] = x["ipa"]
        if x["level"] and e["cefr"] is None:
            e["cefr"], e["cefr_source"] = x["level"], "curriculum"
        report["curriculum_extra_rows"] += 1
    for x in cur["patterns"]:
        p = x["word"]
        if 2 <= len(p.split()) <= 14 and len(p) <= 90:
            e = ensure(p, "pattern")
            e["sources"].append(f"curriculum:{x['unit_id']}")
            e["units"].append(x["unit_id"])
            if not e["senses"]:
                e["senses"].append({"pos": "pattern", "meaning_vi": x["meaning"], "definition_en": None, "usage": [],
                                    "source": f"curriculum:{x['unit_id']}", "status": "curriculum", "pattern": None})
            if x["example"]:
                e["examples"].append({"en": x["example"], "vi": None, "source": f"curriculum:{x['unit_id']}", "ref": x["unit_id"]})
            if x["level"] and e["cefr"] is None:
                e["cefr"], e["cefr_source"] = x["level"], "curriculum"
            report["curriculum_patterns"] += 1

    # -- Discover 3: open word lists (lemmas only; meanings come from dictionaries)
    for k, d in cefrj.items():
        if k in SKIP_LEMMAS or len(k) < 2 and k not in ("i",):
            continue
        e = ensure(d["lemma"])
        if e["lemma"] != d["lemma"] and e["lemma"].lower() == d["lemma"].lower() and d["lemma"].islower() and not e["legacy_ids"]:
            e["variants"].append(e["lemma"])
            e["lemma"] = e["headword"] = d["lemma"]
        e["sources"].append("cefrj-1.5")
        e["variants"] = sorted(set(e["variants"]) | d["variants"])
        lvl = min(d["pos"].values(), key=LEVELS.index) if d["pos"] else None
        if lvl:
            e["cefr"], e["cefr_source"] = lvl, "CEFR-J 1.5"
        e["_cefr_pos"] = d["pos"]
        for c in d["cats"]:
            for t in CEFRJ_TOPICS.get(c, []):
                e["topic_evidence"].append(("cefrj", t))
    for k, rank in ngsl.items():
        if k in SKIP_LEMMAS:
            continue
        e = ensure(k)
        e["sources"].append("ngsl-1.2")
        e["freq_rank"] = rank
    for k in nawl:
        e = ensure(k)
        e["sources"].append("nawl-1.2")
        e["academic"] = True
        e["topic_evidence"].append(("nawl", "academic"))

    # spelling variants that are separate CEFR-J rows → merge into one lemma
    for k in list(entries):
        e = entries.get(k)
        if e is None:
            continue
        for v in e["variants"]:
            vk = key(v)
            if vk != k and vk in entries and not entries[vk]["legacy_ids"]:
                o = entries.pop(vk)
                e["sources"] += o["sources"]
                e["topic_evidence"] += o["topic_evidence"]
                report["merged_spelling_variants"] += 1

    # -- Generate (dictionary) + Normalize
    by_lemma = set(entries)
    for k, e in entries.items():
        recs = wikt.get(k, [])
        cefr_pos = e.pop("_cefr_pos", {}) or {}
        if recs:
            e["sources"].append("wiktionary")
        senses = wikt_senses(recs, cefr_pos) if e["kind"] in ("word", "phrasal_verb", "phrase") else []
        cur_senses = [s for s in e["senses"] if s["status"] == "curriculum"]
        for s in senses:
            if any(set(map(fold, s["vi"])) & set(map(fold, re.split(r"[;,]\s*", cs["meaning_vi"]))) for cs in cur_senses):
                for cs in cur_senses:  # same meaning as the curriculum sense → only add English gloss
                    if cs["definition_en"] is None:
                        cs["definition_en"] = s["gloss"][:180]
                        cs["pos"] = cs["pos"] or s["pos"]
                continue
            usage = [REGISTER_TAGS[t] for t in s["tags"] if t in REGISTER_TAGS]
            e["senses"].append({"pos": s["pos"], "meaning_vi": "; ".join(s["vi"][:3]), "definition_en": s["gloss"][:180],
                                "source": "wiktionary", "status": "sourced", "usage": list(dict.fromkeys(usage)),
                                "pattern": None, "cefr": cefr_pos.get(s["pos"])})
            if s is senses[0]:  # topic labels of rarer senses are noise ("bank" → nautical)
                for t in s["topics"] + s["cats"]:
                    if (tt := WIKT_TOPICS.get(str(t).lower())):
                        e["topic_evidence"].append(("wiktionary", tt))
            if s is senses[0]:
                e["synonyms"] += [w for w in s["syn"] if key(w) in by_lemma and key(w) != k][:3]
                e["antonyms"] += [w for w in s["ant"] if key(w) in by_lemma and key(w) != k][:3]
        for s in e["senses"]:
            if s.get("pos") and s["pos"] not in e["pos"]:
                e["pos"].append(s["pos"])
        e["pos"] = [p for p in e["pos"] if p]

        # forms (for example search, typing tolerance and reading lookup)
        forms = wikt_forms(recs, e["lemma"]) if recs else []
        if not forms and e["kind"] in ("word", "phrasal_verb"):
            forms = regular_forms(e["lemma"], set(e["pos"]))
        e["forms"] = forms

        # IPA: dictionary only. Curriculum IPA is kept only when it agrees with the dictionary.
        uk, us = wikt_ipa(recs)
        cur_ipa = e.pop("_cur_ipa", None)
        cur_first = (re.findall(r"/[^/]+/", cur_ipa or "") or [None])[0]
        if uk or us:
            e["ipa_uk"], e["ipa_us"] = uk, us
            e["ipa_source"] = "wiktionary"
            e["ipa_status"] = "dictionary"
            if cur_first and len(e["lemma"].split()) == 1:
                if ipa_cmp(cur_first) in {ipa_cmp(x) for x in (uk, us) if x}:
                    e["ipa_status"] = "dictionary+curriculum"
                    report["ipa_curriculum_agrees"] += 1
                else:
                    e["review_flags"].append("ipa_curriculum_differs")
                    e["ipa_curriculum"] = cur_first
                    report["ipa_curriculum_differs"] += 1
        elif len(e["lemma"].split()) > 1 and e["kind"] in ("phrasal_verb", "phrase"):
            parts = [wikt_ipa(wikt.get(key(w), [])) for w in e["lemma"].split()]
            if all(p[0] for p in parts):
                e["ipa_uk"] = "/" + " ".join(p[0].strip("/") for p in parts) + "/"
                e["ipa_source"] = "wiktionary (ghép từ từng từ)"
                e["ipa_status"] = "composed"
        if e["ipa_status"] == "missing" and cur_first:
            e["ipa_curriculum"] = cur_first
            e["review_flags"].append("ipa_unverified")
            report["ipa_curriculum_unverified"] += 1

        # examples: curriculum first, then Tatoeba (with Vietnamese), then Wiktionary usage examples
        search_forms = [e["lemma"]] + e["forms"] + e["variants"]
        if e["kind"] in ("word", "phrasal_verb", "phrase"):
            have = {x["en"].lower() for x in e["examples"]}
            have_vi = set()
            for x in tatoeba.find(search_forms, limit=4):
                if x["en"].lower() not in have and x["vi"].lower() not in have_vi and len([y for y in e["examples"] if y["source"] == "tatoeba"]) < 3:
                    e["examples"].append(x)
                    have_vi.add(x["vi"].lower())
            if not any(x["source"] in ("tatoeba",) or x["source"].startswith("curriculum") for x in e["examples"]):
                e["examples"] += wikt_examples(senses, search_forms)
        e["examples"] = e["examples"][:5]

    # -- relations from the curriculum
    for head, items in voc17.items():
        if (e := entries.get(key(head))):
            for it in items:
                if it.lower() not in [c["phrase"].lower() for c in e["collocations"]]:
                    e["collocations"].append({"phrase": it, "meaning_vi": None, "source": "curriculum:VOC-17", "focus": head})
    for e in list(entries.values()):
        if e["kind"] == "collocation":
            focus = cur["focus"].get(key(e["lemma"])) or [e["lemma"].split()[0]]
            e["focus"] = focus
            for f in [x.strip() for part in focus for x in part.split("/") if x.strip()]:
                if (h := entries.get(key(f))) and h is not e:
                    h["collocations"].append({"phrase": e["lemma"], "meaning_vi": e["senses"][0]["meaning_vi"] if e["senses"] else None,
                                              "source": e["sources"][0], "focus": f, "entry_id": e["id"]})
    for m in mistakes17:
        for word in re.findall(r"[a-z]+", m["right"].lower()):
            if (e := entries.get(word)) and word not in ("a", "the", "on", "off", "be", "for", "good"):
                e["mistakes"].append({"vi": m["vi"], "wrong": m["wrong"], "right": m["right"], "source": "curriculum:VOC-17"})
                break
    for fam in fams18:
        ks = [key(w) for w in fam]
        for kk in ks:
            if (e := entries.get(kk)):
                e["family"] += [w for w in fam if key(w) != kk]
    for grp in confused19:
        for w in grp["words"]:
            if (e := entries.get(key(w))):
                e["confused_with"].append({"words": [x for x in grp["words"] if x != w], "note_vi": grp["note_vi"],
                                           "example": grp["example"], "source": "curriculum:VOC-19"})
    for k, e in entries.items():
        for r in wikt.get(k, []):
            for d in r.get("derived", []) + r.get("related", []):
                if key(d) in entries and key(d) != k and (key(d).startswith(k[:max(4, len(k) - 2)]) or k.startswith(key(d)[:max(4, len(key(d)) - 2)])):
                    e["family"].append(d)
        e["family"] = list(dict.fromkeys(e["family"]))[:8]
        e["antonyms"] = list(dict.fromkeys(e["antonyms"]))[:4]
    # near-synonyms: Wiktionary lists synonyms per sense (sometimes rare senses: achieve → "register"); keep one only if
    # it also shares a Vietnamese meaning with the headword — two independent pieces of evidence
    def vi_set(x):
        return {fold(w.strip()) for s in x["senses"] for w in re.split(r"[;,]", s["meaning_vi"]) if w.strip()}
    for k, e in entries.items():
        mine = vi_set(e)
        e["synonyms"] = [w for w in dict.fromkeys(e["synonyms"]) if key(w) in entries and vi_set(entries[key(w)]) & mine][:5]

    # -- topics, CEFR estimates, tiers
    for k, e in entries.items():
        text = " ".join(f"{s.get('definition_en') or ''} {s['meaning_vi']}" for s in e["senses"][:1]).lower()
        text += " " + e["lemma"].lower()
        for t, kws in KEYWORDS.items():
            if any(re.search(r"(?<![\w])" + re.escape(w) + r"(?![\w])", text) for w in kws):
                e["topic_evidence"].append(("keyword", t))
        prio = {"curriculum": 0, "cefrj": 1, "nawl": 2, "wiktionary": 3, "keyword": 4}
        ranked = sorted(e["topic_evidence"], key=lambda x: prio[x[0]])
        topics = []
        for src_, t in ranked:
            if t not in topics and t in TOPIC_IDS:
                if src_ == "keyword" and len(topics) >= (2 if t in SPECIFIC_TOPICS else 1):
                    continue
                topics.append(t)
            if len(topics) >= 3:
                break
        e["topic_sources"] = sorted({s for s, t in ranked if t in topics})
        e["topics"] = topics or ["core"]
        del e["topic_evidence"]
        if e["cefr"] is None:
            if e["freq_rank"]:
                e["cefr"], e["cefr_source"] = ("A2" if e["freq_rank"] <= 1000 else "B1" if e["freq_rank"] <= 2000 else "B2"), "ước lượng theo tần suất NGSL"
            elif e["academic"]:
                e["cefr"], e["cefr_source"] = "B2", "ước lượng (NAWL học thuật)"
        if e["cefr"] is None and e["kind"] == "collocation":
            heads = [entries[key(f)]["cefr"] for f in e.get("focus", []) if key(f) in entries and entries[key(f)]["cefr"]]
            if heads:
                e["cefr"], e["cefr_source"] = max(heads, key=LEVELS.index), "ước lượng theo từ chính"
        if e["cefr"] is None and e["units"]:
            unit_levels = [x["cefr"] for x in entries.values() if x["cefr"] and x["cefr_source"] == "curriculum" and e["units"][0] in x["units"]]
            if unit_levels:
                e["cefr"], e["cefr_source"] = min(unit_levels, key=LEVELS.index), "ước lượng theo bài giáo trình"
        r = e["freq_rank"]
        e["tier"] = 1 if r and r <= 1000 else 2 if r and r <= 2000 else 3 if r else (3 if e["cefr"] in ("A1", "A2") else 4)

    # -- Validate + Review status
    published, pending = [], []
    seen_ids = {}
    for k, e in sorted(entries.items(), key=lambda kv: kv[0]):
        e["senses"] = [s for s in e["senses"] if s["meaning_vi"] and len(s["meaning_vi"]) <= 240]
        if e["id"] in seen_ids:  # distinct lemmas that slug to the same id ("it's" / "its")
            e["id"] = f"{e['id']}-{hashlib.sha1(k.encode()).hexdigest()[:4]}"
        seen_ids[e["id"]] = k
        for i, s in enumerate(e["senses"]):
            s["id"] = f"{e['id']}#{i + 1}"
            s.setdefault("cefr", None)
        for i, x in enumerate(e["examples"]):
            x["id"] = f"{e['id']}~{i + 1}"
        e["sources"] = list(dict.fromkeys(e["sources"]))
        e["units"] = list(dict.fromkeys(e["units"]))
        problems = []
        if not e["senses"]:
            problems.append("no_vietnamese_meaning")
        if e["cefr"] not in LEVELS:
            problems.append("no_level")
        if any(x["en"] and not x["en"].strip() for x in e["examples"]):
            problems.append("empty_example")
        if problems:
            e["status"] = "pending"
            e["review_flags"] += problems
            pending.append(e)
            continue
        if not e["examples"]:
            e["review_flags"].append("no_example")
        e["status"] = "curriculum" if any(s["status"] == "curriculum" for s in e["senses"]) else "sourced"
        published.append(e)

    # learning order: level → topic band (basic, concrete topics first) → content words before function words
    # (those are taught in the grammar lessons) → frequency tier → frequency rank → lemma
    band = {t["id"]: ["A1", "A2", "B1", "B2"].index(t["band"]) for t in TOPICS}
    band["core"] = 0
    function_pos = {"prep", "pron", "det", "conj", "aux", "num", "intj"}

    def order_key(e):
        return (LEVELS.index(e["cefr"]), min(band.get(t, 3) for t in e["topics"]), bool(e["pos"]) and set(e["pos"]) <= function_pos,
                e["tier"], e["freq_rank"] or 99999, e["lemma"].lower())
    published.sort(key=order_key)
    for i, e in enumerate(published):
        e["order"] = i
    return {"published": published, "pending": pending, "report": report}


def summarize(res: dict) -> dict:
    pub, pen = res["published"], res["pending"]
    lemma_kinds = ("word", "phrasal_verb")
    c = collections.Counter
    return {
        "published_entries": len(pub),
        "published_lemmas": sum(1 for e in pub if e["kind"] in lemma_kinds),
        "pending_entries": len(pen),
        "by_kind": dict(c(e["kind"] for e in pub)),
        "by_level": dict(sorted(c(e["cefr"] for e in pub).items())),
        "by_status": dict(c(e["status"] for e in pub)),
        "by_topic": dict(sorted(c(t for e in pub for t in e["topics"]).items(), key=lambda kv: -kv[1])),
        "ipa_status": dict(c(e["ipa_status"] for e in pub)),
        "with_example": sum(1 for e in pub if e["examples"]),
        "with_vietnamese_example": sum(1 for e in pub if any(x.get("vi") for x in e["examples"])),
        "with_collocations": sum(1 for e in pub if e["collocations"]),
        "with_family": sum(1 for e in pub if e["family"]),
        "senses": sum(len(e["senses"]) for e in pub),
        "examples": sum(len(e["examples"]) for e in pub),
        "legacy_card_ids": sum(len(e["legacy_ids"]) for e in pub + pen),
        "review_flags": dict(c(f for e in pub for f in e["review_flags"])),
        "pending_reasons": dict(c(f for e in pen for f in e["review_flags"])),
        "pipeline": dict(res["report"]),
    }


def write(res: dict) -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = summarize(res)
    lines = [json.dumps(e, ensure_ascii=False, sort_keys=True) for e in res["published"]]
    payload = ("\n".join(lines) + "\n").encode("utf-8")
    version = hashlib.sha256(payload).hexdigest()[:16]
    with gzip.GzipFile(OUT_DIR / "lexicon.jsonl.gz", "wb", mtime=0) as f:
        f.write(payload)
    with gzip.GzipFile(OUT_DIR / "pending.jsonl.gz", "wb", mtime=0) as f:
        f.write(("\n".join(json.dumps(e, ensure_ascii=False, sort_keys=True) for e in res["pending"]) + "\n").encode("utf-8"))
    summary["version"] = version
    (OUT_DIR / "build-report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # every curriculum card must still map to exactly one published or pending entry (learner progress depends on it)
    return summary


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", default=str(ROOT / "vocab-sources"))
    ap.add_argument("--content", default=str(ROOT.parent))
    a = ap.parse_args()
    res = build(Path(a.sources), Path(a.content))
    summary = write(res)
    print(json.dumps({k: summary[k] for k in ("version", "published_entries", "published_lemmas", "pending_entries", "by_level",
                                             "by_status", "ipa_status", "with_example", "with_vietnamese_example")}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
