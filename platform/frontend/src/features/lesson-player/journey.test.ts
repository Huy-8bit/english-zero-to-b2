import { describe, expect, it } from "vitest";
import type { QuizItem, Step } from "@/types/content";
import { buildJourney, journeyApplies, stars } from "./journey";

const item = (id: string, kind: QuizItem["kind"] = "mc", has_key = true): QuizItem =>
  ({ id, label: id, kind, prompt_md: id, instruction_md: "", options: [{ key: "A", text: "a" }], prefill: null, tokens: null, multiline: false, has_key });
const step = (id: string, type: Step["type"], items?: QuizItem[]): Step =>
  ({ id, type, title: id, section: "", md: "x", ...(items ? { items, quiz_id: `q-${id}` } : {}) } as Step);

const lesson: Step[] = [
  step("intro", "intro"), step("c1", "concept"), step("c2", "concept"), step("f", "formula"), step("e", "examples"), step("c3", "concept"),
  { ...step("L1", "quiz", [item("a1"), item("a2"), item("a3"), item("a4")]), intro_md: "Chọn chữ cái có tên chứa âm khác." },
  step("L2", "quiz", [item("b1", "text"), item("b2", "choice"), item("b3", "text", false)]),
  step("L4", "quiz", [item("p1", "long", false), item("s1", "speaking", false)]),
  step("recap", "recap"),
];

describe("buildJourney", () => {
  const j = buildJourney(lesson);
  const kinds = j.cards.map((c) => c.kind);

  it("starts with a mission and a 2-question pre-test, ends with recap and finish", () => {
    expect(kinds.slice(0, 3)).toEqual(["mission", "pretest", "pretest"]);
    expect(kinds.slice(-2)).toEqual(["recap", "finish"]);
  });

  it("never shows more than two explanation slides in a row before a check", () => {
    let run = 0;
    for (const k of kinds) {
      run = k === "content" ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(2);
    }
    expect(kinds.filter((k) => k === "checkpoint")).toHaveLength(2);
  });

  it("uses every question exactly once and keeps open questions for the challenge stage", () => {
    const ids = j.cards.flatMap((c) => ("item" in c ? [c.item.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(["a1", "a2", "a3", "a4", "b1", "b2", "b3", "p1", "s1"].sort());
    const checks = j.cards.filter((c) => c.kind === "check" || c.kind === "pretest");
    expect(checks.every((c) => "item" in c && c.item.has_key)).toBe(true);
    const challenge = j.cards.filter((c) => c.kind === "item").map((c) => ("item" in c ? c.item.id : ""));
    expect(challenge).toEqual(expect.arrayContaining(["b3", "p1", "s1"]));
  });

  it("every question carries its exercise instructions (items often say 'see above')", () => {
    const pre = j.cards.find((c) => c.kind === "pretest");
    expect(pre && "intro" in pre && pre.intro).toBe("Chọn chữ cái có tên chứa âm khác.");
  });

  it("all explanation slides are kept in their original order", () => {
    const ids = j.cards.flatMap((c) => (c.kind === "content" ? [c.step.id] : []));
    expect(ids).toEqual(["c1", "c2", "f", "e", "c3"]);
  });
});

describe("journeyApplies / stars", () => {
  it("skips exams and lessons without enough instantly graded questions", () => {
    expect(journeyApplies("grammar", lesson)).toBe(true);
    expect(journeyApplies("exam", lesson)).toBe(false);
    expect(journeyApplies("reading", [step("c", "concept"), step("q", "quiz", [item("x", "long", false)])])).toBe(false);
  });
  it("gives stars by first-try accuracy", () => {
    expect(stars(9, 10)).toBe(3);
    expect(stars(7, 10)).toBe(2);
    expect(stars(5, 10)).toBe(1);
  });
});
