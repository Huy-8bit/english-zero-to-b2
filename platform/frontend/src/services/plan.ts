/** Daily study plan and smart review. Progress comes from the server's study journal. */
import { api, ApiError } from "./api";
import type { QuizItem } from "@/types/content";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }).catch(() => {
    throw new ApiError(0, "Không kết nối được máy chủ.");
  });
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try {
      const b = await res.json();
      if (typeof b.detail === "string") msg = b.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export interface PlanAction { label: string; type: "link" | "vocab_session"; link?: string; kind?: string }
export interface PlanBlock { id: string; category: string; title: string; why_vi: string; minutes: number; done_minutes: number; status: "done" | "in_progress" | "todo"; action: PlanAction }
export type TimelineItem = ({ type: "block" } & PlanBlock) | { type: "break"; minutes: number; long: boolean; tips: string[] };
export interface Quest { id: string; title: string; progress: number; goal: number; xp: number; done: boolean }
export interface DayPlan {
  date: string; target_minutes: number; minutes_today: number; percent: number; blocks_done: number; blocks_total: number; current_block: string | null;
  timeline: TimelineItem[]; blocks: PlanBlock[]; quests: Quest[]; break_tips: string[]; streak: number; principles_vi: string[];
}
export interface SmartReview {
  quick: boolean; total: number;
  sections: { id: "curriculum" | "corrections" | "vocab" | "lessons"; title: string; count: number; why_vi: string }[];
  curriculum_items: { item_id: string; quiz_id: string; unit_id: string; unit_title: string; response: string; item: QuizItem; step_title: string }[];
  corrections: { id: number; source: string; context: string; wrong: string; error_type: string; times: number; streak: number }[];
  vocab: { due: number; mistakes: number; weak: number };
  lessons: { lesson_id: string; title: string; level: string; reason_vi: string; link: string }[];
  weak_topics: { topic_id: string; title: string; mastery: number }[];
  hot_units: { unit_id: string; title: string; wrong: number }[];
}
export interface CorrectionResult { correct: boolean; similarity: number; expected: string; explanation: string; status: string; streak: number; note_vi: string }

export const plan = {
  today: () => call<DayPlan>("/api/plan/today"),
  smart: (quick = false) => call<SmartReview>(`/api/review/smart${quick ? "?quick=true" : ""}`),
  correct: (id: number, answer: string) => call<CorrectionResult>(`/api/review/corrections/${id}`, { method: "POST", body: JSON.stringify({ answer }) }),
  setGoal: (minutes: number) => api.saveProfile({ daily_goal_minutes: minutes }),
};
