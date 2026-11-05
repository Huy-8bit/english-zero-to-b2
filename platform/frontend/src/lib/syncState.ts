/**
 * Learning state the app keeps in localStorage (one-night reading, VSTEP rush, sprint plan, lesson drafts…) is mirrored
 * in the database per key, so it survives another browser, cleared browser data and database restores.
 *
 * - hydrate(), once at start-up before any page reads storage: the newer copy of each key wins (the server's when this
 *   browser never changed it); for progress keys both copies are merged so neither side loses readings or answers.
 * - every safeStorage write of a synced key is sent to the server shortly after (retried; flushed when the tab hides).
 * Device preferences (theme, reading speed, focus, reader settings) stay local.
 */
const META = "em-sync-meta"; // key → when this browser last changed it (ms)
const EXACT = new Set([
  "em-grammar-night", "em-vstep-rush", "em-grammar-sprint", "em-sprint-combo", "em-example-vi",
  "em-writing-draft", "em-writing-exam", "em-model-library", "em-placement", "em-block-timer",
]);
const PREFIXES = ["em-lesson-", "em-ex-"]; // lesson drafts and mode, AI exercise answers
const LOCAL_ONLY = new Set(["em-lesson-exit", "em-lesson-save-order-test"]);

export const isSynced = (key: string | null): key is string =>
  !!key && !LOCAL_ONLY.has(key) && (EXACT.has(key) || PREFIXES.some((p) => key.startsWith(p)));

type Entry = { value: unknown; ts: number };
let enabled = false;
const queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the server copy is still there */
  }
}
const meta = (): Record<string, number> => (read(META) as Record<string, number> | null) ?? {};
const saveMeta = (m: Record<string, number>) => write(META, m);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
/** Per-entry newest by a timestamp field (answers, results, item progress). */
function newestBy(a: unknown, b: unknown, field: string): Obj {
  const out: Obj = { ...(isObj(a) ? a : {}) };
  for (const [k, v] of Object.entries(isObj(b) ? b : {})) {
    const cur = out[k];
    if (!isObj(cur) || (isObj(v) && Number(v[field] ?? 0) >= Number(cur[field] ?? 0))) out[k] = v;
  }
  return out;
}

/** Both copies of a progress key: the newer one as the base, readings/answers/items from both. */
export function mergeProgress(key: string, older: unknown, newer: unknown): unknown {
  if (!isObj(older) || !isObj(newer)) return newer;
  if (key === "em-model-library") return { ...newer, items: newestBy(older.items, newer.items, "at") };
  if (key === "em-grammar-night") {
    return {
      ...newer,
      compactRead: [...new Set([...((older.compactRead as string[]) ?? []), ...((newer.compactRead as string[]) ?? [])])],
      briefAnswers: newestBy(older.briefAnswers, newer.briefAnswers, "at"),
      results: newestBy(older.results, newer.results, "at"),
    };
  }
  if (key === "em-vstep-rush") {
    const seconds: Record<string, number> = { ...(older.seconds as Record<string, number>) };
    for (const [d, s] of Object.entries((newer.seconds as Record<string, number>) ?? {})) seconds[d] = Math.max(seconds[d] ?? 0, s);
    const starts = [older.start, newer.start].filter((x): x is number => typeof x === "number");
    return { ...newer, start: starts.length ? Math.min(...starts) : null, seconds, items: newestBy(older.items, newer.items, "last") };
  }
  return newer;
}
const MERGED = new Set(["em-grammar-night", "em-vstep-rush", "em-model-library"]);

/** Called by safeStorage after every write/remove. */
export function localChanged(key: string) {
  if (!enabled || !isSynced(key)) return;
  const m = meta();
  m[key] = Date.now();
  saveMeta(m);
  queue.add(key);
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), 800);
}

export async function flush(keepalive = false): Promise<void> {
  if (!queue.size) return;
  const keys = [...queue];
  queue.clear();
  const m = meta();
  const items: Record<string, Entry> = Object.fromEntries(keys.map((k) => [k, { value: read(k), ts: m[k] ?? 1 }]));
  try {
    const res = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }), keepalive });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    keys.forEach((k) => queue.add(k));
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 15_000);
  }
}

/** Load the server copy before the app reads storage; upload what only this browser has. Offline: keep local. */
export async function hydrate(timeoutMs = 5000): Promise<boolean> {
  let items: Record<string, Entry>;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch("/api/state", { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    items = ((await res.json()) as { items: Record<string, Entry> }).items;
  } catch {
    return false;
  }
  const m = meta();
  for (const [key, s] of Object.entries(items)) {
    if (!isSynced(key)) continue;
    const mine = m[key] ?? 0;
    const local = read(key);
    if (MERGED.has(key) && local !== null && s.value !== null) {
      const merged = mine > s.ts ? mergeProgress(key, s.value, local) : mergeProgress(key, local, s.value);
      write(key, merged);
      if (JSON.stringify(merged) === JSON.stringify(s.value)) m[key] = s.ts;
      else { m[key] = Math.max(Date.now(), s.ts + 1); queue.add(key); }
    } else if (s.ts > mine) {
      write(key, s.value);
      m[key] = s.ts;
    } else if (mine > s.ts) queue.add(key);
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (isSynced(key) && !(key in items)) { m[key] = m[key] ?? 1; queue.add(key); }
  }
  saveMeta(m);
  enabled = true;
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush(true); });
  window.addEventListener("online", () => void flush());
  if (queue.size) await flush();
  return true;
}
