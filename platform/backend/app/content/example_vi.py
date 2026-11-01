"""Vietnamese translations of the English example sentences in the lessons, shown under each italic example.

The curriculum Markdown stays unchanged. The examples are found by frontend/scripts/example-sentences.ts with the
same Markdown parser (and the same key) the lessons are rendered with; this module translates them once with the
configured AI model and serves each lesson's translations with its steps.

Data: data/example_vi.json = {"sentences": {key: {"vi": str, "wrong"?: true}}, "units": {unit_id: [key, ...]}}.
"wrong": the English is an intentional mistake shown by the lesson; "vi" is then the meaning it was meant to say.

Rebuild after the curriculum changes (only sentences without a translation go to the AI):
  python -m app.content.example_vi dump /tmp/lessons.json
  node ../frontend/scripts/example-sentences.ts /tmp/lessons.json /tmp/examples.json
  python -m app.content.example_vi translate /tmp/examples.json
  python -m app.content.example_vi review      # a stronger model checks new translations (meaning, mistake marks)
"""
from __future__ import annotations

import argparse
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

DATA = Path(__file__).parent / "data" / "example_vi.json"
BATCH = 40


@lru_cache(maxsize=1)
def _data() -> dict:
    if not DATA.exists():
        return {"sentences": {}, "units": {}}
    return json.loads(DATA.read_text("utf-8"))


def for_unit(unit_id: str) -> dict[str, dict]:
    """{key: {"vi": ..., "wrong"?: true}} for the examples of one lesson."""
    d = _data()
    out = {}
    for k in d["units"].get(unit_id, []):
        if (e := d["sentences"].get(k)) is not None:
            out[k] = {"vi": e["vi"], **({"wrong": True} if e.get("wrong") else {})}
    return out


# ------------------------------------------------------------------ build
def dump(store) -> dict:
    """Lesson text the extractor reads: Markdown of the teaching steps and the dialogue lines (no exercises, no
    reading passages, no exams; worked examples already carry their own translation)."""
    out = {}
    for u in store.unit_list:
        b = store.built(u.id)
        if u.kind == "exam" or b is None:
            continue
        md = [st.get("md") or "" for st in b.steps if st.get("type") not in ("quiz", "passage", "examples")]
        lines = [ln["text"] for st in b.steps if st.get("type") == "dialogue" for ln in (st.get("lines") or []) if ln.get("speaker")]
        out[u.id] = {"md": md, "lines": lines}
    return out


class _Item(BaseModel):
    i: int
    vi: str
    wrong: bool = False


class _Batch(BaseModel):
    items: list[_Item]


INSTRUCTIONS = """You translate the English example sentences of an English grammar course into Vietnamese for \
Vietnamese learners. The lesson they come from is given.
- Natural, short Vietnamese that keeps what the lesson teaches: tense and aspect (present perfect "đã ... rồi" / \
"chưa", continuous "đang", future "sẽ", past "đã" when needed), modality, passive ("được/bị"), comparison, etc.
- The numbered lines are in lesson order and often belong together (a dialogue, a table, a pair of direct and \
reported speech): use the neighbouring lines as context (e.g. "our report on the chair" is where the report lies).
- Keep names of people and places. Do not add explanations or quotes around the translation.
- A list of words or phrases (separated by commas or slashes): translate each item and keep the separators.
- Ignore stress or linking marks.
- wrong=true ONLY when the English is clearly ungrammatical (an intentional mistake the lesson shows); then vi is the \
meaning the writer intended. Informal or British English is not wrong.
Return exactly one item per numbered input, with the same number i."""

def _check(src: str, vi: str) -> bool:
    vi = vi.strip()
    return bool(vi) and vi.lower() != src.lower() and len(vi) < 3 * len(src) + 40


