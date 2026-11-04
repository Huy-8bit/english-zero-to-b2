import { beforeEach, describe, expect, it } from "vitest";
import { BRIEF_QUESTIONS, questionsForBrief } from "./briefQuestions";
import { COMPACT_GRAMMAR } from "./compactGrammar";
import {
  advanceBriefQuiz, answerBriefQuiz, briefMisses, briefReview, hideBriefQuiz, loadNight, recordBrief,
  recordNight, startBriefQuiz, startNight, withPathProgress,
} from "./nightPlan";

const path = COMPACT_GRAMMAR.flatMap((b) => b.sources).map((id) => ({ id, title: id, level: id.split("-")[0], status: "not_started" as const }));
const first = questionsForBrief(COMPACT_GRAMMAR[0].id);
const ids = first.map((q) => q.id);
const wrong = (correct: number) => (correct + 1) % 4;

describe("brief grammar questions", () => {
  beforeEach(() => { localStorage.clear(); startNight(path, 3.5); });

  it("provides six distinct checks with explanations for every one of the 29 topics", () => {
    expect(BRIEF_QUESTIONS).toHaveLength(174);
    expect(new Set(BRIEF_QUESTIONS.map((q) => q.id)).size).toBe(174);
    expect(new Set(BRIEF_QUESTIONS.map((q) => q.brief))).toEqual(new Set(COMPACT_GRAMMAR.map((b) => b.id)));
    for (const b of COMPACT_GRAMMAR) expect(questionsForBrief(b.id)).toHaveLength(6);
    for (const q of BRIEF_QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
      expect(q.options[q.correct].length).toBeGreaterThan(0);
      expect(q.explanation.length).toBeGreaterThan(40);
    }
    expect(new Set(BRIEF_QUESTIONS.map((q) => q.correct))).toEqual(new Set([0, 1, 2, 3]));
  });

  it("commits one answer, preserves feedback on reload and cannot advance unanswered questions", () => {
    recordNight("A1-G001", { correct: 2, total: 3, seconds: 120 });
    const legacy = loadNight()!.results;
    startBriefQuiz(first[0].brief, ids);
    advanceBriefQuiz();
    expect(loadNight()!.briefQuiz!.index).toBe(0);
    answerBriefQuiz(first[0].id, wrong(first[0].correct));
    const saved = loadNight()!;
    expect(saved.briefAnswers![first[0].id]).toMatchObject({ correct: false, attempts: 1 });
    answerBriefQuiz(first[0].id, first[0].correct); // a second click cannot replace the committed answer
    expect(loadNight()!.briefAnswers).toEqual(saved.briefAnswers);
    expect(startBriefQuiz(first[0].brief, ids)!.briefQuiz!.choices).toEqual(saved.briefQuiz!.choices);
    advanceBriefQuiz();
    expect(loadNight()!.briefQuiz!.index).toBe(1);
    expect(loadNight()!.results).toEqual(legacy);
    expect(loadNight()!.compactRead).toBeUndefined();
  });

  it("ignores invalid options and stale questions, and pauses/resumes without losing the cursor", () => {
    startBriefQuiz(first[0].brief, ids);
    answerBriefQuiz(first[1].id, 0);
    for (const choice of [-1, 4, 1.5, NaN]) answerBriefQuiz(first[0].id, choice);
    expect(loadNight()!.briefAnswers).toBeUndefined();
    answerBriefQuiz(first[0].id, first[0].correct);
    advanceBriefQuiz(); hideBriefQuiz();
    expect(loadNight()!.briefQuiz).toMatchObject({ visible: false, index: 1 });
    expect(startBriefQuiz(first[0].brief, ids)!.briefQuiz).toMatchObject({ visible: true, index: 1 });
  });

  it("keeps wrong answers in the review queue until answered correctly on a later run", () => {
    startBriefQuiz(first[0].brief, ids);
    answerBriefQuiz(first[0].id, wrong(first[0].correct));
    expect(briefMisses(loadNight()!).map((q) => q.id)).toEqual([first[0].id]);
    startBriefQuiz("review:missed", [first[0].id], true);
    answerBriefQuiz(first[0].id, first[0].correct);
    expect(briefMisses(loadNight()!)).toEqual([]);
    expect(loadNight()!.briefAnswers![first[0].id]).toMatchObject({ correct: true, attempts: 2 });
    advanceBriefQuiz(); advanceBriefQuiz();
    expect(loadNight()!.briefQuiz!.index).toBe(1);
  });

  it("mixes studied topics only, prioritises misses and never repeats a question within one run", () => {
    expect(briefReview(withPathProgress(loadNight()!, path))).toEqual([]);
    const second = COMPACT_GRAMMAR[1];
    recordBrief(second.id);
    startBriefQuiz(first[0].brief, ids);
    answerBriefQuiz(first[0].id, wrong(first[0].correct));
    const s = withPathProgress(loadNight()!, path);
    const mixed = briefReview(s, 12, () => 0);
    expect(mixed).toHaveLength(12);
    expect(mixed[0].id).toBe(first[0].id);
    expect(new Set(mixed.map((q) => q.id)).size).toBe(12);
    expect(new Set(mixed.map((q) => q.brief))).toEqual(new Set([first[0].brief, second.id]));
  });

  it("starts a new run without erasing cumulative results or existing reading progress", () => {
    recordBrief(COMPACT_GRAMMAR[0].id);
    startBriefQuiz(first[0].brief, ids);
    answerBriefQuiz(first[0].id, first[0].correct);
    const before = loadNight()!;
    const fresh = startBriefQuiz(first[0].brief, ids, true)!;
    expect(fresh.briefQuiz!.choices).toEqual({});
    expect(fresh.briefQuiz!.index).toBe(0);
    expect(fresh.briefAnswers).toEqual(before.briefAnswers);
    expect(fresh.compactRead).toEqual(before.compactRead);
  });
});
