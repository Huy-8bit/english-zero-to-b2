/** Client for the vocabulary module (/api/vocab). AI endpoints throw AIRequestError with a code (ai_disabled, …). */
import { AIRequestError } from "./ai";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new AIRequestError(0, "Không kết nối được máy chủ. Hãy thử lại.", "network", true);
  }
  if (res.status === 401) window.dispatchEvent(new CustomEvent("em-auth-required"));
  if (!res.ok) {
    let body: { message?: string; detail?: unknown; code?: string; retryable?: boolean } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    const msg = body.message ?? (typeof body.detail === "string" ? body.detail : `Lỗi ${res.status}`);
    throw new AIRequestError(res.status, msg, body.code ?? String(res.status), body.retryable ?? res.status >= 500);
  }
  return res.json() as Promise<T>;
}
const post = <T,>(path: string, body?: unknown) => call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const qs = (p: Record<string, unknown>) => {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)]));
  return q.size ? `?${q}` : "";
};

export type ProgressState = "new" | "learning" | "review" | "relearning" | "mastered";
export interface WordProgress {
  state: ProgressState; due: string | null; reps: number; lapses: number; stability: number | null; saved: boolean; known: boolean;
  difficult: boolean; suspended: boolean; note: string | null; own_example: string | null; seen: boolean; learned: boolean;
  correct_count: number; incorrect_count: number; recalled_after_delay: boolean; used_correctly: boolean; used_count: number; last_review: string | null;
}
export interface WordCard {
  id: string; lemma: string; headword: string; kind: string; cefr: string | null; pos: string[]; pos_vi: string[];
  ipa_uk: string | null; ipa_us: string | null; ipa_status: string; meaning_vi: string | null; definition_en: string | null;
  example: { en: string; vi: string | null } | null; topics: string[]; status: string; progress: WordProgress | null;
}
export interface Related { word: string; entry_id: string | null }
export interface WordDetail extends WordCard {
  variants: string[]; forms: string[]; ipa_source: string | null; ipa_curriculum: string | null; cefr_source: string | null;
  freq_rank: number | null; tier: number | null; academic: boolean; topic_names: string[]; topic_sources: string[];
  senses: { id: string; pos: string | null; pos_vi: string | null; meaning_vi: string; definition_en: string | null; usage: string[]; pattern: string | null; source: string; status: string; cefr: string | null }[];
  examples: { id: string; en: string; vi: string | null; source: string; ref: string | null; status: string }[];
  collocations: { phrase: string; meaning_vi: string | null; focus: string | null; entry_id: string | null; source: string; status: string }[];
  family: Related[]; synonyms: Related[]; antonyms: Related[];
  confused_with: { words: string[]; note_vi: string; example: string; source: string; entries: Related[] }[];
  common_mistakes: { vi?: string; wrong?: string; right?: string; source: string }[]; units: string[]; sources: string[]; review_flags: string[];
  history: { at: string; mode: string; rating: number | null; correct: boolean | null; verdict: string | null; state_after: string | null }[];
  collections: { id: number; name: string }[];
  my_mistakes: { at: string; mode: string; error_type: string; answer: string; expected: string; resolved: boolean }[];
  preview: Record<"again" | "hard" | "good" | "easy", string> | null;
}
export interface PlanTask { key: string; label_vi: string; count: number }
export interface Plan {
  new_goal: number; new_left: number; new_today: number; due_now: number; due_today: number; weak: string[]; collocations: number;
  tasks: PlanTask[]; minutes: number; per_item_seconds: number | null; adjustments_vi: string[];
  profile: { name: "support" | "steady" | "stretch"; accuracy: number | null; samples: number; reason_vi: string };
  settings: VocabSettings;
}
export interface VocabSettings { daily_new: number; retention: number; timed_speed: boolean; accent: "uk" | "us"; level: string | null }
export interface LevelStat { total: number; encountered: number; learned: number; mastered: number }
export interface Stats {
  total_available: number; by_level_total: Record<string, number>; counts: Partial<Record<
    "encountered" | "practiced" | "learned" | "answered_correctly" | "recalled_after_delay" | "used_correctly" | "used_writing" | "used_speaking" |
    "mastered" | "saved" | "difficult" | "known" | "in_schedule" | "due" | "forgotten", number>>;
  recall_accuracy: number | null; overall_accuracy: number | null; graded_30d: number; recall_30d: number;
  estimated_retention: number | null; retention_cards: number; by_level: Record<string, LevelStat>;
  by_topic: ({ id: string; name_vi: string } & LevelStat)[];
  collocations: { total: number; learned: number; mastered: number; accuracy: number | null; attempts_30d: number };
  daily: { date: string; reviews: number; correct: number; scheduled: number }[]; algorithm: string; notes_vi: string;
  profile?: Plan["profile"]; dataset?: Dataset;
}
export interface Dataset { version: string | null; counts: Record<string, number>; algorithm: string }
export interface Overview {
  plan: Plan; stats: Stats; weak: WordCard[]; recent: { learned: { entry_id: string; lemma: string; at: string }[]; forgotten: { entry_id: string; lemma: string; at: string | null }[] };
  continue: { id: string; kind: string; title_vi: string; answered: number; total: number } | null; modes: Record<string, string>; dataset: Dataset;
}
export interface Topic { id: string; name: string; name_vi: string; band: string; total: number; encountered: number; learned: number; mastered: number }

