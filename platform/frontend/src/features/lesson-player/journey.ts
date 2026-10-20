/**
 * "Journey" view of a lesson: the same curriculum steps, re-sequenced for attention and retrieval.
 *
 *   mission → pre-test (2 questions) → stage 1 (explanations with a check after every 2 slides) → checkpoint
 *   → stage 2 (same) → checkpoint → stage 3 challenge (up to MAX_CHALLENGE remaining questions, one per screen: spread over
 *     the lesson's exercises, questions not tried before first; the rest come up the next time the lesson is studied)
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

export interface Journey {
  cards: Card[]; stageOf: number[]; stages: string[]; autoItems: number; questionCount: number;
  /** challenge questions used (to persist), and how many were left for another time */
  picked: string[]; skipped: number;
}

export const MAX_CHALLENGE = 12;

export interface JourneyOptions {
  /** challenge questions chosen earlier for this journey (resume) */
  challenge?: string[];
  /** questions the learner already answered in earlier sessions (asked later than new ones) */
  attempted?: Set<string>;
  max?: number;
}

type Q = { item: QuizItem; quizId: string; stepIndex: number; level: string; intro: string };

/** Up to `max` questions, round-robin over the lesson's exercises; within one exercise, new questions first. */
export function pickChallenge(rest: Q[], attempted: Set<string>, max: number): Q[] {
  if (rest.length <= max) return rest;
  const groups = new Map<number, Q[]>();
  rest.forEach((q) => groups.set(q.stepIndex, [...(groups.get(q.stepIndex) ?? []), q]));
  const queues = [...groups.values()].map((g) => [...g.filter((q) => !attempted.has(q.item.id)), ...g.filter((q) => attempted.has(q.item.id))]);
  const chosen = new Set<string>();
  for (let round = 0; chosen.size < max && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      if (q[round] && chosen.size < max) chosen.add(q[round].item.id);
    }
  }
  return rest.filter((q) => chosen.has(q.item.id));
}

export const STAGES = ["Hiểu", "Vận dụng", "Thử thách"];

/** For a question shown on its own: the step's shared context (when it is more than an instruction) plus the
 *  instruction of the question's own group — an exercise can have several groups ("Write negatives…", then
 *  "Write Wh- questions…"), and the step intro only states the first one. */
export function singleIntro(stepIntro: string, item: QuizItem): string {
  const group = (item.group_md ?? "").trim();
  const intro = stepIntro.trim();
  if (!group) return intro;
  const justAnInstruction = intro.length < 200 && !intro.includes("\n\n") && !intro.includes("|");
  return !intro || justAnInstruction ? group : `${intro}\n\n**Yêu cầu:** ${group}`;
}

/** The same item without its own instruction line when that line is already shown as the group instruction. */
export function withoutRepeatedInstruction(item: QuizItem): QuizItem {
  return item.group_md && item.instruction_md.trim() === item.group_md.trim() ? { ...item, instruction_md: "" } : item;
}
const AUTO = new Set(["mc", "tfng", "choice", "multi", "order", "text"]);

/** Instantly graded by the server (has a key) and quick to answer: suitable for checks and the pre-test. */
export const isAuto = (i: QuizItem) => AUTO.has(i.kind) && i.has_key && !i.multiline;

export function buildJourney(steps: Step[], opts: JourneyOptions = {}): Journey {
  const intro = steps.find((s) => s.type === "intro") ?? null;
  const recapIdx = steps.findIndex((s) => s.type === "recap");
  const content = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.type !== "quiz" && s.type !== "intro" && s.type !== "recap");
  // `intro`: the exercise's shared instructions/context (many items only say "see the instructions above")
  const questions: { item: QuizItem; quizId: string; stepIndex: number; level: string; intro: string }[] = [];
  steps.forEach((s, i) => {
    if (s.type === "quiz" && s.quiz_id && !s.defer) {
      (s.items ?? []).forEach((item) => questions.push({ item: withoutRepeatedInstruction(item), quizId: s.quiz_id!, stepIndex: i, level: s.title,
                                                         intro: singleIntro(s.intro_md ?? "", item) }));
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
  const rest = questions.filter((q) => !used.has(q.item.id));
  const challenge = opts.challenge ? rest.filter((q) => opts.challenge!.includes(q.item.id))
    : pickChallenge(rest, opts.attempted ?? new Set(), opts.max ?? MAX_CHALLENGE);
  challenge.forEach((q) => {
    cards.push({ kind: "item", key: `it:${q.item.id}`, item: q.item, quizId: q.quizId, stepIndex: q.stepIndex, level: q.level, intro: q.intro });
  });
  cards.push({ kind: "recap", key: "recap", step: recapIdx >= 0 ? steps[recapIdx] : null, stepIndex: recapIdx >= 0 ? recapIdx : steps.length - 1 });
  cards.push({ kind: "finish", key: "finish" });
  const stageOf = cards.map((c) => (c.kind === "content" || c.kind === "check" ? c.stage : c.kind === "checkpoint" ? c.stage
    : c.kind === "item" || c.kind === "recap" || c.kind === "finish" ? 2 : 0));
  return { cards, stageOf, stages: STAGES, autoItems: auto.length, questionCount: questions.length,
           picked: challenge.map((q) => q.item.id), skipped: rest.length - challenge.length };
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
