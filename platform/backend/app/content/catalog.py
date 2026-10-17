"""Discover curriculum documents and describe them as learning units.

A *unit* is anything a learner can open in the Lesson Player (grammar lesson,
vocabulary topic, skills chapter, lab, exam). Every other Markdown file is a
*reference document* that can be read in Reference Mode.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from pathlib import Path, PurePosixPath

from .md import first_heading, fold, parse_tables, strip_md

LEVELS = ["A0", "A1", "A2", "B1", "B2"]
LEVEL_DIRS = {
    "A0": "01-A0-FOUNDATION",
    "A1": "02-A1-BEGINNER",
    "A2": "03-A2-ELEMENTARY",
    "B1": "04-B1-INTERMEDIATE",
    "B2": "05-B2-UPPER-INTERMEDIATE",
}
LEVEL_NAMES = {
    "A0": "Foundation",
    "A1": "Beginner",
    "A2": "Elementary",
    "B1": "Intermediate",
    "B2": "Upper-Intermediate",
}
EXCLUDED_DIRS = {"platform", "node_modules", ".git", ".venv", "99-PROJECT"}

MODULES = {
    "grammar": "Grammar",
    "vocabulary": "Vocabulary",
    "pronunciation": "Pronunciation",
    "listening": "Listening",
    "speaking": "Speaking",
    "reading": "Reading",
    "writing": "Writing",
    "skills": "Skills Practice",
    "communication": "Communication",
    "practice": "Practice Lab",
    "exam": "Exams",
}


@dataclass
class Unit:
    id: str
    kind: str
    level: str | None
    title: str
    title_vi: str
    path: str
    order: int
    answer_path: str | None = None
    answer_anchor: str | None = None
    transcript_paths: list[str] = field(default_factory=list)
    prerequisites: list[str] = field(default_factory=list)
    minutes: int | None = None
    block: str | None = None
    block_title: str | None = None
    summary: str = ""

    def public(self) -> dict:
        d = asdict(self)
        d.pop("answer_anchor", None)
        d.pop("transcript_paths", None)
        d["module"] = MODULES.get(self.kind, self.kind)
        return d


LINK_RE = re.compile(r"\]\(([^)\s]+?\.md)(#[^)\s]*)?\)")


def rel(root: Path, p: Path) -> str:
    return p.relative_to(root).as_posix()


def resolve_link(root: Path, doc: Path, target: str) -> Path | None:
    if target.startswith(("http://", "https://", "mailto:")):
        return None
    p = (doc.parent / target).resolve()
    try:
        p.relative_to(root)
    except ValueError:
        return None
    return p if p.exists() else None


def split_title(h1: str, code: str) -> tuple[str, str]:
    t = h1
    if "·" in t:
        t = t.split("·", 1)[1].strip()
    t = re.sub(r"^[^\w(]+", "", t).strip()  # drop leading emoji
    if code and t.upper().startswith(code.upper()):
        t = t[len(code):].lstrip(" ·:—-")
    parts = re.split(r"\s+—\s+", t, maxsplit=1)
    en = strip_md(parts[0]).strip()
    vi = strip_md(parts[1]).strip() if len(parts) > 1 else ""
    return en, vi


def unit_code(stem: str) -> str:
    m = re.match(r"^((?:VOC|PRON|LAB)-\d+|[LSRW]\d{2})\b", stem, re.I)
    return m.group(1).upper() if m else stem.upper()


def lesson_meta(md: str) -> dict:
    """Read the `A. Lesson Information` table of grammar lessons."""
    meta: dict = {}
    for table in parse_tables(md)[:2]:
        for row in table.rows:
            if len(row) < 2:
                continue
            k = fold(strip_md(row[0]))
            if "prerequisite" in k:
                meta["prerequisites"] = sorted(set(re.findall(r"\b([AB][012]-G\d{3})\b", row[1])))
            elif "estimated time" in k:
                m = re.search(r"(\d+)", row[1])
                if m:
                    meta["minutes"] = int(m.group(1))
    return meta


def parse_blocks(readme: str, level: str) -> list[tuple[str, str, int, int]]:
    """Find the curriculum's own lesson blocks (`Khối 1 … G001–G005`)."""
    blocks: list[tuple[str, str, int, int]] = []
    seen: set[tuple[int, int]] = set()
    for line in readme.split("\n"):
        for m in re.finditer(r"G(\d{3})\s*[–\-]\s*G(\d{3})", line):
            lo, hi = int(m.group(1)), int(m.group(2))
            if (lo, hi) in seen or hi < lo:
                continue
            km = re.search(r"Khối\s*(?:<br/>)?\s*((?:[AB][012]-)?\d+)", line) or re.search(r"\|\s*((?:[AB][012]-)?\d+)\s*\|", line)
            if not km:
                continue
            name = km.group(1)
            if not name.startswith(level):
                name = f"{level}-{name}"
            label = ""
            mm = re.search(r'\["Khối \d+<br/>(.*?)<br/>G\d', line)
            if mm:
                label = re.sub(r"<br/>", " ", mm.group(1))
            else:
                cells = [strip_md(c) for c in line.split("|") if c.strip()]
                if len(cells) >= 3:
                    label = cells[2][:80]
            seen.add((lo, hi))
            blocks.append((name, label, lo, hi))
    blocks.sort(key=lambda b: b[2])
    return blocks