def translate(cands: dict[str, list[str]], titles: dict[str, str], provider, model: str, *, workers: int = 6,
              batch: int = BATCH, log=print) -> dict:
    """Translate the keys that have no translation yet, lesson by lesson (the title gives context), saving after
    every batch so an interrupted run loses nothing."""
    data = json.loads(DATA.read_text("utf-8")) if DATA.exists() else {"sentences": {}, "units": {}}
    data["units"] = cands
    sentences: dict = data["sentences"]
    todo, seen = [], set()
    for unit, keys in cands.items():
        missing = [k for k in keys if k not in sentences and k not in seen]
        seen.update(missing)
        todo += [(unit, missing[i:i + batch]) for i in range(0, len(missing), batch)]
    lock = threading.Lock()
    stats = {"batches": len(todo), "translated": 0, "rejected": 0, "failed": 0, "input_tokens": 0, "output_tokens": 0}

    def one(unit: str, keys: list[str]):
        text = f"Lesson: {titles.get(unit, unit)} ({unit})\n\n" + "\n".join(f"{i}. {k}" for i, k in enumerate(keys))
        return provider.structured(model=model, instructions=INSTRUCTIONS, input=text, schema=_Batch,
                                   max_output_tokens=200 + 120 * len(keys))

    DATA.parent.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(one, u, ks): (u, ks) for u, ks in todo}
        for n, f in enumerate(as_completed(futures), 1):
            unit, keys = futures[f]
            try:
                result, usage = f.result()
            except Exception as e:  # noqa: BLE001 - one failed batch must not stop the run; it is retried next time
                stats["failed"] += 1
                log(f"[{n}/{len(todo)}] {unit}: failed ({type(e).__name__}: {e})")
                continue
            with lock:
                stats["input_tokens"] += usage.input_tokens
                stats["output_tokens"] += usage.output_tokens
                for it in result.items:
                    if 0 <= it.i < len(keys) and _check(keys[it.i], it.vi):
                        sentences[keys[it.i]] = {"vi": it.vi.strip(), **({"wrong": True} if it.wrong else {})}
                        stats["translated"] += 1
                    else:
                        stats["rejected"] += 1
                DATA.write_text(json.dumps(data, ensure_ascii=False, indent=0, sort_keys=True), "utf-8")
            log(f"[{n}/{len(todo)}] {unit}: {len(result.items)}/{len(keys)}")
    all_keys = {k for ks in cands.values() for k in ks}
    data["sentences"] = {k: v for k, v in sentences.items() if k in all_keys}  # examples no lesson has any more
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=0, sort_keys=True), "utf-8")
    _data.cache_clear()
    stats["missing"] = len(all_keys - data["sentences"].keys())
    return stats


class _Fix(BaseModel):
    i: int
    vi: str
    wrong: bool = False
    why: str = ""


class _Fixes(BaseModel):
    fixes: list[_Fix]


REVIEW = """You check Vietnamese translations of the English example sentences of an English grammar course (the \
lesson is given). Each line: number. English ⟶ Vietnamese, and [WRONG] when the English is marked as an intentional \
mistake.
Return a fix ONLY for a line that needs one:
- the Vietnamese changes the meaning, above all the grammar the lesson teaches: contrast vs cause (despite / although \
= "mặc dù", not "do / vì"), time and tense (finished / ongoing / future), real vs unreal conditionals, modality \
(must / should / might), passive, reported speech, comparison, quantity, negation;
- it is clearly unnatural or incomplete Vietnamese;
- the [WRONG] mark is wrong: the English is grammatical (informal, British or a deliberate drill such as stressed words \
only is not a mistake), or an ungrammatical English line is not marked.
For a fix give the corrected vi (for a [WRONG] line: the meaning the writer intended) and wrong as it should be; why in \
a few words. Do not rewrite a translation that is already correct; small style preferences are not fixes."""


