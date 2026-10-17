"""Extract exercise items from lesson Markdown and answer keys from answer files.

Design rules (see platform/README.md → "Content engine"):
- Items are only created from explicit labels in the source (`**L1.1.**`,
  `**12.**`, `**G01.**`) or — for practice labs — numbered lists whose numbers
  exist in the matching answer table. Nothing is invented.
- The answer key text is copied from the answer file verbatim; the backend never
  sends it to the browser before the learner submits.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .md import FENCE_RE, HEADING_RE, bold_segments, fold, parse_tables, split_by_heading, strip_md, tokens

LABEL_CORE = r"L\d\.\d+|[A-Z]{0,3}\d{1,3}[a-z]?"
LABEL_RE = re.compile(r"\*\*(" + LABEL_CORE + r")\.(?:\*\*|\s+([^*\n]{1,120}?)\*\*)")
NUM_ITEM_RE = re.compile(r"^(\d{1,3})\.\s+(.*)$")
TASK_RE = re.compile(r"^\*\*(?:Nhiệm vụ|Task)\s*(\d{1,2})\s*[:.]?\*\*\s*:?\s*(.*)$")


@dataclass
class RawItem:
    label: str
    text: str
    instruction: str = ""


@dataclass
class AnswerKey:
    label: str
    answer_md: str
    explanation_md: str = ""
    block: bool = False
    group_sample: bool = False
    review: str = ""


# --------------------------------------------------------------------------- items

def _is_continuation(line: str) -> bool:
    s = line.lstrip()
    return s.startswith((">", "|", "- ", "* ", "```", "   ")) or bool(re.match(r"^\d+\.\s", s))


def extract_items(md: str, numbered: bool = False) -> tuple[str, list[RawItem]]:
    """Return (intro_markdown_before_first_item, items)."""
    items: list[RawItem] = []
    intro: list[str] = []
    pending: list[str] = []
    cur: RawItem | None = None
    blank = False
    in_fence = False
    for line in md.split("\n"):
        if FENCE_RE.match(line):
            in_fence = not in_fence
            if cur is not None:
                cur.text += "\n" + line
            else:
                (pending if items else intro).append(line)
            continue
        if in_fence:
            if cur is not None:
                cur.text += "\n" + line
            else:
                (pending if items else intro).append(line)
            continue
        tm = TASK_RE.match(line.strip())
        if tm:
            items.append(RawItem(label=f"NV{tm.group(1)}", text=tm.group(2).strip(), instruction="\n".join(pending).strip()))
            pending = []
            cur = items[-1]
            blank = False
            continue
        matches = list(LABEL_RE.finditer(line))
        starts_with_label = bool(matches) and line[: matches[0].start()].strip() in ("", "-", "*")
        num = NUM_ITEM_RE.match(line.strip()) if numbered and not starts_with_label else None
        if starts_with_label:
            instr = "\n".join(pending).strip()
            pending = []
            for k, m in enumerate(matches):
                end = matches[k + 1].start() if k + 1 < len(matches) else len(line)
                lead = f"**{m.group(2).strip()}** " if m.group(2) else ""
                items.append(RawItem(label=m.group(1), text=(lead + line[m.end():end].strip()).strip(), instruction=instr if k == 0 else ""))
            cur = items[-1]
            blank = False
            continue
        if num and not HEADING_RE.match(line):
            items.append(RawItem(label=num.group(1), text=num.group(2).strip(), instruction="\n".join(pending).strip()))
            pending = []
            cur = items[-1]
            blank = False
            continue
        if cur is not None:
            if not line.strip():
                blank = True
                continue
            if (not blank or _is_continuation(line)) and not HEADING_RE.match(line):
                cur.text += ("\n\n" if blank else "\n") + line
                blank = False
                continue
            cur = None
        if items:
            pending.append(line)
        else:
            intro.append(line)
    return "\n".join(intro).strip(), items


OPTION_START = re.compile(r"(?:^|\s)A[\.\)]\s+")


def parse_options(text: str) -> tuple[str, list[dict]] | None:
    """Detect inline options `A. x  B. y  C. z` (possibly across lines)."""
    m = OPTION_START.search(text)
    if not m:
        return None
    prompt = text[: m.start()].rstrip()
    rest = text[m.start():].strip()
    parts = re.split(r"\s+(?=[B-H][\.\)]\s)", rest)
    options = []
    expected = "A"
    for part in parts:
        pm = re.match(r"^([A-H])[\.\)]\s+(.*)$", part.strip(), re.S)
        if not pm or pm.group(1) != expected:
            return None
        options.append({"key": pm.group(1), "text": pm.group(2).strip()})
        expected = chr(ord(expected) + 1)
    if len(options) < 2:
        return None
    if any(len(o["text"]) > 220 for o in options):
        return None
    return prompt, options


PAREN_CHOICE = re.compile(r"\(([^()]{1,80}?/[^()]{1,80}?)\)")


def parse_paren_choice(text: str) -> tuple[list[str], str] | None:
    """`The information (is / are) wrong.` → (['is', 'are'], matched group)."""
    found = PAREN_CHOICE.findall(text)
    if len(found) != 1:
        return None
    opts = [strip_md(o).strip() for o in found[0].split("/")]
    if not 2 <= len(opts) <= 4 or any(not o or len(o.split()) > 5 for o in opts):
        return None
    return opts, found[0]


# --------------------------------------------------------------------------- answer keys

KEY_LABEL = re.compile(r"^(?P<a>" + LABEL_CORE + r")(?:\s*[–\-]\s*(?P<b>" + LABEL_CORE + r"))?(?=$|[\s\.:,)(])")


def expand_range(a: str, b: str | None) -> list[str]:
    if not b:
        return [a]
    ma = re.match(r"^(.*?)(\d+)$", a)
    mb = re.match(r"^(.*?)(\d+)$", b)
    if not ma or not mb or ma.group(1) != mb.group(1):
        return [a, b]
    width = len(ma.group(2))
    lo, hi = int(ma.group(2)), int(mb.group(2))
    if hi < lo or hi - lo > 40:
        return [a, b]
    return [f"{ma.group(1)}{str(n).zfill(width) if ma.group(2).startswith('0') else n}" for n in range(lo, hi + 1)]


def _norm_label(label: str) -> str:
    return label.strip().rstrip(".").upper()


def parse_answer_keys(md: str) -> dict[str, AnswerKey]:
    keys: dict[str, AnswerKey] = {}

    def put(label: str, key: AnswerKey) -> None:
        keys.setdefault(_norm_label(label), key)

    for table in parse_tables(md):
        header = [fold(strip_md(h)) for h in table.header]
        pairs = [(0, 1)]
        if len(header) >= 4 and header[0] == header[2] and header[1] == header[3]:
            pairs = [(0, 1), (2, 3)]
        review_col = next((i for i, h in enumerate(header) if "on lai" in h), None)
        for row in table.rows:
            for li, ai in pairs:
                if li >= len(row) or ai >= len(row):
                    continue
                m = KEY_LABEL.match(strip_md(row[li]))
                if not m:
                    continue
                labels = expand_range(m.group("a"), m.group("b"))
                extra = [] if len(pairs) > 1 else [c for i, c in enumerate(row[ai + 1:], start=ai + 1) if c and i != review_col]
                key = AnswerKey(
                    label=m.group("a"),
                    answer_md=row[ai],
                    explanation_md=" · ".join(extra),
                    review=row[review_col] if review_col is not None and review_col < len(row) else "",
                    group_sample=len(labels) > 1,
                )
                for lab in labels:
                    put(lab, key)

    # Paragraph/block answers: a line starting with a bold label.
    lines = md.split("\n")
    i = 0
    in_fence = False
    while i < len(lines):
        line = lines[i]
        if FENCE_RE.match(line):
            in_fence = not in_fence
        bm = None if in_fence else re.match(r"^\*\*([^*]+?)\*\*(.*)$", line.strip())
        lm = KEY_LABEL.match(bm.group(1).strip()) if bm else None
        if bm and lm:
            labels = expand_range(lm.group("a"), lm.group("b"))
            body = [bm.group(2).strip()]
            j = i + 1
            while j < len(lines):
                nxt = lines[j]
                nb = re.match(r"^\*\*([^*]+?)\*\*", nxt.strip())
                if HEADING_RE.match(nxt) or (nb and KEY_LABEL.match(nb.group(1).strip())):
                    break
                body.append(nxt)
                j += 1
            text = "\n".join(body).strip()
            key = AnswerKey(label=lm.group("a"), answer_md=text, block=True, group_sample=len(labels) > 1)
            for lab in labels:
                put(lab, key)
            i = j
            continue
        i += 1
    return keys


def region_by_anchor(md: str, anchor: str | None) -> str:
    """Return the part of an answer file a link anchor points to (e.g. #l02)."""
    if not anchor:
        return md
    from .md import slugify

    lines = md.split("\n")
    for idx, line in enumerate(lines):
        m = HEADING_RE.match(line)
        if m and slugify(m.group(2)) == anchor.lower():
            level = len(m.group(1))
            out = []
            for nxt in lines[idx + 1:]:
                hm = HEADING_RE.match(nxt)
                if hm and len(hm.group(1)) <= level:
                    break
                out.append(nxt)
            return "\n".join(out)
    return md


def strip_transcripts(md: str) -> str:
    """Drop heading sections titled "Transcript …" so their bold labels are not read as answers."""
    out, skip_level = [], None
    in_fence = False
    for line in md.split("\n"):
        if FENCE_RE.match(line):
            in_fence = not in_fence
        m = None if in_fence else HEADING_RE.match(line)
        if m:
            level = len(m.group(1))
            if skip_level is not None and level <= skip_level:
                skip_level = None
            if skip_level is None and level >= 2 and "transcript" in fold(m.group(2)):
                skip_level = level
                continue
        if skip_level is None:
            out.append(line)
    return "\n".join(out)


def label_candidates(label: str) -> list[str]:
    lab = label.upper()
    out = [lab]
    m = re.match(r"^Q(\d+)$", lab)
    if m:
        out.append(m.group(1))
    return out


def heading_block_key(label: str, md: str) -> AnswerKey | None:
    """`## Bài 2 — …` / `### Task 3` sections as the answer for item 2 / 3."""
    num = re.sub(r"^[A-Z]+", "", label.upper())
    if not num.isdigit():
        return None
    for level in (2, 3, 4):
        _, sections = split_by_heading(md, level)
        for sec in sections:
            if re.match(rf"^(Bài|Task|Câu|Exercise|Phần|Nhiệm vụ)\s*{int(num)}\b", strip_md(sec.title), re.I):
                return AnswerKey(label=label, answer_md=sec.body.strip(), block=True)
    return None


def _bigrams(toks: list[str]) -> set[tuple[str, str]]:
    return {(a, b) for a, b in zip(toks, toks[1:])}


def heading_score(specific: str, general: str, section_title: str) -> float:
    """How well an answer-file heading matches an exercise group's headings."""
    sp = [t for t in tokens(specific) if t not in STOP]
    ge = [t for t in tokens(general) if t not in STOP]
    st = [t for t in tokens(section_title) if t not in STOP]
    if not st:
        return 0.0
    sset, gset, tset = set(sp), set(ge), set(st)
    if any(not t.isdigit() for t in tset) and not any(not t.isdigit() for t in (sset | gset) & tset):
        return 0.0  # a shared number alone ("Listening 2" vs "Speaking 2") is not a match
    score = 3 * len(_bigrams(st) & (_bigrams(sp) | _bigrams(ge)))
    score += 2 * len(tset & sset) + 1 * len((tset & gset) - sset)
    # numbered answer sections ("Listening 1") must agree with the group's number
    sec_nums = {t for t in tset if t.isdigit()}
    if sec_nums and sset and not (sec_nums & (sset | gset)):
        return 0.0
    return score / (1 + 0.1 * len(tset - sset - gset))


def choose_keys(specific: str, labels: list[str], md: str, general: str = "") -> dict[str, AnswerKey] | None:
    """Pick the answer section that both resembles the group heading and covers its labels."""
    if not labels:
        return None

    def coverage(keys: dict) -> float:
        return sum(1 for l in labels if any(c in keys for c in label_candidates(l))) / len(labels)

    best, best_rank = None, None
    for level in (2, 3, 4):
        _, sections = split_by_heading(md, level)
        for sec in sections:
            keys = parse_answer_keys(sec.body)
            if not keys or coverage(keys) < 0.5:
                continue
            _, children = split_by_heading(sec.body, level + 1)
            if sum(1 for ch in children if coverage(parse_answer_keys(ch.body)) >= 0.5) >= 2:
                continue  # parent of several numbered answer blocks → ambiguous, use a child instead
            score = heading_score(specific, general, sec.title)
            rank = (score > 0, round(coverage(keys), 2), score, -len(sec.body))
            if best_rank is None or rank > best_rank:
                best, best_rank = keys, rank
    if best is None:
        keys = parse_answer_keys(md)
        has_sections = any(split_by_heading(md, lv)[1] for lv in (2, 3, 4))
        if keys and coverage(keys) >= 0.5 and not has_sections:
            return keys
    if best_rank is not None and not best_rank[0]:
        # no heading resemblance: only accept when the answer file has a single candidate block
        return best if _single_block(md, labels) else None
    return best


def _single_block(md: str, labels: list[str]) -> bool:
    """True when the answer file holds exactly one keyed section (so it cannot be the wrong one)."""
    count = 0
    for level in (2, 3, 4):
        _, sections = split_by_heading(md, level)
        for sec in sections:
            _, children = split_by_heading(sec.body, level + 1)
            if not children and parse_answer_keys(sec.body):
                count += 1
    return count <= 1


def code_options(context: str) -> list[dict]:
    """Answer codes declared in an instruction: `**S** (simple)`, `quá rộng (R)`, `**A, B, C** hoặc **D**`, `C/U`."""
    found: dict[str, str] = {}
    for m in re.finditer(r"\*\*([A-Z]{1,2})\*\*\s*\(([^)]{1,40})\)", context):
        found.setdefault(m.group(1), f"{m.group(1)} — {strip_md(m.group(2))}")
    for m in re.finditer(r"([^,;:()*\n]{2,40}?)\s*\(([A-Z]{1,2})\)", context):
        found.setdefault(m.group(2), f"{m.group(2)} — {strip_md(m.group(1)).strip()}")
    m = re.search(r"\*\*([A-H](?:\s*,\s*[A-H])+)\*\*\s*(?:hoặc|or)\s*\*\*([A-H])\*\*", context)
    if m:
        for letter in [x.strip() for x in m.group(1).split(",")] + [m.group(2)]:
            found.setdefault(letter, letter)
    for m in re.finditer(r"(?<![\w/])([A-Z])\s*/\s*([A-Z])(?![\w/])", context):
        for letter in m.groups():
            found.setdefault(letter, letter)
    return [{"key": k, "text": v} for k, v in found.items()] if len(found) >= 2 else []


STOP = {"part", "khoi", "dap", "an", "va", "cho", "the", "a", "cua", "bai", "phan", "voi", "mot", "trong", "la", "chi", "doan", "duoi", "dua", "vao", "tts"}


def best_subsection(group_title: str, md: str) -> str | None:
    """Pick the answer sub-section whose heading best matches a group heading."""
    gt = {t for t in tokens(group_title) if t not in STOP}
    if not gt:
        return None
    best, best_score = None, 0.0
    for level in (2, 3, 4):
        _, sections = split_by_heading(md, level)
        for sec in sections:
            st = {t for t in tokens(sec.title) if t not in STOP}
            inter = gt & st
            if not inter:
                continue
            has_digit = any(t.isdigit() or re.search(r"\d", t) for t in inter)
            if not has_digit and len(inter) < 2:
                continue
            score = len(inter) / len(gt | st) + (0.5 if has_digit else 0)
            if score > best_score:
                best, best_score = sec.body, score
    return best


# --------------------------------------------------------------------------- transcripts

def parse_dialogue_lines(md: str) -> list[dict]:
    lines = []
    for raw in md.split("\n"):
        s = raw.strip().lstrip(">").strip()
        m = re.match(r"^\*\*([^*:]{1,40}?):?\*\*:?\s*(.+)$", s)
        if m and len(m.group(1).split()) <= 4:
            lines.append({"speaker": strip_md(m.group(1)).rstrip(":"), "text": strip_md(m.group(2))})
        elif s and not s.startswith(("⚠️", "|", "#")) and not re.match(r"^\(.*\)$", s):
            text = strip_md(s)
            if text:
                lines.append({"speaker": "", "text": text})
    return lines


def find_transcript(group_title: str, group_text: str, sources: list[str]) -> str | None:
    code = re.search(r"\b([A-Z]\d{2}-T\d+[a-z]?)\b", group_text + " " + group_title)
    for src in sources:
        for level in (2, 3, 4):
            _, sections = split_by_heading(src, level)
            for sec in sections:
                if code and code.group(1) in sec.title:
                    return sec.body
    candidates = []
    for src in sources:
        for level in (2, 3, 4):
            _, sections = split_by_heading(src, level)
            for sec in sections:
                t = fold(sec.title)
                if any(w in t for w in ("transcript", "recording", "listening", "bai nghe", "doan nghe")):
                    candidates.append(sec)
    gt = {t for t in tokens(group_title) if t not in STOP}
    best, score = None, 0.0
    for sec in candidates:
        st = {t for t in tokens(sec.title) if t not in STOP}
        inter = gt & st
        if not inter:
            continue
        has_digit = any(re.search(r"\d", t) for t in inter)
        s = len(inter) / len(gt | st) + (0.5 if has_digit else 0)
        if (has_digit or len(inter) >= 2) and s > score:
            best, score = sec.body, s
    return best


def clean_answer_text(md: str) -> str:
    return strip_md(md)


def key_bold(md: str) -> list[str]:
    return bold_segments(md)