def discover(root: Path) -> tuple[list[Unit], list[str]]:
    units: list[Unit] = []
    order = 0

    def add(u: Unit) -> None:
        nonlocal order
        u.order = order
        order += 1
        units.append(u)

    for level in LEVELS:
        d = root / LEVEL_DIRS[level]
        readme = (d / "README.md").read_text(encoding="utf-8") if (d / "README.md").exists() else ""
        blocks = parse_blocks(readme, level)
        for f in sorted((d / "grammar").glob(f"{level}-G*.md")):
            lid = f.stem[:7]
            md = f.read_text(encoding="utf-8")
            en, vi = split_title(first_heading(md) or lid, lid)
            meta = lesson_meta(md)
            num = int(lid[-3:])
            block = next((b for b in blocks if b[2] <= num <= b[3]), None)
            if block is None:
                start = (num - 1) // 5 * 5 + 1
                block = (f"{level}-{(num - 1) // 5 + 1}", "", start, start + 4)
            ans = root / "12-ANSWERS-AND-EXPLANATIONS" / level / f"{lid}-ANSWERS.md"
            add(Unit(
                id=lid, kind="grammar", level=level, title=en, title_vi=vi, path=rel(root, f), order=0,
                answer_path=rel(root, ans) if ans.exists() else None,
                prerequisites=meta.get("prerequisites", []), minutes=meta.get("minutes"),
                block=block[0], block_title=block[1],
            ))
        for name, kind in ((f"{level}-COMMUNICATION.md", "communication"), (f"{level}-SKILLS-PRACTICE.md", "skills")):
            f = d / name
            if f.exists():
                add(_generic_unit(root, f, kind, level))

    for f in sorted((root / "07-VOCABULARY").glob("VOC-*.md")):
        add(_generic_unit(root, f, "vocabulary", None))
    for f in sorted((root / "08-PRONUNCIATION").glob("PRON-*.md")):
        add(_generic_unit(root, f, "pronunciation", None))
    for sub, kind in (("Listening", "listening"), ("Speaking", "speaking"), ("Reading", "reading"), ("Writing", "writing")):
        for f in sorted((root / "09-FOUR-SKILLS" / sub).glob("[LSRW][0-9][0-9]-*.md")):
            add(_generic_unit(root, f, kind, None))
    for f in sorted((root / "10-PRACTICE-LAB").glob("LAB-*.md")):
        add(_generic_unit(root, f, "practice", None))
    placement = root / "00-GETTING-STARTED" / "PLACEMENT-TEST.md"
    if placement.exists():
        add(_generic_unit(root, placement, "exam", None))
    for f in sorted((root / "11-EXAMS-AND-ASSESSMENTS").glob("*.md")):
        if f.name in ("README.md", "SKILL-EVALUATION-RUBRICS.md"):
            continue
        lvl = f.name[:2] if f.name[:2] in LEVELS else None
        add(_generic_unit(root, f, "exam", lvl))

    unit_paths = {u.path for u in units} | {u.answer_path for u in units if u.answer_path}
    refs = []
    for f in sorted(root.rglob("*.md")):
        parts = set(f.relative_to(root).parts)
        if parts & EXCLUDED_DIRS:
            continue
        r = rel(root, f)
        if r not in unit_paths:
            refs.append(r)
    return units, refs


def _generic_unit(root: Path, f: Path, kind: str, level: str | None) -> Unit:
    md = f.read_text(encoding="utf-8")
    code = unit_code(f.stem)
    en, vi = split_title(first_heading(md) or code, code)
    answer_path, anchor, transcripts = None, None, []
    for m in LINK_RE.finditer(md):
        target = resolve_link(root, f, m.group(1))
        if target is None:
            continue
        r = rel(root, target)
        name = target.name.upper()
        if "TRANSCRIPT" in name:
            if r not in transcripts:
                transcripts.append(r)
        elif ("12-ANSWERS-AND-EXPLANATIONS" in r or name == "PLACEMENT-ANSWERS.MD") and answer_path is None:
            answer_path = r
            anchor = (m.group(2) or "").lstrip("#") or None
    if level is None:
        lm = re.search(r"\b(A0|A1|A2|B1|B2)\b", f.stem.upper())
        level = lm.group(1) if lm and kind not in ("vocabulary", "practice") else None
    return Unit(id=code, kind=kind, level=level, title=en, title_vi=vi, path=rel(root, f), order=0,
                answer_path=answer_path, answer_anchor=anchor, transcript_paths=transcripts)


def doc_title(root: Path, relpath: str) -> str:
    p = root / PurePosixPath(relpath)
    try:
        h = first_heading(p.read_text(encoding="utf-8"))
    except OSError:
        return relpath
    return strip_md(re.sub(r"^[^\w(]+", "", h or relpath))
