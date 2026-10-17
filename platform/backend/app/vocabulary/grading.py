"""Deterministic grading of typed vocabulary answers (no AI).

Verdicts (Vietnamese labels in the UI):
  correct           exact headword / phrase
  acceptable        accepted alternative: spelling variant (colour/color), alternatives written "a / b", optional "to"
  spelling          close misspelling of the target (edit distance small for the word length)
  wrong_form        right word, wrong form (an inflected form or a member of the word family)
  wrong_meaning     a different real word (its meaning is shown, to separate the two)
  incorrect         anything else
For phrase answers that come out `incorrect`, a second AI layer may decide if it is a valid alternative.
"""
from __future__ import annotations

import re
import unicodedata

SCHEDULE_RATING = {"correct": 3, "acceptable": 3, "spelling": 2, "wrong_form": 2, "wrong_meaning": 1, "incorrect": 1}
CORRECTISH = {"correct", "acceptable", "spelling", "wrong_form"}
BRIT_US = [("our", "or"), ("ise", "ize"), ("isation", "ization"), ("yse", "yze"), ("tre", "ter"), ("ll", "l"), ("ogue", "og")]


def clean(text: str) -> str:
    t = unicodedata.normalize("NFC", text or "").replace("’", "'").replace("‘", "'").lower()
    t = re.sub(r"[.!?,;:\"“”()\[\]]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def alternatives(target: str) -> list[str]:
    """'catch / miss the bus' → ['catch the bus', 'miss the bus']; 'brush (teeth)' → ['brush', 'brush teeth']."""
    t = clean(target) if "(" not in target else target.lower()
    outs = set()
    m = re.match(r"^(.*?)\((.+?)\)(.*)$", t)
    if m:
        a, opt, b = m.groups()
        outs |= {clean(a + b), clean(a + opt + b)}
    else:
        outs.add(clean(t))
    expanded = set()
    for o in outs:
        if "/" in o:
            parts = [p.strip() for p in o.split("/")]
            # "do the housework / the shopping" → first word shared; "catch / miss the bus" → last part shared
            first = parts[0].split()
            last = parts[-1].split()
            for p in parts:
                words = p.split()
                if len(words) == 1 and len(last) > 1 and p is not parts[-1]:
                    expanded.add(" ".join([p] + last[1:]))
                elif p is not parts[0] and len(first) > 1 and words and words[0] in ("the", "a", "an", "some"):
                    expanded.add(" ".join([first[0]] + words))
                else:
                    expanded.add(p)
        else:
            expanded.add(o)
    return sorted(x for x in expanded if x)


def spelling_variants(word: str) -> set[str]:
    out = {word}
    for uk, us in BRIT_US:
        if uk in word:
            out.add(word.replace(uk, us))
        if us in word:
            out.add(word.replace(us, uk))
    return out


def distance(a: str, b: str) -> int:
    """Optimal string alignment (Damerau–Levenshtein with adjacent transpositions)."""
    if a == b:
        return 0
    la, lb = len(a), len(b)
    d = [[0] * (lb + 1) for _ in range(la + 1)]
    for i in range(la + 1):
        d[i][0] = i
    for j in range(lb + 1):
        d[0][j] = j
    for i in range(1, la + 1):
        for j in range(1, lb + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[la][lb]


def spelling_tolerance(target: str) -> int:
    n = len(target.replace(" ", ""))
    return 0 if n <= 3 else 1 if n <= 7 else 2


def grade_typed(answer: str, *, target: str, variants: list[str] = (), forms: list[str] = (), family: list[str] = (),
                other_entry=None) -> dict:
    """`other_entry(text) -> (entry_id, meaning_vi) | None` resolves a different real word for `wrong_meaning`."""
    a = clean(answer)
    if not a:
        return {"verdict": "incorrect", "correct": False, "expected": target}
    main = alternatives(target)
    accepted = set(main)
    for v in variants:
        accepted |= set(alternatives(v))
    for x in list(accepted):
        accepted |= spelling_variants(x)
    if a in main:
        return {"verdict": "correct", "correct": True, "expected": target}
    stripped = re.sub(r"^(to|a|an|the) ", "", a)
    if a in accepted or stripped in accepted or any(re.sub(r"^(to|a|an|the) ", "", x) == stripped for x in accepted):
        return {"verdict": "acceptable", "correct": True, "expected": target}
    if any(clean(f) == a for f in forms):
        return {"verdict": "wrong_form", "correct": False, "expected": target, "detail": "inflected"}
    for x in accepted:
        if distance(a, x) <= spelling_tolerance(x) and a[:1] == x[:1] or distance(a, x) == 1 and len(x) > 3:
            return {"verdict": "spelling", "correct": False, "expected": target}
    if any(clean(f) == a for f in family):
        return {"verdict": "wrong_form", "correct": False, "expected": target, "detail": "family"}
    if other_entry is not None:
        hit = other_entry(a)
        if hit:
            return {"verdict": "wrong_meaning", "correct": False, "expected": target, "confused_with": hit[0], "confused_meaning": hit[1]}
    return {"verdict": "incorrect", "correct": False, "expected": target}


def grade_order(tokens: list[str], sentence: str) -> dict:
    ok = clean(" ".join(tokens)) == clean(sentence)
    return {"verdict": "correct" if ok else "incorrect", "correct": ok, "expected": sentence}


def contains_word(text: str, forms: list[str]) -> bool:
    t = " " + clean(text) + " "
    return any(f and (" " + clean(f) + " ") in t for f in forms)
