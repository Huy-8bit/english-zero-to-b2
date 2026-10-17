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

export type AssistantAction = "progress" | "vocab" | "eta" | "mistakes" | "next";
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
  { action: "progress", label: "Tiến độ của tôi" },
  { action: "vocab", label: "Từ vựng của tôi" },
  { action: "eta", label: "Khi nào tôi xong?" },
  { action: "mistakes", label: "Tôi hay sai gì?" },
  { action: "next", label: "Nên học gì tiếp?" },
];
