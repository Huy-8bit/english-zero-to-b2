/** Learning assistant client. Numbers in answers/cards come from the server's learning data, not from the AI. */
import { AIRequestError } from "./ai";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new AIRequestError(0, "Không kết nối được máy chủ.", "network", true);
  }
  if (res.status === 401) window.dispatchEvent(new CustomEvent("em-auth-required"));
  if (!res.ok) {
    let body: { message?: string; detail?: unknown; code?: string; retryable?: boolean } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new AIRequestError(res.status, body.message ?? (typeof body.detail === "string" ? body.detail : `Lỗi ${res.status}`), body.code ?? String(res.status), body.retryable ?? res.status >= 500);
  }
  return res.json() as Promise<T>;
}

export type AssistantAction = "progress" | "history" | "eta" | "review" | "vocab" | "mistakes" | "next";
export type AssistantCard =
  | { type: "stats"; title: string; rows: [string, string][]; link?: string }
  | { type: "steps"; title: string; steps: { kind: string; title: string; why_vi: string; link: string }[] };
export interface AssistantMessage { role: "user" | "assistant"; content: string; action?: string; cards: AssistantCard[]; at?: string; notice?: string | null; ai?: boolean }
export interface AssistantReply { answer: string; cards: AssistantCard[]; topic: AssistantAction | null; ai: boolean; notice: string | null }

export const assistant = {
  history: () => call<AssistantMessage[]>("/api/assistant/history"),
  chat: (body: { message?: string; action?: AssistantAction }) => call<AssistantReply>("/api/assistant/chat", { method: "POST", body: JSON.stringify(body) }),
  clear: () => call<{ ok: boolean }>("/api/assistant/history", { method: "DELETE" }),
};

export const QUICK: { action: AssistantAction; label: string }[] = [
  { action: "history", label: "Gần đây tôi học gì?" },
  { action: "eta", label: "Bao lâu nữa tôi xong?" },
  { action: "review", label: "Tôi cần ôn gì?" },
  { action: "progress", label: "Tiến độ của tôi" },
  { action: "vocab", label: "Từ vựng của tôi" },
  { action: "mistakes", label: "Tôi hay sai gì?" },
  { action: "next", label: "Nên học gì tiếp?" },
];

export interface JournalDay {
  date: string; weekday: string; minutes: number; items: number; correct: number; accuracy: number | null; vocab_reviews: number; words_learned: number;
  lessons: { key: string; title: string; minutes: number; items: number; correct: number; completed: boolean; score: number | null; level: string | null }[];
  modules: { key: string; title: string; minutes: number; items: number; correct: number }[]; lessons_completed: string[];
}
export interface Scenario { label: string; minutes_per_day: number; days_per_week: number; weeks: number; months: number; finish_date: string }
export interface Insights {
  today: string; journal: JournalDay[];
  periods: Record<"today" | "yesterday" | "this_week" | "last_week" | "last_7_days", { days: number; minutes: number; items: number; accuracy: number | null; lessons: string[]; lessons_completed: string[]; words_learned: number; vocab_reviews: number }>;
  pace: { window_days: number; study_days: number; days_per_week: number; minutes_total: number; minutes_per_week: number; minutes_per_study_day: number;
    lesson_minutes_per_week: number; lessons_completed: number; lessons_per_week: number; personal_speed_factor: number | null; speed_sample_lessons: number; avg_minutes_per_completed_lesson: number | null };
  eta: { target_level: string; remaining_lessons: number; remaining_hours: number; remaining_minutes: number; minutes_basis: string; basis: string; weeks: number; finish_date: string;
    note?: string; scenarios: Scenario[]; remaining_by_level: Record<string, { lessons: number; minutes: number }>; disclaimer_vi: string;
    vocabulary: { target_words: number; learned: number; learned_per_week: number; weeks_at_current_pace: number | null; weeks_at_daily_goal: number | null; daily_new_goal: number } };
  review: { lessons: { lesson_id: string; title: string; level: string; reason_vi: string; link: string; last_studied: string }[]; lessons_due_total: number;
    weak_topics: { topic_id: string; title: string; mastery: number }[]; vocab_due: number };
  progress: { lessons_completed: number; lessons_total: number; percent: number; start_level: string; target_level: string; streak: number; minutes_total: number };
}
export const insights = () => call<Insights>("/api/assistant/insights");
