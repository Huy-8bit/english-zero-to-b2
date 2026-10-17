import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const KIND_LABELS: Record<string, string> = {
  grammar: "Ngữ pháp", vocabulary: "Từ vựng", pronunciation: "Phát âm", listening: "Nghe", speaking: "Nói",
  reading: "Đọc", writing: "Viết", skills: "Kỹ năng tổng hợp", communication: "Giao tiếp", practice: "Luyện tập",
  exam: "Kiểm tra", reference: "Tra cứu",
};

export const STATUS_LABELS: Record<string, string> = {
  not_started: "Chưa học", in_progress: "Đang học", completed: "Hoàn thành", review: "Cần ôn lại",
};

/** Plain text from inline Markdown, e.g. for speech synthesis. */
export function plain(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, "$1$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Resolve a relative link found in a curriculum document to a repository path. */
export function resolveDocPath(fromPath: string, href: string): { path: string; hash: string } | null {
  if (/^(https?:|mailto:)/.test(href)) return null;
  const [raw, hash = ""] = href.split("#");
  if (!raw) return { path: fromPath, hash };
  const base = fromPath.split("/").slice(0, -1);
  for (const part of raw.split("/")) {
    if (part === "..") base.pop();
    else if (part && part !== ".") base.push(part);
  }
  return { path: base.join("/"), hash };
}

export function safeStorage() {
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const v = localStorage.getItem(key);
        return v ? (JSON.parse(v) as T) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage full or blocked: data is still saved on the server */
      }
    },
    remove(key: string) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} phút`;
  const h = Math.floor(min / 60);
  return `${h} giờ ${Math.round(min % 60)} phút`;
}
