/** One-night reading progress in the browser: merged briefs by default, with the original per-lesson
 *  recall loop available via plan=full. Reading never completes source lessons. */
import { safeStorage } from "@/lib/utils";
import type { Status } from "@/types/content";
import { COMPACT_GRAMMAR, NIGHT_LATER } from "./compactGrammar";
import { BRIEF_QUESTION_MAP, BRIEF_QUESTIONS } from "./briefQuestions";

const KEY = "em-grammar-night";
const MODE_KEY = "em-lesson-mode";
export const BREAK_EVERY_MIN = 50;
export const BREAK_MIN = 5;
const HOUR = 3_600_000;
/** Lessons read until a missed question is asked again: soon after the miss, then once more later (expanding gaps). */
export const RECALL_GAPS = [3, 8];

export interface NightUnit { id: string; title: string; level: string; sources?: string[]; nextOrder?: number }
export interface NightPathUnit extends NightUnit { status: Status }
/** `pre`: the pretest question was guessed right before reading. `at`: when the lesson was read. */
export interface NightResult { correct: number; total: number; seconds: number; skipped?: boolean; pre?: boolean; at?: number }
/** A missed question waiting to be asked again once `due` lessons have been read; `stage` = recalls since the miss. */
export interface RecallEntry { unit: string; item: string; due: number; stage: number }
export interface BriefAnswer { choice: number; correct: boolean; attempts: number; at: number }
export interface BriefQuizRun { key: string; ids: string[]; index: number; choices: Record<string, number>; visible: boolean }
export interface NightSession {
  start: number; hours: number; units: NightUnit[]; results: Record<string, NightResult>;
  lastBreak: number; prevMode: string | null; recall?: RecallEntry[]; recovered?: number;
  scope?: "remaining" | "all";
  completed?: string[]; // Path completions, separate from this night's answers/readings.
  plan?: "compact" | "full";
  compactRead?: string[]; // Briefs read; source-lesson results remain untouched.
  paceReadBaseline?: number; // Read before the latest time-budget reset.
  briefAnswers?: Record<string, BriefAnswer>;
  briefQuiz?: BriefQuizRun;
}
/** A question from an earlier lesson: a given one (missed before), or any one the server picks. */
export interface RecallPick { unit: string; item?: string }

export const loadNight = () => safeStorage().get<NightSession | null>(KEY, null);
const saveNight = (s: NightSession | null) => safeStorage().set(KEY, s);

function updateNight(fn: (s: NightSession) => NightSession): NightSession | null {
  const s = loadNight();
  if (!s) return null;
  const next = fn(s);
  saveNight(next);
  return next;
}

/** Start a night: grammar lessons open in night mode until it ends (the previous lesson mode comes back then). */
export function startNight(units: NightUnit[], hours: number, now = Date.now(), scope: NightSession["scope"] = "remaining", plan: NightSession["plan"] = "compact"): NightSession {
  const prev = loadNight()?.prevMode ?? safeStorage().get<string | null>(MODE_KEY, null);
  const s: NightSession = { start: now, hours, units: nightUnits(units, plan), results: {}, lastBreak: now, prevMode: prev === "night" ? null : prev, recall: [], recovered: 0, scope, plan };
  saveNight(s);
  safeStorage().set(MODE_KEY, "night");
  return s;
}

/** Refresh legacy sessions too, even when their stored lesson list omits earlier path lessons. */
export function withPathProgress(s: NightSession, units: NightPathUnit[]): NightSession {
  const route = nightUnits(units, s.plan);
  if (s.plan !== "full" && route.some((u) => u.sources)) {
    // Follow the earliest unfinished source in the path, even for a brief spanning several levels.
    // An advanced extension must not send a learner back to already-read foundation lessons first.
    const unfinished = new Map(units.filter((u) => !(s.scope !== "all" && u.status === "completed") && (!s.results[u.id] || s.results[u.id].skipped))
      .map((u, i) => [u.id, i]));
    route.forEach((u) => { u.nextOrder = Math.min(...(u.sources ?? [u.id]).map((id) => unfinished.get(id) ?? units.length)); });
  }
  return { ...s, units: route,
    completed: units.filter((u) => u.status === "completed").map((u) => u.id) };
}

