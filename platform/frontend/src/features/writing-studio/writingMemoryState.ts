import { fixedFrameText } from "./extendedWritingFrames";
import { normalizeRecall } from "./examFrames";
import type { MemoryLine } from "./writingMemoryContent";

export type PracticeStage = 0 | 1 | 2 | 3;
export interface MemoryJob { id: string; stage: PracticeStage }
export interface MemoryRun {
  jobs: MemoryJob[]; index: number; text: string; hinted: boolean; checked: boolean; correct: boolean;
  phase: "lines" | "whole" | "done"; mistakes: number; startedAt: number;
}
export interface MemoryProgress { run?: MemoryRun; passedAt?: number; dueAt?: number; reviews: number }
export interface WritingMemoryState {
  frameRevision?: string;
  format?: "budget" | "extended" | "short";
  budgetDecks?: Record<string, MemoryProgress>;
  budgetApplications?: Record<string, { topic: number; values: Record<string, string> }>; extendedDecks?: Record<string, MemoryProgress>;
  applications?: Record<string, { topic: number; values: Record<string, string> }>;
  deckId: string; view: "frames" | "vocabulary"; packId: string;
  decks: Record<string, MemoryProgress>; packs: Record<string, MemoryProgress>;
}
export const EMPTY_MEMORY: WritingMemoryState = { deckId: "reply", view: "frames", packId: "letters", decks: {}, packs: {} };
export const STAGE_NAMES = ["Nhìn mẫu và gõ", "Gõ với gợi ý chữ đầu", "Tự nhớ — lượt 1", "Tự nhớ — lượt 2"];
export const memoryTarget = (items: MemoryLine[]) => items.map((c) => c.en).join("\n");
export const memoryMatches = (text: string, expected: string) => normalizeRecall(fixedFrameText(text)) === normalizeRecall(fixedFrameText(expected));
export const fadedText = (text: string) => text.split(/(\[[^\]]+\])/g).map((part) => part.startsWith("[") ? part : part.replace(/[\p{L}]+/gu, (w) => w[0] + "_".repeat(w.length - 1))).join("");
export function startMemory(items: MemoryLine[], now = Date.now()): MemoryRun {
  return { jobs: ([0, 1, 2, 3] as const).flatMap((stage) => items.map((c) => ({ id: c.id, stage }))), index: 0,
    text: "", hinted: false, checked: false, correct: false, phase: "lines", mistakes: 0, startedAt: now };
}
export function typeMemory(run: MemoryRun, text: string): MemoryRun {
  return run.checked || run.phase === "done" ? run : { ...run, text };
}
export const hintMemory = (run: MemoryRun): MemoryRun => run.checked || run.phase === "done" ? run : { ...run, hinted: true };
export function checkMemory(run: MemoryRun, items: MemoryLine[]): MemoryRun {
  if (run.checked || run.phase === "done" || !run.text.trim()) return run;
  const target = run.phase === "whole" ? memoryTarget(items) : items.find((c) => c.id === run.jobs[run.index]?.id)?.en;
  if (!target) return run;
  const correct = memoryMatches(run.text, target);
  return { ...run, checked: true, correct, mistakes: run.mistakes + Number(!correct) };
}
export function advanceMemory(run: MemoryRun, whole = true): MemoryRun {
  if (!run.checked || run.phase === "done") return run;
  const clean = { text: "", hinted: false, checked: false, correct: false };
  if (run.phase === "whole") {
    return run.correct && !run.hinted ? { ...run, phase: "done" } : { ...run, ...clean };
  }
  const job = run.jobs[run.index];
  if (!job) return run;
  // A hint or a mistake must be followed by another attempt. Retry after other cards,
  // so copying the just-revealed answer cannot finish a hidden-recall round.
  const repeat = !run.correct || (run.hinted && job.stage > 0);
  const jobs = repeat ? [...run.jobs, job] : run.jobs;
  const index = run.index + 1;
  return { ...run, ...clean, jobs, index, phase: index >= jobs.length ? whole ? "whole" : "done" : "lines" };
}
const DAY = 86_400_000;
export function recordMemory(progress: MemoryProgress | undefined, run: MemoryRun, now = Date.now()): MemoryProgress {
  if (run.phase !== "done") return { ...progress, reviews: progress?.reviews ?? 0, run };
  // A completed run is committed once. Reviews on the same day do not push the due date out.
  if (progress?.run?.phase === "done") return progress;
  const dueReview = !progress?.passedAt || (progress.dueAt ?? 0) <= now;
  const reviews = (progress?.reviews ?? 0) + Number(dueReview);
  return { run, passedAt: now, reviews, dueAt: dueReview ? now + DAY * [1, 3, 7, 14][Math.min(reviews - 1, 3)] : progress?.dueAt };
}

/** Old attempts stay in their old buckets; a new default never regrades them. */
export const writingMemoryFormat = (state: WritingMemoryState) => state.frameRevision === "word-budget-v1" ? state.format ?? "budget" : "budget";
