import { safeStorage } from "@/lib/utils";
import type {
  Card, Dashboard, ItemResult, LessonDetail, LessonState, PathLevel, Recommendations, SearchResult, StepsPayload, Unit,
} from "@/types/content";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.");
  }
  if (res.status === 401) window.dispatchEvent(new CustomEvent("em-auth-required"));
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const body = await res.json();
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail ?? body);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  levels: () => request<{ id: string; name: string; units: number; grammar: number; completed: number; grammar_completed: number }[]>("/api/levels"),
  modules: () => request<{ id: string; name: string; units: number; completed: number }[]>("/api/modules"),
  lessons: (params: { kind?: string; level?: string } = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return request<Unit[]>(`/api/lessons${q.size ? `?${q}` : ""}`);
  },
  lesson: (id: string) => request<LessonDetail & { prerequisites: { id: string; title: string; status: string }[] }>(`/api/lessons/${encodeURIComponent(id)}`),
  steps: (id: string) => request<StepsPayload>(`/api/lessons/${encodeURIComponent(id)}/steps`),
  saveProgress: (id: string, current_step: number, state?: LessonState) =>
    request<{ current_step: number; max_step: number; status: string }>(`/api/progress/${encodeURIComponent(id)}`, {
      method: "PUT", body: json({ current_step, state }), keepalive: true,
    }),
  /** "Kiểm tra vượt bài": server-picked questions; answer them with submitQuiz, then finish. */
  testOutStart: (id: string, size = 8) => request<{ test_id: number; items: string[]; pass_mark: number }>(`/api/lessons/${encodeURIComponent(id)}/test-out?size=${size}`, { method: "POST" }),
  grammarSprint: () => request<GrammarSprint>("/api/grammar-sprint"),
  testOutFinish: (id: string, testId: number) =>
    request<{ test_id: number; passed: boolean; correct: number; total: number; pass_mark: number; xp_gained?: number }>(
      `/api/lessons/${encodeURIComponent(id)}/test-out/${testId}/finish`, { method: "POST" }),
  complete: (id: string) =>
    request<{ status: string; score: number | null; correct: number; graded: number; xp_gained: number; new_achievements: string[]; level_completed: string | null; pass_score: number }>(
      `/api/lessons/${encodeURIComponent(id)}/complete`, { method: "POST" }),
  /** `reveal`: items the learner does not know — the server shows their answer and grades them as not correct. */
  submitQuiz: async (quizId: string, answers: Record<string, unknown>, reveal: string[] = []) => {
    // Preserve a failed request's ID across retries/refresh, then retire it after
    // success so an intentional new attempt gets a new ID.
    const storage = safeStorage();
    const key = `em-quiz-pending-${quizId}`;
    const signature = json([Object.fromEntries(Object.entries(answers).sort(([a], [b]) => a.localeCompare(b))), [...reveal].sort()]);
    const pending = storage.get<{ signature: string; id: string } | null>(key, null);
    const id = pending?.signature === signature ? pending.id : crypto.randomUUID();
    storage.set(key, { signature, id });
    const result = await request<{ results: Record<string, ItemResult>; xp_gained: number; new_achievements: string[] }>(
      `/api/quizzes/${encodeURIComponent(quizId)}/submit`, { method: "POST", body: json({ answers, ...(reveal.length ? { reveal } : {}), client_submission_id: id }) });
    storage.set(key, null);
    return result;
  },
  selfAssess: (attemptId: number, correct: boolean) =>
    request<{ result: ItemResult; xp_gained: number }>(`/api/attempts/${attemptId}/self-assess`, { method: "POST", body: json({ correct }) }),
  path: () => request<{ levels: PathLevel[] }>("/api/path"),
  dashboard: () => request<Dashboard>("/api/dashboard"),
  recommendations: () => request<Recommendations>("/api/recommendations"),
  stats: () => request<{
    attempts: Record<string, number>; modules: { kind: string; started: number; completed: number; minutes: number; total: number }[];
    xp_by_reason: Record<string, number>; history: { unit_id: string; title: string; kind: string; status: string; score: number | null; best_score: number | null; minutes: number; completed_at: string | null; updated_at: string }[];
    achievements: Dashboard["achievements"]; streak: number; xp_total: number;
  }>("/api/stats"),
  mistakes: () => request<{ mistakes: { item_id: string; quiz_id: string; unit_id: string; unit_title: string; response: string; created_at: string; step_title: string; item: import("@/types/content").QuizItem }[] }>("/api/mistakes"),
  vocabulary: (unit?: string) => request<{ cards: Card[]; units: { id: string; title: string; cards: number; seen: number }[] }>(`/api/vocabulary${unit ? `?unit=${encodeURIComponent(unit)}` : ""}`),
  due: (limit = 20, unit?: string) => request<{ cards: Card[]; due_total: number }>(`/api/vocabulary/due?limit=${limit}${unit ? `&unit=${encodeURIComponent(unit)}` : ""}`),
  review: (card_id: string, grade: number) =>
    request<{ card_id: string; srs: Card["srs"]; xp_gained: number; new_achievements: string[] }>("/api/vocabulary/review", { method: "POST", body: json({ card_id, grade }) }),
  heartbeat: (unit_id?: string) => request<{ counted_seconds: number }>("/api/activity/heartbeat", { method: "POST", body: json({ unit_id }), keepalive: true }),
  search: (q: string) => request<{ query: string; results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  library: () => request<{ documents: { path: string; title: string; group: string }[] }>("/api/library"),
  doc: (path: string) => request<{ path: string; title: string; markdown: string; unit_id: string | null; is_answer_file: boolean; units_by_path: Record<string, string> }>(`/api/docs?path=${encodeURIComponent(path)}`),
  writing: (item_id?: string) => request<{ id: number; unit_id: string; unit_title: string; item_id: string; text: string; word_count: number; seconds: number | null; rubric: Record<string, boolean> | null; created_at: string }[]>(`/api/writing${item_id ? `?item_id=${encodeURIComponent(item_id)}` : ""}`),
  saveWriting: (body: { unit_id: string; item_id: string; text: string; seconds?: number; rubric?: Record<string, boolean> }) =>
    request<{ id: number; word_count: number; created_at: string }>("/api/writing", { method: "POST", body: json(body) }),
  note: (unit: string) => request<{ unit_id: string; text: string; updated_at: string | null }>(`/api/notes/${encodeURIComponent(unit)}`),
  saveNote: (unit: string, text: string) => request<{ text: string; updated_at: string }>(`/api/notes/${encodeURIComponent(unit)}`, { method: "PUT", body: json({ text }) }),
  profile: () => request<{ name: string; daily_goal_minutes: number; weekly_goal_lessons: number }>("/api/profile"),
  saveProfile: (body: Partial<{ name: string; daily_goal_minutes: number; weekly_goal_lessons: number }>) =>
    request<{ name: string; daily_goal_minutes: number; weekly_goal_lessons: number }>("/api/profile", { method: "PUT", body: json(body) }),
};

export interface SprintUnit { id: string; title: string; level: string; status: "done" | "study" | "todo"; minutes: number | null; done_today: boolean }
export interface GrammarSprint {
  units: SprintUnit[]; total: number; done: number; remaining: number; today: number; study: SprintUnit[]; next: SprintUnit | null;
  levels: { level: string; total: number; done: number }[];
}
