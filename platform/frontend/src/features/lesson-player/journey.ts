/**
 * "Journey" view of a lesson: the same curriculum steps, re-sequenced for attention and retrieval.
 *
 *   mission → pre-test (2 questions) → stage 1 (explanations with a check after every 2 slides) → checkpoint
 *   → stage 2 (same) → checkpoint → stage 3 challenge (remaining questions, one per screen)
 *   → retry round for wrong answers (added at runtime) → recap → finish
 *
 * Rationale: pretesting primes attention; frequent retrieval checks keep the learner active and give immediate
 * feedback; one question per screen reduces load; wrong answers come back (mastery); short stages fit focus blocks.
 */
import type { QuizItem, Step } from "@/types/content";

export type Card =
  | { kind: "mission"; key: string; intro: Step | null; stages: string[] }
  | { kind: "pretest"; key: string; item: QuizItem; quizId: string; stepIndex: number; n: number; of: number; intro: string }
  | { kind: "content"; key: string; step: Step; stepIndex: number; stage: number }
  | { kind: "check"; key: string; item: QuizItem; quizId: string; stepIndex: number; stage: number; intro: string }
  | { kind: "checkpoint"; key: string; stage: number; title: string }
  | { kind: "item"; key: string; item: QuizItem; quizId: string; stepIndex: number; level: string; intro: string }
  | { kind: "recap"; key: string; step: Step | null; stepIndex: number }
  | { kind: "finish"; key: string };

export interface Journey { cards: Card[]; stageOf: number[]; stages: string[]; autoItems: number; questionCount: number }

export const STAGES = ["Hiểu", "Vận dụng", "Thử thách"];
const AUTO = new Set(["mc", "tfng", "choice", "multi", "order", "text"]);

/** Instantly graded by the server (has a key) and quick to answer: suitable for checks and the pre-test. */
export const isAuto = (i: QuizItem) => AUTO.has(i.kind) && i.has_key && !i.multiline;

export function buildJourney(steps: Step[]): Journey {
  const intro = steps.find((s) => s.type === "intro") ?? null;
  const recapIdx = steps.findIndex((s) => s.type === "recap");
  const content = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.type !== "quiz" && s.type !== "intro" && s.type !== "recap");
  // `intro`: the exercise's shared instructions/context (many items only say "see the instructions above")
  const questions: { item: QuizItem; quizId: string; stepIndex: number; level: string; intro: string }[] = [];
  steps.forEach((s, i) => {
    if (s.type === "quiz" && s.quiz_id && !s.defer) {
      (s.items ?? []).forEach((item) => questions.push({ item, quizId: s.quiz_id!, stepIndex: i, level: s.title, intro: s.intro_md ?? "" }));
    }
  });
  const auto = questions.filter((q) => isAuto(q.item));
  const used = new Set<string>();
  const cards: Card[] = [{ kind: "mission", key: "mission", intro, stages: STAGES }];
  const pre = auto.slice(0, Math.min(2, Math.max(0, auto.length - 4)));
  pre.forEach((q, n) => {
    used.add(q.item.id);
    cards.push({ kind: "pretest", key: `pre:${q.item.id}`, item: q.item, quizId: q.quizId, stepIndex: q.stepIndex, n: n + 1, of: pre.length, intro: q.intro });
  });
  const pool = auto.filter((q) => !used.has(q.item.id));
  const half = Math.ceil(content.length / 2);
  const parts = [content.slice(0, half), content.slice(half)];
  parts.forEach((part, stage) => {
    part.forEach(({ s, i }, k) => {
      cards.push({ kind: "content", key: `c:${s.id}`, step: s, stepIndex: i, stage });
      const lastOfPart = k === part.length - 1;
      if ((k % 2 === 1 || lastOfPart) && pool.length) {
        const q = pool.shift()!;
        used.add(q.item.id);
        cards.push({ kind: "check", key: `chk:${q.item.id}`, item: q.item, quizId: q.quizId, stepIndex: q.stepIndex, stage, intro: q.intro });
      }
    });
    if (part.length) cards.push({ kind: "checkpoint", key: `cp:${stage}`, stage, title: STAGES[stage] });
  });
  questions.filter((q) => !used.has(q.item.id)).forEach((q) => {
    cards.push({ kind: "item", key: `it:${q.item.id}`, item: q.item, quizId: q.quizId, stepIndex: q.stepIndex, level: q.level, intro: q.intro });
  });
  cards.push({ kind: "recap", key: "recap", step: recapIdx >= 0 ? steps[recapIdx] : null, stepIndex: recapIdx >= 0 ? recapIdx : steps.length - 1 });
  cards.push({ kind: "finish", key: "finish" });
  const stageOf = cards.map((c) => (c.kind === "content" || c.kind === "check" ? c.stage : c.kind === "checkpoint" ? c.stage
    : c.kind === "item" || c.kind === "recap" || c.kind === "finish" ? 2 : 0));
  return { cards, stageOf, stages: STAGES, autoItems: auto.length, questionCount: questions.length };
}

/** Journey mode needs a lesson with practice questions; exams keep their own (deferred-answers) flow. */
export function journeyApplies(unitKind: string, steps: Step[]): boolean {
  if (unitKind === "exam" || steps.some((s) => s.type === "quiz" && s.defer)) return false;
  return steps.some((s) => s.type === "quiz") && steps.filter((s) => s.type === "quiz").flatMap((s) => s.items ?? []).filter(isAuto).length >= 3;
}

export function stars(firstTryCorrect: number, firstTryTotal: number): 1 | 2 | 3 {
  if (!firstTryTotal) return 3;
  const r = firstTryCorrect / firstTryTotal;
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1;
}
