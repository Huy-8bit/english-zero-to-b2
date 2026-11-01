/** 'Ngữ pháp 1 đêm': read every grammar lesson in one night, kept in the browser.
 *  Each lesson is a memory loop: recall an earlier question → guess one (pretest) → learn in short cards →
 *  retrieve without looking. Missed questions come back after a few lessons (spaced, mixed with other lessons).
 *  A reading pass: it does not complete lessons; what is still missed is listed to study properly later. */
import { safeStorage } from "@/lib/utils";

const KEY = "em-grammar-night";
const MODE_KEY = "em-lesson-mode";
export const BREAK_EVERY_MIN = 50;
export const BREAK_MIN = 5;
const HOUR = 3_600_000;
/** Lessons read until a missed question is asked again: soon after the miss, then once more later (expanding gaps). */
export const RECALL_GAPS = [3, 8];

export interface NightUnit { id: string; title: string; level: string }
/** `pre`: the pretest question was guessed right before reading. `at`: when the lesson was read. */
export interface NightResult { correct: number; total: number; seconds: number; skipped?: boolean; pre?: boolean; at?: number }
/** A missed question waiting to be asked again once `due` lessons have been read; `stage` = recalls since the miss. */
export interface RecallEntry { unit: string; item: string; due: number; stage: number }
export interface NightSession {
  start: number; hours: number; units: NightUnit[]; results: Record<string, NightResult>;
  lastBreak: number; prevMode: string | null; recall?: RecallEntry[]; recovered?: number;
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
export function startNight(units: NightUnit[], hours: number, now = Date.now()): NightSession {
  const prev = loadNight()?.prevMode ?? safeStorage().get<string | null>(MODE_KEY, null);
  const s: NightSession = { start: now, hours, units, results: {}, lastBreak: now, prevMode: prev === "night" ? null : prev, recall: [], recovered: 0 };
  saveNight(s);
  safeStorage().set(MODE_KEY, "night");
  return s;
}

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
  const open = (u: NightUnit) => !s.results[u.id] && u.id !== after;
  return s.units.slice(i + 1).find(open) ?? s.units.slice(0, Math.max(0, i)).find(open) ?? null;
}

/** Where the night stands: covered lessons, lessons ahead (+) or behind (−) the even pace, seconds per remaining
 *  lesson to still finish on time (breaks kept), projected finish time. */
export function nightPace(s: NightSession, now = Date.now()) {
  const total = s.units.length;
  const covered = s.units.filter((u) => s.results[u.id]).length;
  const left = total - covered;
  const span = s.hours * HOUR;
  const elapsed = Math.max(0, now - s.start);
  const msLeft = Math.max(0, span - elapsed);
  const ahead = Math.round(covered - Math.min(total, (elapsed / span) * total));
  const breaksLeft = Math.floor(msLeft / ((BREAK_EVERY_MIN + BREAK_MIN) * 60_000));
  const perLesson = left ? Math.max(0, (msLeft - breaksLeft * BREAK_MIN * 60_000) / left / 1000) : 0;
  const finishAt = covered >= 3 ? now + (elapsed / covered) * left : s.start + span;
  return { total, covered, left, elapsed, msLeft, ahead, perLesson, finishAt, end: s.start + span };
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