/** Legacy sessions adopt the concise syllabus; full reading remains an explicit choice. */
export function nightUnits(units: NightUnit[], plan?: NightSession["plan"]): NightUnit[] {
  if (plan === "full") return units.map(({ id, title, level }) => ({ id, title, level }));
  const available = new Set(units.map((u) => u.id));
  const briefs = COMPACT_GRAMMAR.map(({ id, title, level, sources }) => ({ id, title, level, sources: sources.filter((x) => available.has(x)) }))
    .filter((b) => b.sources.length);
  // Preserve unknown/new lessons rather than silently discarding their content.
  const known = new Set(COMPACT_GRAMMAR.flatMap((b) => b.sources));
  return [...briefs, ...units.filter((u) => !known.has(u.id) && !NIGHT_LATER.includes(u.id)).map(({ id, title, level }) => ({ id, title, level }))];
}

const sourcesFor = (s: NightSession, id: string) => s.units.find((u) => u.id === id)?.sources ?? [id];
export const syncNight = (units: NightPathUnit[]) => updateNight((s) => withPathProgress(s, units));
export const completedInPath = (s: NightSession, id: string) => s.scope !== "all" && sourcesFor(s, id).every((x) => s.completed?.includes(x));
export const coveredNight = (s: NightSession, id: string) => {
  if (!s.units.find((u) => u.id === id)?.sources) return completedInPath(s, id) || !!s.results[id];
  return !!s.compactRead?.includes(id) || sourcesFor(s, id).every((x) =>
    (s.scope !== "all" && s.completed?.includes(x)) || (s.results[x] && !s.results[x].skipped));
};

export const recordBrief = (id: string) => updateNight((s) => ({ ...s, compactRead: [...new Set([...(s.compactRead ?? []), id])] }));

/** Resume the same run on refresh/reopen; a new selection starts a new run without deleting history. */
export const startBriefQuiz = (key: string, ids: string[], restart = false) => updateNight((s) => {
  const valid = [...new Set(ids)].filter((id) => BRIEF_QUESTION_MAP[id]);
  const old = s.briefQuiz;
  const resume = !restart && old?.key === key && old.ids.join("|") === valid.join("|");
  return { ...s, briefQuiz: resume ? { ...old, visible: true } : { key, ids: valid, index: 0, choices: {}, visible: true } };
});
export const hideBriefQuiz = () => updateNight((s) => ({ ...s, briefQuiz: s.briefQuiz ? { ...s.briefQuiz, visible: false } : undefined }));
export const answerBriefQuiz = (id: string, choice: number) => updateNight((s) => {
  const run = s.briefQuiz;
  const q = BRIEF_QUESTION_MAP[id];
  if (!run || run.ids[run.index] !== id || run.choices[id] !== undefined || !q || !Number.isInteger(choice) || q.options[choice] === undefined) return s;
  return { ...s, briefQuiz: { ...run, choices: { ...run.choices, [id]: choice } },
    briefAnswers: { ...s.briefAnswers, [id]: { choice, correct: choice === q.correct, attempts: (s.briefAnswers?.[id]?.attempts ?? 0) + 1, at: Date.now() } } };
});
export const advanceBriefQuiz = () => updateNight((s) => {
  const run = s.briefQuiz;
  return run && run.index < run.ids.length && run.choices[run.ids[run.index]] !== undefined
    ? { ...s, briefQuiz: { ...run, index: run.index + 1 } } : s;
});
export const briefMisses = (s: NightSession) => BRIEF_QUESTIONS.filter((q) => s.briefAnswers?.[q.id]?.correct === false);

