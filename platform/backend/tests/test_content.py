"""Content engine invariants over the real curriculum."""
import json

from app.content.md import parse_tables, split_by_heading
from app.services.grading import answer_variants, normalize


def test_all_units_import_with_steps(store):
    built = store.all_built()
    assert len([b for b in built if b.unit.kind == "grammar"]) == 128
    assert all(b.steps for b in built), [b.unit.id for b in built if not b.steps]


def test_every_grammar_exercise_has_answer_key(store):
    missing = [iid for b in store.all_built() if b.unit.kind == "grammar" for iid, it in b.items.items() if it.key is None]
    assert missing == []


def test_steps_never_contain_answer_keys(store):
    b = store.built("A1-G001")
    payload = json.dumps(b.steps, ensure_ascii=False)
    for it in b.items.values():
        assert "model_md" not in payload and "correct_option" not in payload
    # the answer text for an MC item must not be present as a field
    for st in b.steps:
        for item in st.get("items", []):
            # group_md is the instruction of the item's group (visible text in the lesson), not an answer
            assert set(item) == {"id", "label", "kind", "prompt_md", "instruction_md", "group_md", "options", "prefill", "tokens", "multiline", "has_key"}


def test_grammar_lesson_maps_template_sections(store):
    types = [s["type"] for s in store.built("A1-G001").steps]
    for t in ("intro", "formula", "examples", "mistakes", "quiz", "recap"):
        assert t in types


def test_mc_items_resolve_correct_option(store):
    it = store.item("A1-G011:L1.1")
    assert it.kind == "mc" and it.correct_option == "B"


def test_code_matching_items(store):
    it = store.item("B1-G019:L1.2")
    assert it.kind == "mc" and it.correct_option == "C"


def test_repeated_labels_use_their_own_answer_section(store):
    # A0 skills: Listening 2 must not receive Listening 1 answers
    b = store.built("A0-SKILLS-PRACTICE")
    step = next(s for s in b.steps if "Listening 2" in s["title"])
    first = b.items[step["items"][0]["id"]]
    assert "Ireland" in first.model_md


def test_vocabulary_cards(store):
    cards = store.cards()
    assert len(cards) > 500
    wake = next(c for c in cards if c["id"] == "VOC-01:wake-up")
    assert wake["ipa"] and wake["meaning"] == "thức dậy"


def test_listening_transcript_attached(store):
    b = store.built("L02")
    lst = [s for s in b.steps if s.get("variant") == "listening"]
    assert lst and "gym" in lst[0]["transcript"]["md"].lower()


def test_tables_and_headings_ignore_code_fences():
    md = "## A\n```\n## not a heading\n| a | b |\n|---|---|\n```\n## B\n| x | y |\n|---|---|\n| 1 | 2 |\n"
    _, secs = split_by_heading(md, 2)
    assert [s.title for s in secs] == ["A", "B"]
    assert len(parse_tables(md)) == 1


def test_answer_variants():
    v = answer_variants("**Someone** (*Somebody*)")
    assert "someone" in v and "somebody" in v
    v = answer_variants("We **aren't going to go** on holiday this year.")
    assert normalize("are not going to go") in v
    assert normalize("We aren't going to go on holiday this year") in v


def test_search_vietnamese_and_english(store):
    assert store.search("thì hiện tại hoàn thành")[0]["unit_id"].startswith(("A2-G003", "A2-G006", "B1-G001", "A2-G007"))
    assert any(r["unit_id"] == "A2-G019" for r in store.search("passive voice")[:5])
