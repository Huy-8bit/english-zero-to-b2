import { normalizeRecall, type WritingFrame } from "./examFrames";

export interface ExamDraft { parts: Record<string, string>; checks: Record<string, boolean> }
export interface RecallAnswer { text: string; checked: boolean; correct: boolean; hinted: boolean }
export interface FrameRecall { ids: string[]; index: number; answers: Record<string, RecallAnswer> }
export interface ExamWritingState {
  frameId: string; topics: Record<string, string>; step: "frame" | "write" | "memory";
  drafts: Record<string, ExamDraft>; recall: Record<string, FrameRecall>; hideFrame: boolean;
}
export const EMPTY_EXAM: ExamWritingState = { frameId: "opinion", topics: {}, step: "frame", drafts: {}, recall: {}, hideFrame: false };
export const EMPTY_DRAFT: ExamDraft = { parts: {}, checks: {} };
export const freshRecall = (frame: WritingFrame, ids = frame.cues.map((c) => c.id)): FrameRecall => ({ ids, index: 0, answers: {} });
export function updateRecallText(run: FrameRecall, text: string): FrameRecall {
  const id = run.ids[run.index];
  if (!id || run.answers[id]?.checked) return run;
  const previous = run.answers[id] ?? { text: "", checked: false, correct: false, hinted: false };
  return { ...run, answers: { ...run.answers, [id]: { ...previous, text } } };
}
export function revealRecall(run: FrameRecall): FrameRecall {
  const id = run.ids[run.index];
  if (!id) return run;
  const previous = run.answers[id] ?? { text: "", checked: false, correct: false, hinted: false };
  return { ...run, answers: { ...run.answers, [id]: { ...previous, hinted: true } } };
}
export function checkRecall(frame: WritingFrame, run: FrameRecall): FrameRecall {
  const id = run.ids[run.index];
  const answer = run.answers[id];
  const cue = frame.cues.find((c) => c.id === id);
  if (!answer?.text.trim() || answer.checked || !cue) return run;
  const correct = normalizeRecall(answer.text) === normalizeRecall(cue.answer);
  return { ...run, answers: { ...run.answers, [id]: { ...answer, correct, checked: true, hinted: answer.hinted || !correct } } };
}
export const nextRecall = (run: FrameRecall): FrameRecall => run.answers[run.ids[run.index]]?.checked ? { ...run, index: Math.min(run.ids.length, run.index + 1) } : run;
