import { describe, expect, it } from "vitest";
import type { QuizItem, Step } from "@/types/content";
import { buildJourney, journeyApplies, pickChallenge, stars } from "./journey";

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

describe("shorter lessons: challenge stage", () => {
  const many: Step[] = [step("intro", "intro"), step("c1", "concept"), step("c2", "concept"),
    step("Q1", "quiz", Array.from({ length: 10 }, (_, i) => item(`a${i}`))),
    step("Q2", "quiz", Array.from({ length: 10 }, (_, i) => item(`b${i}`, "text"))),
    step("Q3", "quiz", Array.from({ length: 10 }, (_, i) => item(`c${i}`, "long", false))), step("recap", "recap")];

  it("keeps at most 12 challenge questions, spread over the exercises, and says how many were left", () => {
    const j = buildJourney(many);
    const ids = j.cards.filter((c) => c.kind === "item").map((c) => ("item" in c ? c.item.id : ""));
    expect(ids.length).toBe(12);
    expect(new Set(ids.map((id) => id[0]))).toEqual(new Set(["a", "b", "c"]));
    expect(j.skipped).toBe(j.questionCount - j.cards.filter((c) => "item" in c).length);
    expect(j.picked).toEqual(ids);
  });

  it("asks questions not tried before first, and a saved pick is reused exactly", () => {
    const tried = new Set(["c0", "c1", "c2", "c3"]);
    const j = buildJourney(many, { attempted: tried });
    const ids = j.cards.filter((c) => c.kind === "item").map((c) => ("item" in c ? c.item.id : ""));
    expect(ids.filter((id) => tried.has(id))).toEqual([]);
    const again = buildJourney(many, { challenge: j.picked });
    expect(again.cards.map((c) => c.key)).toEqual(j.cards.map((c) => c.key));
  });

  it("pickChallenge returns everything when there are few questions", () => {
    const qs = [1, 2, 3].map((n) => ({ item: item(`x${n}`), quizId: "q", stepIndex: 1, level: "", intro: "" }));
    expect(pickChallenge(qs, new Set(), 12)).toHaveLength(3);
  });
});

describe("grammar sprint", () => {
  it("core screen: form, key points without the review schedule, mistakes, memory tip", async () => {
    const { coreSteps } = await import("./SprintLesson");
    const steps = [step("intro", "intro"), step("w", "concept"), { ...step("f", "formula"), title: "FORM" },
      { ...step("m", "mistakes") }, { ...step("t", "concept"), title: "Mẹo ghi nhớ" },
      { ...step("r", "recap"), md: "### 3 lỗi cần nhớ\n1. a\n\n### Lịch ôn tập\n| Ngày | Việc |\n\n### Liên kết\n- x" }] as Step[];
    const c = coreSteps(steps);
    expect(c.form.map((s) => s.id)).toEqual(["f"]);
    expect(c.recap?.md).toContain("3 lỗi cần nhớ");
    expect(c.recap?.md).not.toMatch(/Lịch ôn|Liên kết/);
    expect(c.mistakes?.id).toBe("m");
    expect(c.tip?.id).toBe("t");
  });
  it("next lesson: the first one still to do after the current one", async () => {
    const { nextAfter } = await import("./SprintLesson");
    const u = (id: string, status: "done" | "study" | "todo") => ({ id, title: id, level: "A1", status, minutes: 30, done_today: false });
    const units = [u("A", "todo"), u("B", "done"), u("C", "todo"), u("D", "study"), u("E", "todo")];
    expect(nextAfter(units, "C")?.id).toBe("E");
    expect(nextAfter(units, "E")?.id).toBe("A");
    expect(nextAfter([u("A", "done")], "A")).toBeNull();
  });
});
