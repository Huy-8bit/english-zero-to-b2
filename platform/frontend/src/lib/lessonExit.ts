/**
 * Where the lesson's close (X) button goes: the last page outside lessons (path, today's plan, dashboard…).
 * Not "history back": after "Bài tiếp theo" the previous history entry is the lesson just finished.
 */
const KEY = "em-lesson-exit";
const DEFAULT = "/path";

export function rememberLessonExit(path: string) {
  if (path.startsWith("/learn/")) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* storage unavailable: the default is used */
  }
}

export function lessonExitPath(): string {
  try {
    const p = sessionStorage.getItem(KEY);
    return p && p.startsWith("/") && !p.startsWith("/learn/") ? p : DEFAULT;
  } catch {
    return DEFAULT;
  }
}
