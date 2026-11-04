/** VSTEP B2 rush: progress per item (Leitner box 0–3, kept in the browser), the 10-hour / 2-day plan, batch picking. */
import { safeStorage } from "@/lib/utils";
import { DECKS, DECK_BY_ID, type RushItem } from "./decks";
import { VERBS, type Verb } from "./verbs";

const KEY = "em-vstep-rush";
/** Box from which an item counts as learnt (answered right from memory at least twice in a row). */
export const MASTER = 2;
export const BATCH = 8;
export const SESSION_ITEMS = 24;

export interface ItemState { box: number; seen: number; wrong: number; last: number }
export interface RushState { start: number | null; seconds: Record<string, number>; items: Record<string, ItemState> }

export const verbId = (v: Verb) => `v-${v.base}`;
export const VERB_BY_ID: Record<string, Verb> = Object.fromEntries(VERBS.map((v) => [verbId(v), v]));
export const PHRASE_BY_ID: Record<string, RushItem & { deck: string }> =
  Object.fromEntries(DECKS.flatMap((d) => d.items.map((it) => [it.id, { ...it, deck: d.id }])));

/** Deck → item ids (verb decks by pattern; phrase decks from decks.ts). */
export const DECK_ITEMS: Record<string, string[]> = {
  "iv-1": VERBS.filter((v) => v.pattern === "AAA" || v.pattern === "ABB").map(verbId),
  "iv-2": VERBS.filter((v) => v.pattern === "ABC" || v.pattern === "ABA").map(verbId),
  ...Object.fromEntries(DECKS.map((d) => [d.id, d.items.map((i) => i.id)])),
};
export const DECK_TITLE: Record<string, string> = {
  "iv-1": "Động từ bất quy tắc · A–A–A, A–B–B", "iv-2": "Động từ bất quy tắc · A–B–C, A–B–A",
  ...Object.fromEntries(DECKS.map((d) => [d.id, d.title])), review: "Ôn lỗi (từ còn sai)", mixed: "Ôn tổng ngẫu nhiên",
};
export const ALL_IDS = Object.values(DECK_ITEMS).flat();

/** 10 blocks of about an hour: two days of 5 hours. */
export const PLAN: { day: 1 | 2; title: string; decks: string[] }[] = [
  { day: 1, title: "Động từ bất quy tắc: A–A–A và A–B–B", decks: ["iv-1"] },
  { day: 1, title: "Viết Task 1: thư / email", decks: ["w1"] },
  { day: 1, title: "Viết Task 2: bài luận", decks: ["w2"] },
  { day: 1, title: "Chủ đề: Giáo dục + Công nghệ", decks: ["t-edu", "t-tech"] },
  { day: 1, title: "Chủ đề: Môi trường + Sức khỏe · ôn lỗi ngày 1", decks: ["t-env", "t-health"] },
  { day: 2, title: "Động từ bất quy tắc: A–B–C và A–B–A", decks: ["iv-2"] },
  { day: 2, title: "Nói Part 1 + Part 2", decks: ["s1", "s2"] },
  { day: 2, title: "Nói Part 3 + Chủ đề: Công việc", decks: ["s3", "t-work"] },
  { day: 2, title: "Chủ đề: Xã hội & đô thị + Du lịch & văn hóa + Gia đình", decks: ["t-city", "t-travel", "t-family"] },
  { day: 2, title: "Ôn tổng: từ còn sai + ngẫu nhiên, rồi luyện dàn ý Viết & Nói", decks: ["review", "mixed"] },
];
export const PLAN_HOURS = 10;

export function loadRush(): RushState {
  return { start: null, seconds: {}, items: {}, ...safeStorage().get<Partial<RushState>>(KEY, {}) };
}
const saveRush = (s: RushState) => safeStorage().set(KEY, s);

const blank = (): ItemState => ({ box: 0, seen: 0, wrong: 0, last: 0 });

/** Right from memory → one box up; wrong → back to box 0 (asked again soon). */
export function graded(s: RushState, id: string, correct: boolean, now = Date.now()): RushState {
  const it = s.items[id] ?? blank();
  const next = correct ? { ...it, box: Math.min(3, it.box + 1), seen: it.seen + 1, last: now }
    : { ...it, box: 0, seen: it.seen + 1, wrong: it.wrong + 1, last: now };
  return { ...s, start: s.start ?? now, items: { ...s.items, [id]: next } };
}