/** Review studied topics only; wrong answers first, then round-robin across shuffled topics. */
export function briefReview(s: NightSession, limit = 12, rand = Math.random) {
  const missed = briefMisses(s).sort((a, b) => (s.briefAnswers![a.id].at - s.briefAnswers![b.id].at));
  const studied = new Set(s.units.filter((u) => coveredNight(s, u.id)).map((u) => u.id));
  for (const id of Object.keys(s.briefAnswers ?? {})) if (BRIEF_QUESTION_MAP[id]) studied.add(BRIEF_QUESTION_MAP[id].brief);
  const shuffle = <T,>(items: T[]) => {
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  };
  const chosen = missed.slice(0, limit);
  const seen = new Set(chosen.map((q) => q.id));
  const groups = shuffle([...studied]).map((id) => shuffle(BRIEF_QUESTIONS.filter((q) => q.brief === id && !seen.has(q.id))));
  while (chosen.length < limit && groups.some((g) => g.length)) {
    for (const group of groups) {
      const q = group.pop();
      if (q && chosen.length < limit) chosen.push(q);
    }
  }
  return chosen;
}
/** Rebase an expired clock on the time the learner actually has left; keep every reading/result. */
export const replanNight = (hours: number, now = Date.now()) => updateNight((s) => ({ ...s, start: now, hours, lastBreak: now, paceReadBaseline: nightPace(s, now).read }));

export function endNight() {
  const s = loadNight();
  safeStorage().set(MODE_KEY, s?.prevMode ?? "journey");
  saveNight(null);
}

export const recordNight = (id: string, r: NightResult) =>
  updateNight((s) => ({ ...s, results: { ...s.results, [id]: { at: Date.now(), ...r } } }));

/** `snoozeMin`: remind again in that many minutes instead of a full break interval. */
export const tookBreak = (now = Date.now(), snoozeMin?: number) =>
  updateNight((s) => ({ ...s, lastBreak: snoozeMin ? now - (BREAK_EVERY_MIN - snoozeMin) * 60_000 : now }));

export const breakDue = (s: NightSession, now = Date.now()) => now - s.lastBreak >= BREAK_EVERY_MIN * 60_000;

const lessonsRead = (s: NightSession) => Object.keys(s.results).length;

/** A wrong answer: ask it again a few lessons later (back to the first gap if it was being recalled). */
export function withMiss(s: NightSession, unit: string, item: string): NightSession {
  const rest = (s.recall ?? []).filter((e) => e.item !== item);
  return { ...s, recall: [...rest, { unit, item, due: lessonsRead(s) + RECALL_GAPS[0], stage: 0 }] };
}

/** A right answer to a question being recalled: next gap, or recovered after the last one. */
export function withHit(s: NightSession, item: string): NightSession {
  const e = (s.recall ?? []).find((x) => x.item === item);
  if (!e) return s;
  const rest = s.recall!.filter((x) => x !== e);
  const stage = e.stage + 1;
  if (stage >= RECALL_GAPS.length) return { ...s, recall: rest, recovered: (s.recovered ?? 0) + 1 };
  return { ...s, recall: [...rest, { ...e, stage, due: lessonsRead(s) + RECALL_GAPS[stage] }] };
}

export const recallAnswer = (unit: string, item: string, correct: boolean) =>
  updateNight((s) => (correct ? withHit(s, item) : withMiss(s, unit, item)));

/** Lessons read tonight, oldest first. */
function readOrder(s: NightSession, except?: string) {
  return Object.entries(s.results).filter(([id, r]) => id !== except && !r.skipped && r.total > 0)
    .sort((a, b) => (a[1].at ?? 0) - (b[1].at ?? 0)).map(([id]) => id);
}

/** The question that opens a lesson: a missed one that is due, else one from a lesson read 3–20 lessons ago. */
export function flashbackPick(s: NightSession, current: string, rand = Math.random): RecallPick | null {
  const n = lessonsRead(s);
  const due = (s.recall ?? []).filter((e) => e.due <= n && e.unit !== current).sort((a, b) => a.due - b.due)[0];
  if (due) return { unit: due.unit, item: due.item };
  const read = readOrder(s, current);
  const pool = read.slice(Math.max(0, read.length - 20), Math.max(0, read.length - 2));
  return pool.length ? { unit: pool[Math.floor(rand() * pool.length)] } : null;
}