def review(provider, model: str, titles: dict[str, str], *, workers: int = 6, batch: int = 60, log=print) -> dict:
    """Second pass by a stronger model: corrects meaning errors and wrong mistake marks; entries are marked checked
    so a rerun only checks new translations. Changes are listed in data/example_vi.review.jsonl."""
    data = json.loads(DATA.read_text("utf-8"))
    sentences: dict = data["sentences"]
    todo, seen = [], set()
    for unit, keys in data["units"].items():
        ks = [k for k in keys if k in sentences and not sentences[k].get("checked") and k not in seen]
        seen.update(ks)
        todo += [(unit, ks[i:i + batch]) for i in range(0, len(ks), batch)]
    lock = threading.Lock()
    stats = {"batches": len(todo), "checked": 0, "fixed": 0, "failed": 0, "input_tokens": 0, "output_tokens": 0}
    changes = DATA.with_suffix(".review.jsonl")

    def one(unit: str, keys: list[str]):
        lines = [f"{i}. {k} ⟶ {sentences[k]['vi']}{' [WRONG]' if sentences[k].get('wrong') else ''}" for i, k in enumerate(keys)]
        return provider.structured(model=model, instructions=REVIEW, input=f"Lesson: {titles.get(unit, unit)} ({unit})\n\n" + "\n".join(lines),
                                   schema=_Fixes, max_output_tokens=4000)

    with ThreadPoolExecutor(max_workers=workers) as pool, changes.open("a", encoding="utf-8") as out:
        futures = {pool.submit(one, u, ks): (u, ks) for u, ks in todo}
        for n, f in enumerate(as_completed(futures), 1):
            unit, keys = futures[f]
            try:
                result, usage = f.result()
            except Exception as e:  # noqa: BLE001 - retried on the next run
                stats["failed"] += 1
                log(f"[{n}/{len(todo)}] {unit}: failed ({type(e).__name__}: {e})")
                continue
            with lock:
                stats["input_tokens"] += usage.input_tokens
                stats["output_tokens"] += usage.output_tokens
                for fx in result.fixes:
                    if 0 <= fx.i < len(keys) and _check(keys[fx.i], fx.vi):
                        k = keys[fx.i]
                        out.write(json.dumps({"unit": unit, "en": k, "before": sentences[k], "vi": fx.vi.strip(), "wrong": fx.wrong, "why": fx.why},
                                             ensure_ascii=False) + "\n")
                        sentences[k] = {"vi": fx.vi.strip(), **({"wrong": True} if fx.wrong else {})}
                        stats["fixed"] += 1
                for k in keys:
                    sentences[k]["checked"] = True
                stats["checked"] += len(keys)
                DATA.write_text(json.dumps(data, ensure_ascii=False, indent=0, sort_keys=True), "utf-8")
            log(f"[{n}/{len(todo)}] {unit}: {len(result.fixes)} fixes / {len(keys)}")
    _data.cache_clear()
    return stats


def main() -> None:  # pragma: no cover - CLI wrapper
    ap = argparse.ArgumentParser(prog="python -m app.content.example_vi")
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("dump")
    d.add_argument("out")
    t = sub.add_parser("translate")
    t.add_argument("candidates")
    t.add_argument("--workers", type=int, default=6)
    rv = sub.add_parser("review")
    rv.add_argument("--workers", type=int, default=6)
    sub.add_parser("status")
    args = ap.parse_args()
    from .. import config
    from .store import ContentStore

    store = ContentStore(config.CONTENT_ROOT)
    if args.cmd == "dump":
        Path(args.out).write_text(json.dumps(dump(store), ensure_ascii=False), "utf-8")
    elif args.cmd == "translate":
        from ..ai.provider import OpenAIProvider
        from ..ai.settings import load_settings

        settings = load_settings()
        cands = json.loads(Path(args.candidates).read_text("utf-8"))
        titles = {u.id: u.title for u in store.unit_list}
        print(json.dumps(translate(cands, titles, OpenAIProvider(settings), settings.model("exercise"), workers=args.workers), indent=1))
    elif args.cmd == "review":
        from ..ai.provider import OpenAIProvider
        from ..ai.settings import load_settings

        settings = load_settings()
        titles = {u.id: u.title for u in store.unit_list}
        print(json.dumps(review(OpenAIProvider(settings), settings.model("complex_grading"), titles, workers=args.workers), indent=1))
    else:
        d = _data()
        keys = {k for ks in d["units"].values() for k in ks}
        print(json.dumps({"lessons": len(d["units"]), "examples": len(keys), "translated": len(keys & d["sentences"].keys()),
                          "marked_wrong": sum(1 for s in d["sentences"].values() if s.get("wrong"))}, indent=1))


if __name__ == "__main__":  # pragma: no cover
    main()