export interface SessionItem {
  id: string; type: "learn" | "flashcard" | "mc_meaning" | "mc_word" | "listen_choose" | "type_word" | "dictation" | "cloze" | "collocation" | "builder" | "confusable" | "use_it" | "translate";
  entry_id?: string; round: number; scheduled: boolean; prompt_vi?: string;
  // learn / flashcard
  word?: string; lemma?: string; kind?: string; cefr?: string; pos?: string; pos_vi?: string; ipa_uk?: string | null; ipa_us?: string | null;
  meaning_vi?: string; definition_en?: string | null; senses?: { pos_vi: string | null; meaning_vi: string; usage: string[] }[]; usage?: string[];
  example?: { en: string; vi: string | null } | null; collocations?: string[]; family?: string[]; context?: string | null;
  mistake?: { vi?: string; wrong?: string; right?: string } | null; confused?: { words: string[]; note_vi: string } | null;
  // choice
  options?: string[]; sentence?: string; phrase?: string | null; ai_generated?: boolean;
  // typing
  example_vi?: string; hint?: { first: string; length: number; words: number }; words?: number; ipa_after?: boolean;
  // builder
  tokens?: string[]; end?: string;
  // translate (Vietnamese sentence → English)
  vi?: string;
}
export interface AnswerResult {
  item_id: string; type: string; entry_id: string; entry: { lemma: string; headword: string; ipa_uk: string | null; ipa_us: string | null };
  correct: boolean | null; verdict: string; expected?: string; expected_index?: number; answer?: string | number; full?: string; vi?: string | null;
  explain?: { word: string; meaning_vi: string; correct: boolean }[]; note_vi?: string | null; confused_meaning?: string; confused_with?: string;
  ai_checked?: boolean; ai_explanation_vi?: string; ai_unavailable?: string; detail?: string; used_word?: boolean;
  schedule?: { rating: number; rating_name: string; due: string | null; state: string }; retry_added?: boolean; session_complete?: boolean;
  // use it
  issues?: { original: string; correction: string; explanation_vi: string }[]; corrected_sentence?: string; explanation_vi?: string; better_example?: string; ai?: boolean;
}
export interface Summary {
  answered: number; correct: number; words: { entry_id: string; lemma: string; state: string; due: string | null }[];
  learned: string[]; recalled: string[]; difficult: string[];
  mistakes: { entry_id: string; lemma: string; type: string; verdict: string; answer: unknown; expected: unknown }[];
  scheduled: number; next_review: string | null; suggestions: { mode: string; label_vi: string }[]; duration_ms: number;
}
export interface Session {
  id: string; kind: string; title_vi: string; status: "active" | "finished"; params: Record<string, unknown>; items: SessionItem[];
  results: Record<string, AnswerResult>; cursor: number; answered: number; total: number; summary: Summary | null; created_at: string | null;
}
export interface Collection { id: number; name: string; description: string | null; system_key: string | null; count: number }
export interface Dialogue {
  id: string; situation: string; status: string; used: Record<string, number>;
  turns: { role: "ai" | "user"; text: string; hint_vi?: string; used?: string[]; corrections?: { original: string; correction: string; explanation_vi: string }[]; feedback_vi?: string }[];
  targets: { entry_id: string; lemma: string; meaning_vi: string | null }[];
}
export interface EnrichmentStatus {
  candidates: number; jobs: Record<string, number>; waiting: number; needs_review: number; dataset: Dataset;
  review: { id: number; lemma: string; problems: string[]; model: string | null; result: { senses: { pos: string; meaning_vi: string; definition_en: string }[]; examples: { en: string; vi: string }[]; cefr_estimate: string; collocations: string[] } }[];
}

