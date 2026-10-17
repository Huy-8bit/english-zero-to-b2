"""Turn one curriculum document into ordered Learning Steps.

Grammar lessons follow the A–N template, so each lettered section maps to a
slide type. Other units (vocabulary, skills chapters, labs, exams) are split at
their own headings; exercise groups become quiz steps. Section text is never
rewritten — slides carry the original Markdown, plus structured extras
(examples, mistakes, dialogue lines, word cards) parsed from it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .catalog import Unit
from .exercises import (
    AnswerKey,
    RawItem,
    bold_segments,
    choose_keys,
    code_options,
    heading_score,
    heading_block_key,
    label_candidates,
    strip_transcripts,
    extract_items,
    find_transcript,
    parse_answer_keys,
    parse_dialogue_lines,
    parse_options,
    parse_paren_choice,
    region_by_anchor,
)
from .md import fold, parse_tables, split_by_heading, strip_md

SPLIT_CHARS = 3600
EXERCISE_HEADING = re.compile(
    r"bai tap|bai luyen|luyen tap|thuc hanh|task|practice|exercise|\bpart\b|\btext\b|recording|passage|question|cau hoi"
    r"|\b(listening|reading|writing|speaking)\s*\d|kiem tra|\btest\b|\bbo\b|thu thach|challenge|tinh huong|role.?play"
)


@dataclass
class ServerItem:
    id: str
    unit_id: str
    quiz_id: str
    label: str
    kind: str
    options: list[dict] | None
    key: AnswerKey | None
    correct_option: str | None
    model_md: str
    explanation_md: str
    review: str = ""
    self_check_only: bool = False


@dataclass
class BuiltUnit:
    unit: Unit
    steps: list[dict]
    items: dict[str, ServerItem]
    cards: list[dict]
    warnings: list[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)


# --------------------------------------------------------------------- helpers

def _remove_lines(md: str, ranges: list[tuple[int, int]]) -> str:
    lines = md.split("\n")
    drop = set()
    for a, b in ranges:
        drop.update(range(a, b))
    return "\n".join(l for i, l in enumerate(lines) if i not in drop).strip()


def _col(header: list[str], *needles: str) -> int | None:
    for i, h in enumerate(header):
        fh = fold(strip_md(h))
        if any(n in fh for n in needles):
            return i
    return None


def _clean_intro(md: str) -> str:
    out = []
    skip = False
    for line in md.split("\n"):
        if re.match(r"^#\s", line):
            continue
        out.append(line)
    text = "\n".join(out).strip()
    text = re.sub(r"^(---\s*)+", "", text).strip()
    text = re.sub(r"(\n---\s*)+$", "", text).strip()
    del skip
    return text


def _trim_rules(md: str) -> str:
    md = re.sub(r"(\n\s*---\s*)+$", "", md.strip())
    md = re.sub(r"^(\s*---\s*\n)+", "", md)
    return md.strip()


def _is_toc(title: str) -> bool:
    t = fold(title)
    return "muc luc" in t or t.strip() in ("contents", "table of contents")


def _paren_answer_match(options: list[str], key: AnswerKey) -> str | None:
    cands = {_norm(x) for x in bold_segments(key.answer_md)} | {_norm(strip_md(key.answer_md))}
    hits = [o for o in options if _norm(o) in cands]
    return hits[0] if len(hits) == 1 else None


def _norm(s: str) -> str:
    from ..services.grading import normalize

    return normalize(s)


def _mc_correct(options: list[dict], key: AnswerKey | None) -> str | None:
    if key is None:
        return None
    text = strip_md(key.answer_md).strip()
    m = re.match(r"^([A-Z]{1,2})(?=$|[\s.,:;)(—-])", text)
    if m and any(o["key"] == m.group(1) for o in options):
        return m.group(1)
    nt = _norm(text)
    for o in options:
        if _norm(strip_md(o["text"])) == nt:
            return o["key"]
    for seg in bold_segments(key.answer_md):
        for o in options:
            if _norm(strip_md(o["text"])) == _norm(seg):
                return o["key"]
    return None


TF_WORDS = {"t": "T", "true": "T", "f": "F", "false": "F", "ng": "NG", "not given": "NG"}


def _tf_correct(key: AnswerKey | None) -> str | None:
    if key is None:
        return None
    t = fold(strip_md(key.answer_md)).strip()
    m = re.match(r"^(not given|true|false|ng|t|f)\b", t)
    return TF_WORDS[m.group(1)] if m else None


def classify(raw: RawItem, context: str, key: AnswerKey | None, hint: str | None = None) -> dict:
    """Decide how an item is answered in the UI (never changes its content)."""
    text = raw.text
    ctx = fold(context + " " + raw.instruction)
    ftext = fold(strip_md(text))
    out: dict = {"kind": "text", "prompt_md": text, "options": None, "prefill": None, "tokens": None, "multiline": False}

    opt = parse_options(text)
    if opt:
        prompt, options = opt
        out.update(kind="mc", prompt_md=prompt, options=options)
        return out
    if ("true" in ctx and "false" in ctx) or re.search(r"\bt\s*/\s*f\b", ctx) or "(t)" in ctx:
        options = [{"key": "T", "text": "True"}, {"key": "F", "text": "False"}]
        if "not given" in ctx or re.search(r"\bng\b", ctx):
            options.append({"key": "NG", "text": "Not Given"})
        if key is None or _tf_correct(key):
            out.update(kind="tfng", options=options)
            return out
    if key is not None:
        codes = code_options(context + "\n" + raw.instruction)
        lead = re.match(r"^([A-Z]{1,2})(?=$|[\s.,:;)(—-])", strip_md(key.answer_md).strip())
        if codes and lead and any(c["key"] == lead.group(1) for c in codes):
            out.update(kind="mc", options=codes)
            return out
    pc = parse_paren_choice(text)
    if pc and key is not None and _paren_answer_match(pc[0], key):
        out.update(kind="choice", options=[{"key": o, "text": o} for o in pc[0]])
        return out
    if ("sap xep" in ctx or "put the words in order" in ctx or "thu tu" in ctx) and text.count("/") >= 2:
        toks = [strip_md(t).strip() for t in re.sub(r"\(.*?\)\s*$", "", text).split("/") if strip_md(t).strip()]
        out.update(kind="order", tokens=toks)
        return out
    speaking = ftext.startswith(("speaking", "noi ", "noi:", "ghi am", "doc to", "doc lai to", "shadow", "tra loi to", "tu tra loi to", "role-play", "role play")) or "speaking —" in ftext or "speaking -" in ftext
    if speaking or (hint == "speaking" and (key is None or key.block)):
        out.update(kind="speaking", multiline=True)
        return out
    long_cue = re.search(r"\d+\s*[–-]\s*\d+\s*(tu|words)\b", ftext) or re.search(r"\b(doan van|email|bai luan|essay|paragraph|doan hoi thoai|cong thuc)\b", ftext)
    if long_cue or ftext.startswith(("viet ", "viet:")) or (key is not None and key.block and len(strip_md(key.answer_md)) > 220) \
            or (hint == "writing" and (key is None or key.block)):
        out.update(kind="long", multiline=True)
        return out
    if "sua loi" in ctx or "error" in ctx or "correction" in ctx:
        out.update(prefill=strip_md(re.sub(r"\(([^)]*)\)\s*$", "", text)).strip())
    if "dich" in ctx or "translat" in ctx or len(strip_md(text)) > 90:
        out["multiline"] = True
    return out


def _model_and_expl(key: AnswerKey | None) -> tuple[str, str]:
    if key is None:
        return "", ""
    return key.answer_md, key.explanation_md


# --------------------------------------------------------------------- builder

class StepBuilder:
    def __init__(self, root: Path, unit: Unit):
        self.root = root
        self.unit = unit
        self.steps: list[dict] = []
        self.items: dict[str, ServerItem] = {}
        self.cards: list[dict] = []
        self.warnings: list[str] = []
        self.md = (root / unit.path).read_text(encoding="utf-8")
        self.answer_md = ""
        if unit.answer_path and (root / unit.answer_path).exists():
            self.answer_md = (root / unit.answer_path).read_text(encoding="utf-8")
        self.region = region_by_anchor(self.answer_md, unit.answer_anchor) if self.answer_md else ""
        self.key_region = strip_transcripts(self.region) if self.region else ""
        self.region_keys = parse_answer_keys(self.key_region) if self.key_region else {}
        self.transcript_sources = [self.region] if self.region else []
        for tp in unit.transcript_paths:
            p = root / tp
            if p.exists():
                self.transcript_sources.append(p.read_text(encoding="utf-8"))
        self._label_counts: dict[str, int] = {}
        self._quiz_n = 0

    # -- step helpers
    def add(self, step: dict) -> None:
        step["id"] = f"s{len(self.steps) + 1}"
        step.setdefault("md", "")
        self.steps.append(step)

    def concept(self, title: str, md: str, section: str = "", stype: str = "concept") -> None:
        md = _trim_rules(md)
        if not md.strip():
            return
        if len(md) > SPLIT_CHARS:
            _, subs = split_by_heading(md, 3)
            if len(subs) >= 2:
                pre = md.split("\n### ", 1)[0].strip()
                if pre and not pre.startswith("### "):
                    self.add({"type": stype, "title": title, "section": section, "md": _trim_rules(pre)})
                for sub in subs:
                    self.add({"type": stype, "title": f"{title} — {strip_md(sub.title)}", "section": section,
                              "md": _trim_rules(f"### {sub.title}\n\n{sub.body}")})
                return
        self.add({"type": stype, "title": title, "section": section, "md": md})

    # -- items
    def _new_quiz_id(self) -> str:
        self._quiz_n += 1
        return f"{self.unit.id}:q{self._quiz_n}"

    def make_items(self, raws: list[RawItem], context: str, keys: dict[str, AnswerKey], fallback_keys: dict[str, AnswerKey] | None,
                   quiz_id: str, group_index: int, hint: str | None = None) -> list[dict]:
        public = []
        current_instr = ""
        for raw in raws:
            current_instr = raw.instruction or current_instr
            key = None
            for cand in label_candidates(raw.label):
                key = keys.get(cand) or (fallback_keys.get(cand) if fallback_keys is not None else None)
                if key:
                    break
            if key is None and self.unit.kind != "grammar" and self.key_region:
                key = heading_block_key(raw.label, self.key_region)
            info = classify(raw, context + "\n" + current_instr, key, hint)
            correct = None
            if info["kind"] == "mc":
                correct = _mc_correct(info["options"], key)
            elif info["kind"] == "tfng":
                correct = _tf_correct(key)
            elif info["kind"] == "choice":
                correct = _paren_answer_match([o["key"] for o in info["options"]], key) if key else None
            iid = f"{self.unit.id}:{raw.label}"
            if iid in self.items:
                iid = f"{self.unit.id}:{group_index}-{raw.label}"
            model, expl = _model_and_expl(key)
            self.items[iid] = ServerItem(
                id=iid, unit_id=self.unit.id, quiz_id=quiz_id, label=raw.label, kind=info["kind"],
                options=info["options"], key=key, correct_option=correct, model_md=model, explanation_md=expl,
                review=key.review if key else "", self_check_only=key is None,
            )
            if key is None and info["kind"] not in ("speaking", "long"):
                self.warnings.append(f"no-answer {iid}")
            if info["kind"] in ("mc", "tfng", "choice") and key is not None and correct is None:
                self.warnings.append(f"mc-unresolved {iid}")
            public.append({
                "id": iid, "label": raw.label, "kind": info["kind"], "prompt_md": info["prompt_md"],
                "instruction_md": raw.instruction, "options": info["options"], "prefill": info["prefill"],
                "tokens": info["tokens"], "multiline": info["multiline"], "has_key": key is not None,
            })
        return public

    def quiz_step(self, title: str, body: str, section: str = "", keys: dict | None = None, fallback: dict | None = None,
                  numbered: bool = False, group_index: int = 0, extra: dict | None = None) -> bool:
        intro, raws = extract_items(body, numbered=numbered)
        if not raws:
            return False
        quiz_id = self._new_quiz_id()
        ft = fold(title)
        hint = None
        if self.unit.kind == "speaking" or re.search(r"\b(speaking|noi)\b", ft):
            hint = "speaking"
        elif self.unit.kind == "writing" or re.search(r"\b(writing)\b", ft):
            hint = "writing"
        items = self.make_items(raws, title + " " + intro, keys if keys is not None else self.region_keys, fallback, quiz_id,
                                group_index, hint)
        step = {"type": "quiz", "title": title, "section": section, "quiz_id": quiz_id, "intro_md": _trim_rules(intro),
                "items": items, "variant": None, "defer": self.unit.kind == "exam"}
        if extra:
            step.update(extra)
        self.add(step)
        return True

    # ------------------------------------------------------------- grammar
    def build_grammar(self) -> None:
        _, secs = split_by_heading(self.md, 2)
        for sec in secs:
            m = re.match(r"^([A-N])\.\s*(.*)$", sec.title)
            if not m:
                if not _is_toc(sec.title):
                    self.concept(strip_md(sec.title), sec.body)
                continue
            letter, rest = m.group(1), strip_md(m.group(2))
            body = sec.body
            if letter == "A":
                self.add({"type": "intro", "title": "Giới thiệu bài học", "section": "A", "md": _trim_rules(body)})
            elif letter in ("B", "C", "D", "J"):
                titles = {"B": "Khởi động", "J": "Mẹo ghi nhớ"}
                self.concept(titles.get(letter, rest), body, letter)
            elif letter == "E":
                self.formula(rest, body)
            elif letter == "F":
                self.examples(rest, body)
            elif letter == "G":
                stype = "timeline" if "timeline" in fold(body) else "concept"
                self.concept(rest or "Minh họa", body, letter, stype)
            elif letter == "H":
                self.concept(rest or "So sánh", body, letter, "comparison")
            elif letter == "I":
                self.mistakes(rest or "Lỗi thường gặp", body)
            elif letter == "K":
                self.real_life(rest, body)
            elif letter == "L":
                self.practice(body)
            elif letter == "M":
                self.knowledge_check(body)
            elif letter == "N":
                continue

    def formula(self, title: str, body: str) -> None:
        symbols = {}
        m = re.search(r"\*\*Ký hiệu:?\*\*:?(.*?)(?:\n\s*\n(?!\s*[-*] )|\Z)", body, re.S)
        if m:
            for part in re.split(r"\s+·\s+|;\s+|\n", m.group(1)):
                pm = re.match(r"\s*(?:[-*]\s+)?\*\*(.+?)\*\*\s*[=:]\s*(.+)", part)
                if pm:
                    symbols[strip_md(pm.group(1))] = strip_md(pm.group(2)).rstrip(".")
        if len(body) > SPLIT_CHARS:
            _, subs = split_by_heading(body, 3)
            if len(subs) >= 2:
                pre = body.split("\n### ", 1)[0].strip()
                if pre:
                    self.add({"type": "formula", "title": title, "section": "E", "md": _trim_rules(pre), "symbols": symbols})
                for sub in subs:
                    self.add({"type": "formula", "title": f"{title} — {strip_md(sub.title)}", "section": "E",
                              "md": _trim_rules(f"### {sub.title}\n\n{sub.body}"), "symbols": symbols})
                return
        self.add({"type": "formula", "title": title, "section": "E", "md": _trim_rules(body), "symbols": symbols})

    def _example_rows(self, md: str) -> tuple[list[dict], str]:
        examples, ranges = [], []
        for t in parse_tables(md):
            en = _col(t.header, "english", "tieng anh", "example", "vi du")
            vi = _col(t.header, "tieng viet", "vietnamese", "nghia")
            if en is None or vi is None or en == vi:
                continue
            note = _col(t.header, "phan tich", "bang chung", "ghi chu", "analysis")
            use = _col(t.header, "cach dung", "use", "chuc nang")
            for row in t.rows:
                if en >= len(row) or not strip_md(row[en]):
                    continue
                examples.append({
                    "en": row[en], "vi": row[vi] if vi < len(row) else "",
                    "note": row[note] if note is not None and note < len(row) else "",
                    "use": row[use] if use is not None and use < len(row) else "",
                })
            ranges.append((t.start, t.end))
        return examples, _remove_lines(md, ranges)

    def examples(self, title: str, body: str) -> None:
        pre, subs = split_by_heading(body, 3)
        groups = [(title, pre)] + [(f"{title} — {strip_md(s.title)}", s.body) for s in subs] if subs else [(title, body)]
        for gtitle, gmd in groups:
            if not gmd.strip():
                continue
            ex, rest = self._example_rows(gmd)
            if ex:
                self.add({"type": "examples", "title": gtitle, "section": "F", "examples": ex, "md": _trim_rules(rest)})
            else:
                self.concept(gtitle, gmd, "F")

    def mistakes(self, title: str, body: str) -> None:
        rows, ranges = [], []
        for t in parse_tables(body):
            wrong = _col(t.header, "sai", "wrong", "❌")
            right = _col(t.header, "dung", "correct", "✅")
            if wrong is None or right is None or wrong == right:
                continue
            cause = _col(t.header, "nguyen nhan", "ly do", "why")
            tip = _col(t.header, "cach tranh", "tip", "ghi nho")
            for row in t.rows:
                if wrong < len(row) and right < len(row):
                    rows.append({"wrong": row[wrong], "right": row[right],
                                 "cause": row[cause] if cause is not None and cause < len(row) else "",
                                 "tip": row[tip] if tip is not None and tip < len(row) else ""})
            ranges.append((t.start, t.end))
        if rows:
            self.add({"type": "mistakes", "title": title, "section": "I", "mistakes": rows, "md": _trim_rules(_remove_lines(body, ranges))})
        else:
            self.concept(title, body, "I")

    def real_life(self, title: str, body: str) -> None:
        quote_lines = [l for l in body.split("\n") if l.strip().startswith(">")]
        quote = "\n".join(quote_lines)
        lines = [l for l in parse_dialogue_lines(quote) if l["speaker"]]
        heading = title or "Ứng dụng thực tế"
        if len(lines) >= 2:
            rest = "\n".join(l for l in body.split("\n") if not l.strip().startswith(">"))
            self.add({"type": "dialogue", "title": heading, "section": "K", "lines": parse_dialogue_lines(quote), "md": _trim_rules(rest)})
        else:
            tts = " ".join(l["text"] for l in parse_dialogue_lines(quote))
            self.add({"type": "passage", "title": heading, "section": "K", "md": _trim_rules(body), "tts": tts})

    def practice(self, body: str) -> None:
        pre, subs = split_by_heading(body, 3)
        for i, sub in enumerate(subs):
            title = strip_md(sub.title)
            sub_body = sub.body
            if i == 0 and pre.strip():
                note = re.sub(r">\s*✍️.*\n?", "", pre).strip()
                if note:
                    sub_body = note + "\n\n" + sub_body
            if not self.quiz_step(title, sub_body, "L", keys=self.region_keys, group_index=i):
                self.concept(title, sub_body, "L")

    def knowledge_check(self, body: str) -> None:
        kc_answers = []
        if self.answer_md:
            m = re.search(r"^## Knowledge Check\s*\n(.*?)(?=^## |\Z)", self.answer_md, re.S | re.M)
            if m:
                kc_answers = re.findall(r"^\d+\.\s+(.*)$", m.group(1), re.M)
        _, subs = split_by_heading(body, 3)
        recap_parts, checklist = [], []
        for sub in subs:
            t = fold(sub.title)
            if "cau hoi" in t:
                qs = re.findall(r"^(\d+)\.\s+(.*)$", sub.body, re.M)
                if qs:
                    quiz_id = self._new_quiz_id()
                    items = []
                    for num, q in qs:
                        iid = f"{self.unit.id}:KC{num}"
                        ans = kc_answers[int(num) - 1] if int(num) - 1 < len(kc_answers) else ""
                        key = AnswerKey(label=f"KC{num}", answer_md=ans, block=True) if ans else None
                        self.items[iid] = ServerItem(id=iid, unit_id=self.unit.id, quiz_id=quiz_id, label=f"KC{num}", kind="long",
                                                     options=None, key=key, correct_option=None, model_md=ans, explanation_md="",
                                                     self_check_only=True)
                        if not ans:
                            self.warnings.append(f"no-kc-answer {iid}")
                        items.append({"id": iid, "label": f"KC{num}", "kind": "long", "prompt_md": q, "instruction_md": "",
                                      "options": None, "prefill": None, "tokens": None, "multiline": True, "has_key": bool(ans)})
                    self.add({"type": "quiz", "title": "Tự kiểm tra kiến thức", "section": "M", "quiz_id": quiz_id,
                              "intro_md": "Trả lời bằng lời của bạn trước, rồi so với đáp án gợi ý và tự đánh giá.",
                              "items": items, "variant": "knowledge", "defer": False})
                    continue
            if "checklist" in t:
                checklist = [strip_md(x) for x in re.findall(r"^- \[ \]\s+(.*)$", sub.body, re.M)]
                checklist_md = sub.body
                recap_parts.append(("checklist", checklist_md))
                continue
            recap_parts.append((sub.title, sub.body))
        md = "\n\n".join(f"### {t}\n\n{b}" for t, b in recap_parts if t != "checklist")
        self.add({"type": "recap", "title": "Tổng kết bài học", "section": "M", "md": _trim_rules(md), "checklist": checklist})

    # ------------------------------------------------------------- generic
    def build_generic(self) -> None:
        pre, secs = split_by_heading(self.md, 2)
        intro = _clean_intro(pre)
        if intro and len(strip_md(intro)) > 20:
            self.add({"type": "intro", "title": "Giới thiệu", "section": "", "md": intro})
        gi = 0
        for sec in secs:
            if _is_toc(sec.title):
                continue
            title = strip_md(sec.title)
            body = sec.body
            if self.unit.kind == "vocabulary" and self._vocab_section(title, body):
                continue
            spre, subs = split_by_heading(body, 3)
            groups = [(f"{title} — {strip_md(s.title)}", s.body, s.title, sec.title) for s in subs] if subs else [(title, body, title, "")]
            if subs and spre.strip():
                gi += 1
                if not self._group(title, spre, title, "", gi):
                    self.concept(title, spre)
            for gtitle, gbody, specific, general in groups:
                gi += 1
                if not self._group(gtitle, gbody, specific, general, gi):
                    self.rich_concept(gtitle, gbody)
        if self.cards:
            self.add({"type": "flashcards", "title": "Ôn nhanh bằng flashcards", "section": "", "md": "",
                      "card_ids": [c["id"] for c in self.cards]})

    def _group(self, title: str, body: str, specific: str, general: str, gi: int) -> bool:
        is_exam = self.unit.kind == "exam"
        spec_ex = bool(EXERCISE_HEADING.search(fold(specific)))
        gen_ex = bool(EXERCISE_HEADING.search(fold(general)))
        intro, raws = extract_items(body)
        numbered = False
        bold_labels = bool(re.search(r"\*\*(?:L\d\.\d+|[A-Z]{0,3}\d{1,3})\.", self.md))
        if not raws and (is_exam or spec_ex) and self.key_region and not bold_labels:
            _, nraws = extract_items(body, numbered=True)
            if nraws:
                nkeys = choose_keys(specific, [r.label for r in nraws], self.key_region, general)
                if nkeys and sum(1 for r in nraws if r.label.upper() in nkeys) >= max(1, len(nraws) // 2):
                    raws, numbered = nraws, True
        if not raws and (is_exam or spec_ex) and re.search(r"\b(speaking|writing|noi|viet|ghi am|shadowing)\b", fold(specific + " " + general)):
            # numbered speaking/writing prompts: practised with recorder/editor + self-assessment
            _, nraws = extract_items(body, numbered=True)
            if nraws:
                raws, numbered = nraws, True
        if not raws:
            return self._task_without_items(title, body, specific, general, gi)
        if all(r.label.startswith("NV") for r in raws):
            # communication task after model phrases/dialogue: content slide + one task slide
            self.rich_concept(title, intro)
            task_md = "\n\n".join(f"**Nhiệm vụ {r.label[2:]}:** {r.text}" for r in raws)
            return self.quiz_step(f"{title} — Nhiệm vụ", task_md, keys={}, group_index=gi) or True
        if not (is_exam or spec_ex or gen_ex):
            return False  # bold-numbered lists inside explanations are content, not exercises
        labels = [r.label for r in raws]
        sub_keys = choose_keys(specific, labels, self.key_region, general) if self.key_region else None
        dup = self._duplicate_labels()
        keys = sub_keys or ({} if numbered else {k: v for k, v in self.region_keys.items() if k not in dup})
        fallback = None
        if not numbered and sub_keys:
            fallback = {k: v for k, v in self.region_keys.items() if k not in sub_keys and k not in dup}
        raw_title = f"{general} {specific}".strip()
        intro_text, _ = extract_items(body, numbered=numbered)
        extra: dict = {}
        ctx = fold(specific + " " + intro_text[:300])
        is_listening = (self.unit.kind == "listening" and "transcript" in fold(specific + intro_text)) or any(
            w in ctx for w in ("listening", "recording", "transcript", "bai nghe"))
        if is_listening and self.transcript_sources:
            tr = find_transcript(raw_title, body, self.transcript_sources)
            if tr:
                extra = {"variant": "listening", "transcript": {"md": _trim_rules(tr), "lines": parse_dialogue_lines(tr)}}
        if not extra and len(strip_md(intro_text)) > 350:
            extra = {"variant": "reading", "passage_md": _trim_rules(intro_text)}
        return self.quiz_step(title, body, keys=keys, fallback=fallback, numbered=numbered, group_index=gi, extra=extra)

    def _task_without_items(self, title: str, body: str, specific: str, general: str, gi: int) -> bool:
        """A writing/speaking task written as prose (e.g. "Part E — Writing") → one editor/recorder item."""
        f = fold(specific + " " + general)
        is_task_heading = self.unit.kind in ("exam", "skills", "writing", "speaking") and (
            EXERCISE_HEADING.search(f) or self.unit.kind in ("exam", "skills"))
        mode = "speaking" if re.search(r"\b(speaking|noi)\b", f) else "writing" if re.search(r"\b(writing|viet)\b", f) else None
        if not (is_task_heading and mode and len(strip_md(body)) > 40):
            return False
        model = ""
        if self.key_region:
            best, best_score = "", 0.0
            for level in (2, 3, 4):
                for sec in split_by_heading(self.key_region, level)[1]:
                    sc = heading_score(specific, general, sec.title)
                    if sc > best_score:
                        best, best_score = sec.body, sc
            model = best.strip()
        quiz_id = self._new_quiz_id()
        label = f"T{gi}"
        iid = f"{self.unit.id}:{label}"
        kind = "speaking" if mode == "speaking" else "long"
        key = AnswerKey(label=label, answer_md=model, block=True) if model else None
        self.items[iid] = ServerItem(id=iid, unit_id=self.unit.id, quiz_id=quiz_id, label=label, kind=kind, options=None,
                                     key=key, correct_option=None, model_md=model, explanation_md="", self_check_only=True)
        self.add({"type": "quiz", "title": title, "section": "", "quiz_id": quiz_id, "intro_md": "",
                  "items": [{"id": iid, "label": label, "kind": kind, "prompt_md": _trim_rules(body), "instruction_md": "",
                             "options": None, "prefill": None, "tokens": None, "multiline": True, "has_key": bool(model)}],
                  "variant": "task", "defer": self.unit.kind == "exam"})
        return True

    def rich_concept(self, title: str, body: str) -> None:
        """Concept slide, or a dialogue slide when the text contains a sample conversation."""
        quote = "\n".join(l for l in body.split("\n") if l.strip().startswith(">"))
        lines = parse_dialogue_lines(quote)
        if sum(1 for l in lines if l["speaker"]) >= 3 and len(body) <= SPLIT_CHARS:
            rest = "\n".join(l for l in body.split("\n") if not l.strip().startswith(">"))
            self.add({"type": "dialogue", "title": title, "section": "", "lines": lines, "md": _trim_rules(rest)})
        else:
            self.concept(title, body)

    def _duplicate_labels(self) -> set[str]:
        if not hasattr(self, "_dups"):
            from collections import Counter

            from .exercises import LABEL_RE

            c = Counter(m.group(1).upper() for m in LABEL_RE.finditer(self.md))
            self._dups = {k for k, v in c.items() if v > 1}
        return self._dups

    def _vocab_section(self, title: str, body: str) -> bool:
        """Word tables become interactive word lists + cards."""
        pre, subs = split_by_heading(body, 3)
        parts = [(strip_md(s.title), s.body) for s in subs] if subs else [(title, body)]
        made = False
        for ptitle, pbody in parts:
            words = []
            for t in parse_tables(pbody):
                w = _col(t.header, "tu", "word", "collocation", "cum", "phrasal")
                mean = _col(t.header, "nghia", "meaning")
                if w is None or mean is None or w == mean:
                    continue
                pos = _col(t.header, "loai")
                ipa = _col(t.header, "ipa", "phat am")
                ex = _col(t.header, "vi du", "example")
                for row in t.rows:
                    if w >= len(row) or not strip_md(row[w]):
                        continue
                    word = strip_md(row[w])
                    cid = f"{self.unit.id}:{re.sub(r'[^a-z0-9]+', '-', fold(word)).strip('-')}"
                    if any(c["id"] == cid for c in self.cards):
                        continue
                    card = {"id": cid, "unit_id": self.unit.id, "word": word,
                            "pos": strip_md(row[pos]) if pos is not None and pos < len(row) else "",
                            "ipa": strip_md(row[ipa]) if ipa is not None and ipa < len(row) else "",
                            "meaning": row[mean] if mean < len(row) else "",
                            "example": row[ex] if ex is not None and ex < len(row) else "",
                            "topic": ptitle, "unit_title": self.unit.title}
                    self.cards.append(card)
                    words.append(card)
            if words:
                made = True
                self.add({"type": "vocab", "title": f"{title} — {ptitle}" if ptitle != title else title, "section": "",
                          "card_ids": [c["id"] for c in words], "md": ""})
            elif pbody.strip():
                if made or subs:
                    self.concept(f"{title} — {ptitle}" if ptitle != title else title, pbody)
        return made

    def build(self) -> BuiltUnit:
        if self.unit.kind == "grammar":
            self.build_grammar()
        else:
            self.build_generic()
        if not self.steps:
            self.warnings.append("no-steps")
        quiz_items = len(self.items)
        auto = sum(1 for it in self.items.values() if it.kind in ("mc", "tfng", "choice") and it.correct_option)
        keyed = sum(1 for it in self.items.values() if it.key is not None)
        return BuiltUnit(unit=self.unit, steps=self.steps, items=self.items, cards=self.cards, warnings=self.warnings,
                         stats={"steps": len(self.steps), "items": quiz_items, "auto_items": auto, "keyed_items": keyed})


def build_unit(root: Path, unit: Unit) -> BuiltUnit:
    return StepBuilder(root, unit).build()
