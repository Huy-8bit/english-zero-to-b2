"""In-memory content repository with change detection and search."""
from __future__ import annotations

import re
import threading
import time
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from .builder import BuiltUnit, build_unit
from .catalog import EXCLUDED_DIRS, Unit, discover, doc_title
from .md import fold, split_by_heading, strip_md


@dataclass
class SearchDoc:
    path: str
    title: str
    title_vi: str
    unit_id: str | None
    kind: str
    level: str | None
    headings: list[str]
    f_title: str
    f_headings: str
    f_body: str
    body: str


class ContentStore:
    def __init__(self, root: Path, reload_seconds: float = 3.0):
        self.root = root
        self.reload_seconds = reload_seconds
        self._lock = threading.RLock()
        self._checked = 0.0
        self._sig: tuple | None = None
        self.units: dict[str, Unit] = {}
        self.unit_list: list[Unit] = []
        self.refs: list[str] = []
        self._built: dict[str, BuiltUnit] = {}
        self._search: list[SearchDoc] = []
        self.version = 0
        self.refresh(force=True)

    # ----------------------------------------------------------- lifecycle
    def _signature(self) -> tuple:
        newest, count = 0.0, 0
        for p in self.root.rglob("*.md"):
            if set(p.relative_to(self.root).parts) & EXCLUDED_DIRS:
                continue
            count += 1
            newest = max(newest, p.stat().st_mtime)
        return (count, newest)

    def refresh(self, force: bool = False) -> bool:
        with self._lock:
            now = time.monotonic()
            if not force and now - self._checked < self.reload_seconds:
                return False
            self._checked = now
            sig = self._signature()
            if not force and sig == self._sig:
                return False
            self._sig = sig
            units, refs = discover(self.root)
            self.unit_list = units
            self.units = {u.id: u for u in units}
            self.refs = refs
            self._built = {}
            self._search = []
            self.version += 1
            return True

    # ----------------------------------------------------------- units
    def unit(self, unit_id: str) -> Unit | None:
        self.refresh()
        return self.units.get(unit_id)

    def built(self, unit_id: str) -> BuiltUnit | None:
        self.refresh()
        with self._lock:
            if unit_id not in self.units:
                return None
            if unit_id not in self._built:
                self._built[unit_id] = build_unit(self.root, self.units[unit_id])
            return self._built[unit_id]

    def item(self, item_id: str):
        unit_id = item_id.split(":", 1)[0]
        b = self.built(unit_id)
        return b.items.get(item_id) if b else None

    def all_built(self) -> list[BuiltUnit]:
        return [b for u in list(self.unit_list) if (b := self.built(u.id))]

    def cards(self) -> list[dict]:
        out = []
        for u in self.unit_list:
            if u.kind == "vocabulary":
                b = self.built(u.id)
                if b:
                    out.extend(b.cards)
        return out

    # ----------------------------------------------------------- documents
    def resolve_doc(self, relpath: str) -> Path | None:
        rp = PurePosixPath(relpath)
        if rp.is_absolute() or ".." in rp.parts or rp.suffix.lower() != ".md":
            return None
        if set(rp.parts) & EXCLUDED_DIRS:
            return None
        p = (self.root / rp).resolve()
        try:
            p.relative_to(self.root)
        except ValueError:
            return None
        return p if p.is_file() else None

    def unit_for_path(self, relpath: str) -> Unit | None:
        self.refresh()
        for u in self.unit_list:
            if u.path == relpath:
                return u
        return None

    # ----------------------------------------------------------- search
    def _index(self) -> list[SearchDoc]:
        with self._lock:
            if self._search:
                return self._search
            docs = []
            paths = [(u.path, u) for u in self.unit_list] + [(r, None) for r in self.refs]
            for path, unit in paths:
                p = self.root / path
                try:
                    md = p.read_text(encoding="utf-8")
                except OSError:
                    continue
                headings = [strip_md(h) for h in re.findall(r"^#{2,3}\s+(.*)$", md, re.M)]
                title = unit.title if unit else doc_title(self.root, path)
                title_vi = unit.title_vi if unit else ""
                body = strip_md(re.sub(r"```.*?```", " ", md, flags=re.S))
                docs.append(SearchDoc(
                    path=path, title=title, title_vi=title_vi, unit_id=unit.id if unit else None,
                    kind=unit.kind if unit else "reference", level=unit.level if unit else None, headings=headings,
                    f_title=fold(f"{unit.id if unit else ''} {title} {title_vi}"), f_headings=fold(" | ".join(headings)),
                    f_body=fold(body), body=body,
                ))
            self._search = docs
            return docs

    def search(self, query: str, limit: int = 30) -> list[dict]:
        self.refresh()
        q = fold(query).strip()
        if len(q) < 2:
            return []
        terms = [t for t in re.findall(r"\w+", q) if len(t) > 1 or t.isdigit()]
        results = []
        for d in self._index():
            score = 0.0
            if q in d.f_title:
                score += 40
            if q in d.f_headings:
                score += 12
            body_hits = d.f_body.count(q)
            score += min(body_hits, 10) * 2
            for t in terms:
                if re.search(rf"\b{re.escape(t)}", d.f_title):
                    score += 6
                if re.search(rf"\b{re.escape(t)}", d.f_headings):
                    score += 2
                score += min(len(re.findall(rf"\b{re.escape(t)}", d.f_body)), 6) * 0.3
            if terms and not all(re.search(rf"\b{re.escape(t)}", d.f_title + " " + d.f_headings + " " + d.f_body) for t in terms):
                score *= 0.25
            if d.unit_id and d.kind == "grammar":
                score *= 1.15
            if score < 2:
                continue
            heading = next((h for h in d.headings if q in fold(h)), None) or next(
                (h for h in d.headings if terms and all(t in fold(h) for t in terms)), None)
            idx = d.f_body.find(q)
            if idx < 0 and terms:
                idx = d.f_body.find(terms[0])
            snippet = d.body[max(0, idx - 80): idx + 160].replace("\n", " ") if idx >= 0 else d.body[:200]
            results.append({"score": round(score, 2), "path": d.path, "title": d.title, "title_vi": d.title_vi,
                            "unit_id": d.unit_id, "kind": d.kind, "level": d.level, "heading": heading,
                            "snippet": snippet.strip()})
        results.sort(key=lambda r: -r["score"])
        return results[:limit]

    def reference_docs(self) -> list[dict]:
        self.refresh()
        out = []
        for r in self.refs:
            top = r.split("/", 1)[0] if "/" in r else ""
            out.append({"path": r, "title": doc_title(self.root, r), "group": top or "root"})
        return out
