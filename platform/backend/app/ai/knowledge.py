"""Local retrieval over the curriculum Markdown (BM25 on diacritic-folded tokens).

Answer files are excluded so the tutor cannot leak exercise keys through retrieval.
Optional embedding re-ranking (AI_USE_EMBEDDINGS) only embeds the BM25 top candidates.
"""
from __future__ import annotations

import math
import re
import threading
from collections import Counter
from dataclasses import dataclass

from ..content.md import fold, split_by_heading, strip_md
from ..content.store import ContentStore

STOP = set("the a an and or of to in on at is are be for with this that it as by from vi la cac cua va co khong cho mot nhung de duoc trong khi thi".split())


@dataclass
class Chunk:
    chunk_id: str
    document_id: str
    lesson_id: str | None
    level: str | None
    module: str
    section_title: str
    content: str
    source_path: str
    content_version: int
    terms: Counter
    length: int

    def meta(self) -> dict:
        return {"document_id": self.document_id, "lesson_id": self.lesson_id, "level": self.level, "module": self.module,
                "section_title": self.section_title, "source_path": self.source_path, "content_version": self.content_version}


def _terms(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", fold(strip_md(text))) if t not in STOP and len(t) > 1]


class KnowledgeBase:
    def __init__(self, store: ContentStore):
        self.store = store
        self._version = -1
        self._chunks: list[Chunk] = []
        self._df: Counter = Counter()
        self._avg = 1.0
        self._lock = threading.Lock()

    def chunks(self) -> list[Chunk]:
        self.store.refresh()
        with self._lock:
            if self._version != self.store.version:
                self._build()
            return self._chunks

    def _build(self) -> None:
        chunks: list[Chunk] = []
        units_by_path = {u.path: u for u in self.store.unit_list}
        paths = [u.path for u in self.store.unit_list] + list(self.store.refs)
        for path in paths:
            if path.startswith("12-ANSWERS-AND-EXPLANATIONS/") or path.endswith("PLACEMENT-ANSWERS.md"):
                continue
            unit = units_by_path.get(path)
            try:
                md = (self.store.root / path).read_text(encoding="utf-8")
            except OSError:
                continue
            _, secs = split_by_heading(md, 2)
            for i, sec in enumerate(secs):
                title = strip_md(sec.title)
                if "muc luc" in fold(title) or fold(title).startswith(("n. answer", "l. practice")):
                    continue
                pre, subs = split_by_heading(sec.body, 3)
                parts = [(title, pre)] + [(f"{title} — {strip_md(s.title)}", s.body) for s in subs] if len(sec.body) > 3500 and subs else [(title, sec.body)]
                for j, (t, body) in enumerate(parts):
                    text = body.strip()
                    if len(text) < 40:
                        continue
                    terms = Counter(_terms(t + " " + text))
                    chunks.append(Chunk(
                        chunk_id=f"{path}#{i}.{j}", document_id=path, lesson_id=unit.id if unit else None,
                        level=unit.level if unit else None, module=unit.kind if unit else "reference", section_title=t,
                        content=text[:4000], source_path=path, content_version=self.store.version, terms=terms,
                        length=sum(terms.values())))
        df: Counter = Counter()
        for c in chunks:
            df.update(set(c.terms))
        self._chunks, self._df = chunks, df
        self._avg = sum(c.length for c in chunks) / max(1, len(chunks))
        self._version = self.store.version

    def search(self, query: str, *, lesson_id: str | None = None, k: int = 4, modules: tuple[str, ...] | None = None) -> list[Chunk]:
        chunks = self.chunks()
        q = _terms(query)
        if not q:
            return [c for c in chunks if lesson_id and c.lesson_id == lesson_id][:k]
        n = len(chunks)
        scored = []
        for c in chunks:
            if modules and c.module not in modules:
                continue
            s = 0.0
            for t in q:
                f = c.terms.get(t)
                if not f:
                    continue
                idf = math.log(1 + (n - self._df[t] + 0.5) / (self._df[t] + 0.5))
                s += idf * f * 2.4 / (f + 1.4 * (0.25 + 0.75 * c.length / self._avg))
            if lesson_id and c.lesson_id == lesson_id:
                s *= 1.6
            if s > 0:
                scored.append((s, c))
        scored.sort(key=lambda x: -x[0])
        return [c for _, c in scored[:k]]

    def lesson_sections(self, unit_id: str, letters: tuple[str, ...] = ("C", "D", "E", "F", "H", "I"), limit: int = 7000) -> str:
        """Teaching sections of a grammar lesson (or the first sections of other units) as grounding text."""
        unit = self.store.unit(unit_id)
        if unit is None:
            return ""
        md = (self.store.root / unit.path).read_text(encoding="utf-8")
        _, secs = split_by_heading(md, 2)
        out = []
        for sec in secs:
            m = re.match(r"^([A-N])\.", sec.title)
            if unit.kind == "grammar":
                if not m or m.group(1) not in letters:
                    continue
            elif "muc luc" in fold(sec.title):
                continue
            out.append(f"## {sec.title}\n{sec.body.strip()}")
        text = "\n\n".join(out)
        return text[:limit]

    def lesson_exercise_samples(self, unit_id: str, limit: int = 1500) -> str:
        unit = self.store.unit(unit_id)
        if unit is None or unit.kind != "grammar":
            return ""
        md = (self.store.root / unit.path).read_text(encoding="utf-8")
        m = re.search(r"^## L\..*?$(.*?)^## M\.", md, re.S | re.M)
        return (m.group(1).strip() if m else "")[:limit]


def format_chunks(chunks: list[Chunk]) -> str:
    return "\n\n".join(
        f'<curriculum source="{c.source_path}" lesson="{c.lesson_id or "-"}" level="{c.level or "-"}" section="{c.section_title}">\n'
        f"{c.content[:2500]}\n</curriculum>" for c in chunks)


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)
