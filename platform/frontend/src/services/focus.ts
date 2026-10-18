/** Focus mode (study lock). The macOS Focus Lock app polls /api/focus/status and locks the screen while `locked`. */
import { ApiError } from "./api";

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
const post = <T,>(p: string, b?: unknown) => call<T>(p, { method: "POST", body: b === undefined ? undefined : JSON.stringify(b) });

export interface FocusSession {
  id: string; status: "active" | "completed" | "expired" | "emergency" | "cancelled"; goal_lessons: number; goal_minutes: number; max_minutes: number;
  lessons_done: string[]; minutes_done: number; started_at: string; ends_by: string; ended_at: string | null; end_reason: string | null; can_cancel: boolean;
  emergency: { requested_at: string; available_at: string; wait_seconds: number } | null;
}
export interface FocusStatus { locked: boolean; session: FocusSession | null; server_time: string }
export interface FocusSettings { default_lessons: number; default_minutes: number; max_minutes: number; pin_set: boolean; phrase: string }

export const focus = {
  status: () => call<FocusStatus>("/api/focus/status"),
  settings: () => call<FocusSettings>("/api/focus/settings"),
  saveSettings: (b: Partial<FocusSettings> & { pin?: string; clear_pin?: boolean }) => call<FocusSettings>("/api/focus/settings", { method: "PUT", body: JSON.stringify(b) }),
  start: (b: { lessons: number; minutes: number; max_minutes?: number }) => post<FocusSession>("/api/focus/start", b),
  cancel: () => post<FocusSession>("/api/focus/cancel"),
  emergencyRequest: () => post<FocusSession>("/api/focus/emergency/request"),
  emergencyConfirm: (b: { pin?: string; phrase?: string }) => post<FocusSession>("/api/focus/emergency/confirm", b),
  history: () => call<FocusSession[]>("/api/focus/history"),
};

/** True inside the macOS Focus Lock app's window (it appends this marker to the user agent). */
export const inLockApp = () => typeof navigator !== "undefined" && navigator.userAgent.includes("EnglishFocusLock");