/** A short mixed review (before a break, before sleep): missed questions first, then lessons read since `since`. */
export function reviewPicks(s: NightSession, n: number, since = 0, rand = Math.random): RecallPick[] {
  const out: RecallPick[] = [...(s.recall ?? [])].sort((a, b) => a.due - b.due).slice(0, n).map((e) => ({ unit: e.unit, item: e.item }));
  const units = new Set(out.map((p) => p.unit));
  const read = readOrder(s).filter((id) => (s.results[id].at ?? 0) >= since && !units.has(id));
  for (let i = read.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [read[i], read[j]] = [read[j], read[i]];
  }
  return [...out, ...read.slice(0, n - out.length).map((unit) => ({ unit }))];
}

/** Minutes left for lessons in `hours` after a 5-minute break per 50 minutes of study. */
export function studyMinutes(hours: number) {
  const total = hours * 60;
  return total - Math.floor(total / (BREAK_EVERY_MIN + BREAK_MIN)) * BREAK_MIN;
}

/** The next lesson not covered tonight: after `after` in route order, then the earlier gaps. */
export function nextNight(s: NightSession, after?: string): NightUnit | null {
  const i = after ? s.units.findIndex((u) => u.id === after) : -1;
  const open = (u: NightUnit) => !coveredNight(s, u.id) && u.id !== after;
  if (s.plan !== "full" && s.units.some((u) => u.nextOrder !== undefined)) {
    return s.units.filter(open).sort((a, b) => (a.nextOrder ?? Infinity) - (b.nextOrder ?? Infinity))[0] ?? null;
  }
  return s.units.slice(i + 1).find(open) ?? s.units.slice(0, Math.max(0, i)).find(open) ?? null;
}

/** Where the night stands: covered lessons, lessons ahead (+) or behind (−) the even pace, seconds per remaining
 *  lesson to still finish on time (breaks kept), projected finish time. */
export function nightPace(s: NightSession, now = Date.now()) {
  const total = s.units.length;
  const completed = s.units.filter((u) => completedInPath(s, u.id)).length;
  const covered = s.units.filter((u) => coveredNight(s, u.id)).length;
  const read = covered - completed;
  const left = total - covered;
  const span = s.hours * HOUR;
  const elapsed = Math.max(0, now - s.start);
  const msLeft = Math.max(0, span - elapsed);
  const paceRead = Math.max(0, read - (s.paceReadBaseline ?? 0));
  const planned = Math.max(0, total - completed - (s.paceReadBaseline ?? 0));
  const ahead = Math.round(paceRead - Math.min(planned, (elapsed / span) * planned));
  const breaksLeft = Math.floor(msLeft / ((BREAK_EVERY_MIN + BREAK_MIN) * 60_000));
  const perLesson = left ? Math.max(0, (msLeft - breaksLeft * BREAK_MIN * 60_000) / left / 1000) : 0;
  const finishAt = paceRead >= 3 ? now + (elapsed / paceRead) * left : s.start + span;
  return { total, completed, read, covered, left, elapsed, msLeft, ahead, perLesson, finishAt, end: s.start + span };
}

/** Lessons not remembered yet: skipped, or with a missed question not recalled since. */
export function needsReview(s: NightSession): (NightUnit & { missed: number })[] {
  const missed = new Map<string, number>();
  for (const e of s.recall ?? []) if (e.stage === 0) missed.set(e.unit, (missed.get(e.unit) ?? 0) + 1);
  return s.units.filter((u) => s.results[u.id]?.skipped || missed.has(u.id)).map((u) => ({ ...u, missed: missed.get(u.id) ?? 0 }));
}

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
export const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
export const hoursMin = (ms: number) => `${Math.floor(ms / HOUR)}h${String(Math.floor((ms % HOUR) / 60_000)).padStart(2, "0")}`;
