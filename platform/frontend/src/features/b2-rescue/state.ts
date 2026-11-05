import { PACKS, PHRASES, PHRASE_BY_ID } from "./content";

export const STORAGE_KEY = "em-b2-four-hour";
export type Block = { id: string; title: string; minutes: number; kind: "intro" | "learn" | "break" | "transfer" | "writing" | "speaking" | "review" | "finish"; pack?: string };
export const PLAN: Block[] = [
  { id: "start", title: "Chọn cách học & xem câu mẫu", minutes: 5, kind: "intro" },
  ...PACKS.slice(0, 3).map((p) => ({ id: p.id, title: p.title, minutes: 20, kind: "learn" as const, pack: p.id })),
  { id: "break1", title: "Nghỉ mắt, đứng dậy, uống nước", minutes: 5, kind: "break" },
  ...PACKS.slice(3).map((p) => ({ id: p.id, title: p.title, minutes: 20, kind: "learn" as const, pack: p.id })),
  { id: "break2", title: "Nghỉ ngắn trước khi vận dụng", minutes: 5, kind: "break" },
  { id: "transfer", title: "Đổi chủ đề với cùng một cụm", minutes: 20, kind: "transfer" },
  { id: "writing", title: "Viết thư & một đoạn Task 2", minutes: 30, kind: "writing" },
  { id: "talk", title: "Nói thành câu · cả 3 phần", minutes: 25, kind: "speaking" },
  { id: "review", title: "Che đáp án · ưu tiên cụm hay quên", minutes: 25, kind: "review" },
  { id: "finish", title: "Chốt bộ cụm mang vào bài thi", minutes: 5, kind: "finish" },
];
export const TOTAL_SECONDS = PLAN.reduce((sum, b) => sum + b.minutes * 60, 0);
export interface Recall { copies: number; clean: number; misses: number; lastTurn: number; at: number }
export interface Prompt { id: string; mode: "copy" | "recall" }
export interface Run { queue: Prompt[]; text: string; hinted: boolean; feedback?: "copy" | "correct" | "retry"; answered: number; initial: number }
export interface Draft { text: string; checks: Record<string, boolean>; at: number }
export interface RescueState {
  version: 1; block: string; seconds: Record<string, number>; items: Record<string, Recall>; turn: number;
  runs: Record<string, Run>; drafts: Record<string, Draft>; transfers: Record<string, { text: string; correct: boolean; hinted: boolean; at: number }>;
}
export const emptyState = (): RescueState => ({ version: 1, block: "start", seconds: {}, items: {}, turn: 0, runs: {}, drafts: {}, transfers: {} });
export function restoreState(raw: Partial<RescueState> | null): RescueState {
  if (!raw || raw.version !== 1) return emptyState();
  return { ...emptyState(), ...raw, block: PLAN.some((b) => b.id === raw.block) ? raw.block! : "start" };
}
export const normalize = (text: string) => text.toLowerCase().replace(/[’']/g, "").replace(/\bim\b/g, "i am").replace(/\binquire\b/g, "enquire").replace(/[^a-z0-9]+/g, " ").trim();
export const matches = (text: string, answer: string) => normalize(text) === normalize(answer);
export function makeRun(ids: string[], review = false): Run {
  const valid = [...new Set(ids)].filter((id) => PHRASE_BY_ID[id]);
  const queue: Prompt[] = [
    ...(review ? [] : valid.map((id) => ({ id, mode: "copy" as const }))),
    ...valid.map((id) => ({ id, mode: "recall" as const })),
    ...valid.map((id) => ({ id, mode: "recall" as const })),
  ];
  return { queue, text: "", hinted: false, answered: 0, initial: queue.length };
}
export function reviewIds(state: RescueState) {
  return PHRASES.toSorted((a, b) => {
    const x = state.items[a.id], y = state.items[b.id];
    const rank = (p?: Recall) => !p ? 1 : p.clean < 2 ? 0 : 2;
    return rank(x) - rank(y) || (y?.misses ?? 0) - (x?.misses ?? 0) || (x?.at ?? 0) - (y?.at ?? 0);
  }).map((p) => p.id);
}
export function markAnswer(state: RescueState, key: string, now = Date.now()): RescueState {
  const run = state.runs[key], prompt = run?.queue[0];
  if (!prompt || run.feedback) return state;
  const phrase = PHRASE_BY_ID[prompt.id];
  if (!phrase) return state;
  const turn = state.turn + 1;
  const item = state.items[phrase.id] ?? { copies: 0, clean: 0, misses: 0, lastTurn: -100, at: now };
  const correct = matches(run.text, phrase.en);
  const independent = correct && !run.hinted && prompt.mode === "recall";
  const spaced = turn - item.lastTurn >= 3;
  const next = { ...item, at: now };
  if (correct && prompt.mode === "copy") next.copies++;
  if (independent && (item.clean === 0 || spaced)) { next.clean = Math.min(2, item.clean + 1); next.lastTurn = turn; }
  if (prompt.mode === "recall" && !independent) { next.clean = 0; next.misses++; }
  const feedback = correct && prompt.mode === "copy" ? "copy" : independent ? "correct" : "retry";
  return { ...state, turn, items: { ...state.items, [phrase.id]: next }, runs: { ...state.runs, [key]: { ...run, feedback } } };
}
export function nextPrompt(state: RescueState, key: string, skip = false): RescueState {
  const run = state.runs[key];
  if (!run?.queue.length || (!skip && !run.feedback)) return state;
  const [current, ...rest] = run.queue;
  // A miss returns after other cards; a deliberate skip stays weak for the final review.
  if (!skip && run.feedback === "retry") rest.push({ ...current, mode: current.mode });
  const items = skip ? { ...state.items, [current.id]: { ...(state.items[current.id] ?? { copies: 0, lastTurn: -100 }), clean: 0, misses: (state.items[current.id]?.misses ?? 0) + 1, at: Date.now() } } : state.items;
  return { ...state, items, runs: { ...state.runs, [key]: { ...run, queue: rest, text: "", hinted: false, feedback: undefined, answered: run.answered + 1 } } };
}
export function addSeconds(state: RescueState, id: string, seconds: number): RescueState {
  const block = PLAN.find((b) => b.id === id);
  if (!block) return state;
  return { ...state, seconds: { ...state.seconds, [id]: Math.min(block.minutes * 60, (state.seconds[id] ?? 0) + Math.max(0, seconds)) } };
}
export function usedSeconds(state: RescueState) { return PLAN.reduce((sum, b) => sum + Math.min(b.minutes * 60, state.seconds[b.id] ?? 0), 0); }
export function stats(state: RescueState) {
  return { seen: PHRASES.filter((p) => state.items[p.id]?.copies > 0 || state.items[p.id]?.clean > 0).length,
    recalled: PHRASES.filter((p) => state.items[p.id]?.clean >= 2).length,
    weak: PHRASES.filter((p) => state.items[p.id]?.misses > 0 && state.items[p.id]?.clean < 2).length };
}
export function phraseHits(text: string) {
  const normalized = ` ${normalize(text)} `;
  return PHRASES.filter((p) => normalized.includes(` ${normalize(p.en)} `));
}
