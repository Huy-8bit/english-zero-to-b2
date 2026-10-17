"""Small, dependency-free Markdown helpers used by the content engine.

The curriculum is plain GitHub-flavoured Markdown. We only need to split it by
headings, read pipe tables and strip inline markup for search/grading; the
frontend renders the Markdown itself (sanitised).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
FENCE_RE = re.compile(r"^\s*(```|~~~)")


@dataclass
class Section:
    level: int
    title: str
    body: str  # markdown below the heading, excluding deeper-level splitting
    line: int
    children: list["Section"] = field(default_factory=list)


def fold(text: str) -> str:
    """Lowercase and remove Vietnamese diacritics (for search and matching)."""
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text.lower()


def strip_md(text: str) -> str:
    """Remove the inline Markdown we use (emphasis, code, links) → plain text."""
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"~~(.*?)~~", r"\1", text)
    text = re.sub(r"(\*\*|__)(.*?)\1", r"\2", text)
    text = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def bold_segments(text: str) -> list[str]:
    return [strip_md(m.group(2)) for m in re.finditer(r"(\*\*|__)(.+?)\1", text)]


def iter_lines_outside_fences(md: str):
    """Yield (index, line, in_fence) so heading/label detection can skip code."""
    in_fence = False
    for i, line in enumerate(md.split("\n")):
        if FENCE_RE.match(line):
            yield i, line, True
            in_fence = not in_fence
            continue
        yield i, line, in_fence


def split_by_heading(md: str, level: int) -> tuple[str, list[Section]]:
    """Split markdown at headings of exactly `level` (ignoring fenced code).

    Returns (preamble, sections). Each section body keeps its deeper headings.
    """
    lines = md.split("\n")
    preamble: list[str] = []
    sections: list[Section] = []
    current: Section | None = None
    buf: list[str] = []
    for i, line, fenced in iter_lines_outside_fences(md):
        m = None if fenced else HEADING_RE.match(line)
        if m and len(m.group(1)) == level:
            if current is not None:
                current.body = "\n".join(buf).strip("\n")
                sections.append(current)
            else:
                preamble = buf
            current = Section(level=level, title=m.group(2).strip(), body="", line=i)
            buf = []
        else:
            buf.append(line)
    if current is not None:
        current.body = "\n".join(buf).strip("\n")
        sections.append(current)
    else:
        preamble = buf
    del lines
    return "\n".join(preamble).strip("\n"), sections


def first_heading(md: str, level: int = 1) -> str | None:
    for _, line, fenced in iter_lines_outside_fences(md):
        if fenced:
            continue
        m = HEADING_RE.match(line)
        if m and len(m.group(1)) == level:
            return m.group(2).strip()
    return None


def split_row(line: str) -> list[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|") and not line.endswith("\\|"):
        line = line[:-1]
    cells, cur, in_code = [], [], False
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == "`":
            in_code = not in_code
        if ch == "\\" and i + 1 < len(line) and line[i + 1] == "|":
            cur.append("|")
            i += 2
            continue
        if ch == "|" and not in_code:
            cells.append("".join(cur).strip())
            cur = []
        else:
            cur.append(ch)
        i += 1
    cells.append("".join(cur).strip())
    return cells


SEP_RE = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")


@dataclass
class Table:
    header: list[str]
    rows: list[list[str]]
    start: int
    end: int


def parse_tables(md: str) -> list[Table]:
    lines = md.split("\n")
    tables: list[Table] = []
    i = 0
    fenced = False
    while i < len(lines):
        line = lines[i]
        if FENCE_RE.match(line):
            fenced = not fenced
            i += 1
            continue
        if not fenced and line.lstrip().startswith("|") and i + 1 < len(lines) and SEP_RE.match(lines[i + 1]):
            header = split_row(line)
            rows = []
            j = i + 2
            while j < len(lines) and lines[j].lstrip().startswith("|"):
                rows.append(split_row(lines[j]))
                j += 1
            tables.append(Table(header=header, rows=rows, start=i, end=j))
            i = j
            continue
        i += 1
    return tables


def slugify(text: str) -> str:
    """GitHub-style anchor slug (keeps Vietnamese letters, like GitHub does)."""
    text = strip_md(text).lower()
    text = re.sub(r"[^\w\- ]", "", text, flags=re.UNICODE)
    return text.replace(" ", "-")


def tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", fold(strip_md(text)))