export type SessionKind = "daily" | "review" | "learn" | "sprint" | "translate" | "flashcards" | "type" | "dictation" | "context" | "collocation" | "builder" | "use" | "speed" | "weak" | "custom" | "gaps";
export interface SprintWord { entry_id: string; word: string; ipa: string | null; pos_vi: string; meaning_vi: string; cefr: string | null }
export interface Sprint {
  goal: number; learned_today: number; new_left: number; batch_size: number; batches_total: number; batches_done: number;
  minutes_per_batch: number; minutes_left: number; due_now: number; backlog: number; adjustments_vi: string[];
  review_forecast: { day: string; reviews: number }[]; next: { topic: string | null; words: SprintWord[] };
}
export interface SessionParams { topic?: string; level?: string; collection?: number; entry_ids?: string[]; size?: number }
export interface EntryFilters { q?: string; level?: string; topic?: string; kind?: string; mastery?: string; saved?: boolean; difficult?: boolean; collection?: number; page?: number; size?: number; sort?: "order" | "az" }

export const vocab = {
  overview: () => call<Overview>("/api/vocab/overview"),
  topics: () => call<Topic[]>("/api/vocab/topics"),
  entries: (f: EntryFilters) => call<{ items: WordCard[]; total: number; page: number; size: number }>(`/api/vocab/entries${qs({ ...f })}`),
  entry: (id: string) => call<WordDetail>(`/api/vocab/entries/${encodeURIComponent(id)}`),
  progress: (id: string, action: string, value?: string) => post<WordProgress>(`/api/vocab/entries/${encodeURIComponent(id)}/progress`, { action, value }),
  lookup: (word: string) => call<{ word: string; lemmas: string[]; entries: WordDetail[] }>(`/api/vocab/lookup${qs({ word })}`),
  lookupContext: (word: string, sentence: string) =>
    post<{ lemma: string; pos: string; sense_index: number; meaning_vi_in_context: string; explanation_vi: string; entry_id: string | null }>("/api/vocab/lookup/context", { word, sentence }),
  collections: () => call<{ collections: Collection[]; templates: Record<string, string> }>("/api/vocab/collections"),
  createCollection: (body: { name?: string; description?: string; template?: string }) => post<Collection>("/api/vocab/collections", { name: "", ...body }),
  renameCollection: (id: number, name: string) => call<{ ok: boolean }>(`/api/vocab/collections/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteCollection: (id: number) => call<{ ok: boolean }>(`/api/vocab/collections/${id}`, { method: "DELETE" }),
  addToCollection: (id: number, entry_id: string) => post<{ added: boolean }>(`/api/vocab/collections/${id}/items`, { entry_id }),
  removeFromCollection: (id: number, entry_id: string) => call<{ ok: boolean }>(`/api/vocab/collections/${id}/items/${encodeURIComponent(entry_id)}`, { method: "DELETE" }),
  capture: (body: { text?: string; entry_id?: string; module: "reading" | "listening" | "writing" | "speaking" | "lesson"; context?: string; ref?: string; meaning_vi?: string; example?: string }) =>
    post<{ entry_id: string; lemma: string; personal: boolean; collection_id: number; added: boolean; progress: WordProgress }>("/api/vocab/capture", body),
  plan: () => call<Plan>("/api/vocab/plan"),
  sprint: () => call<Sprint>("/api/vocab/sprint"),
  sprintKnown: (entry_ids: string[]) => post<{ known: number }>("/api/vocab/sprint/known", { entry_ids }),
  saveSettings: (s: Partial<VocabSettings>) => call<VocabSettings>("/api/vocab/settings", { method: "PUT", body: JSON.stringify(s) }),
  start: (kind: SessionKind, params: SessionParams = {}) => post<Session>("/api/vocab/sessions", { kind, ...params }),
  startAI: (entry_ids?: string[]) => post<Session>("/api/vocab/sessions/ai", { entry_ids }),
  sessions: (status?: "active" | "finished") => call<{ id: string; kind: string; title_vi: string; status: string; answered: number; total: number; created_at: string; summary: Summary | null }[]>(`/api/vocab/sessions${qs({ status })}`),
  session: (id: string) => call<Session>(`/api/vocab/sessions/${id}`),
  answer: (id: string, body: Record<string, unknown>) => post<AnswerResult>(`/api/vocab/sessions/${id}/answer`, body),
  finish: (id: string) => post<Summary>(`/api/vocab/sessions/${id}/finish`),
  itemAudio: (sid: string, itemId: string) => call<{ url: string }>(`/api/vocab/sessions/${sid}/items/${itemId}/audio`),
  itemSpeakText: (sid: string, itemId: string) => call<{ b64: string }>(`/api/vocab/sessions/${sid}/items/${itemId}/speak-text`),
  audio: (id: string, accent: "uk" | "us" = "uk") => call<{ url: string }>(`/api/vocab/audio/${encodeURIComponent(id)}${qs({ accent })}`),
  stats: () => call<Stats>("/api/vocab/stats"),
  tutor: (body: { entry_id: string; action: string; question?: string; compare_with?: string }) =>
    post<{ answer: string; sources: { lesson_id: string | null; section_title: string }[] }>("/api/vocab/tutor", body),
  situations: () => call<Record<string, string>>("/api/vocab/dialogue/situations"),
  dialogue: (situation: string, entry_ids?: string[]) => post<Dialogue>("/api/vocab/dialogue", { situation, entry_ids }),
  reply: (id: string, text: string) => post<{ dialogue: Dialogue; used_now: string[] }>(`/api/vocab/dialogue/${id}/reply`, { text }),
  enrichment: () => call<EnrichmentStatus>("/api/vocab/enrichment"),
  enrichQueue: (limit: number) => post<EnrichmentStatus>("/api/vocab/enrichment/queue", { limit }),
  enrichRun: (batches: number, size: number) => post<EnrichmentStatus & { done: number; failed: number }>("/api/vocab/enrichment/run", { batches, size }),
  enrichDecide: (id: number, decision: "approve" | "reject") => post<{ entry_id?: string; ok?: boolean }>(`/api/vocab/enrichment/${id}/${decision}`),
};

export const STATE_LABELS: Record<ProgressState, string> = {
  new: "Mới", learning: "Đang học", review: "Đang ôn", relearning: "Học lại", mastered: "Đã vững",
};
export const STATE_TONES: Record<ProgressState, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  new: "neutral", learning: "primary", review: "success", relearning: "warning", mastered: "success",
};
export const VERDICT_LABELS: Record<string, string> = {
  correct: "Chính xác", acceptable: "Chấp nhận được", spelling: "Sai chính tả", wrong_form: "Sai dạng từ", wrong_meaning: "Sai nghĩa",
  incorrect: "Chưa đúng", self_accepted: "Bạn tự chấp nhận", again: "Quên", hard: "Khó", good: "Nhớ", easy: "Dễ",
  wrong_order: "Đúng từ, sai trật tự", mismatch: "Khác câu mẫu — hãy so sánh", minor_issues: "Đúng, còn lỗi nhỏ", missing_word: "Chưa dùng từ", self_correct: "Tự đánh giá: đúng", self_partly: "Tự đánh giá: gần đúng", self_wrong: "Tự đánh giá: sai",
};
export const MODE_INFO: { kind: SessionKind; title: string; desc: string; ai?: boolean }[] = [
  { kind: "learn", title: "Học từ mới", desc: "5–10 từ: nghe, nghĩa, ví dụ, nhận diện rồi nhớ lại" },
  { kind: "flashcards", title: "Flashcards", desc: "Tự nhớ trước khi lật thẻ, chấm Quên / Khó / Nhớ / Dễ" },
  { kind: "type", title: "Gõ đáp án", desc: "Nhìn nghĩa tiếng Việt, gõ từ tiếng Anh" },
  { kind: "dictation", title: "Nghe – chép", desc: "Nghe phát âm và gõ lại từ" },
  { kind: "context", title: "Từ trong ngữ cảnh", desc: "Điền từ phù hợp vào câu thật" },
  { kind: "collocation", title: "Collocation", desc: "make / do / take…: kết hợp từ tự nhiên" },
  { kind: "builder", title: "Sắp xếp câu", desc: "Kéo thả hoặc dùng bàn phím để tạo câu" },
  { kind: "use", title: "Tự đặt câu", desc: "Viết câu với từ vừa học, AI chấm và giải thích", ai: true },
  { kind: "speed", title: "Ôn nhanh", desc: "3–5 phút trộn nhiều dạng câu hỏi" },
  { kind: "weak", title: "Từ hay quên", desc: "Phân biệt từ dễ nhầm, luyện lại từ khó" },
];
export const LEVEL_OPTIONS = ["A1", "A2", "B1", "B2"];