export function grade(id: string, correct: boolean): RushState {
  const s = graded(loadRush(), id, correct);
  saveRush(s);
  return s;
}

const day = (t: number) => new Date(t).toLocaleDateString("sv-SE"); // YYYY-MM-DD, local
export function addSeconds(sec: number, now = Date.now()): RushState {
  const s = loadRush();
  const k = day(now);
  const next = { ...s, start: s.start ?? now, seconds: { ...s.seconds, [k]: (s.seconds[k] ?? 0) + sec } };
  saveRush(next);
  return next;
}

export const isMastered = (s: RushState, id: string) => (s.items[id]?.box ?? 0) >= MASTER;
export const masteredCount = (s: RushState, ids: string[]) => ids.filter((id) => isMastered(s, id)).length;
export const weakIds = (s: RushState, ids = ALL_IDS) =>
  ids.filter((id) => { const it = s.items[id]; return it && it.seen > 0 && it.box < MASTER; })
    .sort((a, b) => s.items[a].box - s.items[b].box || s.items[b].wrong - s.items[a].wrong || s.items[a].last - s.items[b].last);

/** Items for a session: weak ones the learner has seen first, then new ones in deck order, then (when the deck is
 *  learnt) the least sure ones again. `review`: only seen items still weak; `mixed`: a shuffled spread of everything. */
export function sessionItems(s: RushState, deckId: string, n = SESSION_ITEMS, rand = Math.random): string[] {
  if (deckId === "review") return weakIds(s).slice(0, n);
  if (deckId === "mixed") {
    const pool = ALL_IDS.filter((id) => s.items[id]?.seen).sort(() => rand() - 0.5);
    return [...weakIds(s).slice(0, Math.ceil(n / 2)), ...pool].filter((id, i, a) => a.indexOf(id) === i).slice(0, n);
  }
  const ids = DECK_ITEMS[deckId] ?? [];
  const weak = weakIds(s, ids);
  const fresh = ids.filter((id) => !s.items[id]?.seen);
  const rest = ids.filter((id) => s.items[id]?.seen && !weak.includes(id)).sort((a, b) => s.items[a].box - s.items[b].box || s.items[a].last - s.items[b].last);
  return [...weak, ...fresh, ...rest].slice(0, n);
}

/** The block to work on: the first one whose decks are not 90 % learnt (review blocks never count as done). */
export function planProgress(s: RushState) {
  const blocks = PLAN.map((b, i) => {
    const ids = b.decks.flatMap((d) => DECK_ITEMS[d] ?? []);
    const done = masteredCount(s, ids);
    return { ...b, n: i + 1, total: ids.length, done, complete: ids.length > 0 && done >= ids.length * 0.9 };
  });
  const current = blocks.find((b) => !b.complete) ?? blocks[blocks.length - 1];
  const seconds = Object.values(s.seconds).reduce((a, b) => a + b, 0);
  return { blocks, current, seconds, today: s.seconds[day(Date.now())] ?? 0, learnt: masteredCount(s, ALL_IDS), total: ALL_IDS.length };
}

/** "go – went – gone"; options for a phrase question (3 others from the same deck). */
export const verbLine = (v: Verb) => `${v.base} – ${v.past} – ${v.pp}`;
export function distractors(id: string, rand = Math.random): string[] {
  const deck = DECK_BY_ID[PHRASE_BY_ID[id].deck];
  const others = deck.items.filter((i) => i.id !== id).map((i) => i.id).sort(() => rand() - 0.5).slice(0, 3);
  return [...others, id].sort(() => rand() - 0.5);
}

/** A typed phrase matches when it says the same words (case, punctuation, "…" and alternatives after "/" aside). */
export function phraseMatches(answer: string, en: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/[’']/g, "'").replace(/…|\.\.\./g, " ").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  const a = norm(answer);
  if (!a) return false;
  return [en, ...en.split(" / ")].some((alt) => norm(alt) === a);
}
