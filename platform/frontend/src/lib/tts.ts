/**
 * Read English text aloud.
 *
 * First choice: a natural AI voice (OpenAI TTS via POST /api/tts — generated once per text on the server and cached).
 * Fallback: the browser's speech synthesis, when AI is off, over its limits or the audio cannot play.
 * Both are synthetic voices, not recordings of a person; the UI says so (OpenAI requires disclosing AI voices).
 */
export const browserTtsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
/** Something can read text aloud (AI voice or browser voice). */
export const ttsSupported = () => typeof window !== "undefined" && (typeof Audio !== "undefined" || browserTtsSupported());

let cachedVoices: SpeechSynthesisVoice[] = [];
function voices(): SpeechSynthesisVoice[] {
  if (!browserTtsSupported()) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) cachedVoices = v;
  return cachedVoices;
}
if (browserTtsSupported()) window.speechSynthesis.onvoiceschanged = () => voices();

export function englishVoices(): SpeechSynthesisVoice[] {
  return voices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

export interface SpeakOptions {
  rate?: number;
  voiceIndex?: number;
  /** slow, clearly articulated reading (pronunciation practice) */
  slow?: boolean;
  accent?: "us" | "uk";
  onEnd?: () => void;
  onBoundary?: () => void;
}

// ------------------------------------------------------------------ AI voice
/** Different speakers in a dialogue get different AI voices. */
const AI_VOICES = ["marin", "cedar", "coral", "ash"];
const urls = new Map<string, string>();
let aiOffUntil = 0; // after an error (AI off, limits, network) use the browser voice for a while
let player: HTMLAudioElement | null = null;
let token = 0; // increments on every new speak/stop: stale async work checks it and gives up
let lastEngine: "ai" | "browser" | null = null;

function audioEl(): HTMLAudioElement {
  if (!player) {
    player = new Audio();
    player.preload = "auto";
  }
  return player;
}

// Safari/WebKit only lets a page play audio started from a user gesture. The AI audio starts after a network request,
// so the shared <audio> element is unlocked once on the first tap/keypress; later plays on it are then allowed.
if (typeof window !== "undefined") {
  const unlock = () => {
    const a = audioEl();
    if (!a.src) {
      a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
      a.play().then(() => a.pause()).catch(() => {});
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

async function aiUrl(text: string, voice: string, slow: boolean, accent: "us" | "uk"): Promise<string | null> {
  if (Date.now() < aiOffUntil) return null;
  const key = `${voice}|${accent}|${slow ? 1 : 0}|${text}`;
  const hit = urls.get(key);
  if (hit) return hit;
  try {
    const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice, accent, slow }) });
    if (!r.ok) {
      aiOffUntil = Date.now() + (r.status === 429 ? 60_000 : r.status >= 500 || r.status === 401 || r.status === 403 ? 300_000 : 0);
      return null;
    }
    const { url } = (await r.json()) as { url: string };
    urls.set(key, url);
    return url;
  } catch {
    aiOffUntil = Date.now() + 60_000;
    return null;
  }
}

function playUrl(url: string, rate: number, my: number): Promise<boolean> {
  return new Promise((resolve) => {
    const a = audioEl();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      a.onended = a.onerror = null;
      resolve(ok);
    };
    a.onended = () => done(true);
    a.onerror = () => done(false);
    a.src = url;
    a.playbackRate = rate;
    a.play().catch(() => done(false));
    // a newer speak/stop cancels this one
    const watch = setInterval(() => { if (my !== token) { clearInterval(watch); done(true); } }, 200);
    a.addEventListener("ended", () => clearInterval(watch), { once: true });
  });
}

/** Split long text at sentence boundaries (each request stays short and starts playing quickly). */
function chunks(text: string, max = 600): string[] {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]*["')\]]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > max && cur) {
      out.push(cur.trim());
      cur = "";
    }
    cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.flatMap((c) => (c.length <= max ? [c] : c.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) ?? [c]));
}

// ------------------------------------------------------------------ browser voice (fallback)
function browserSpeak(text: string, opts: SpeakOptions): boolean {
  if (!browserTtsSupported() || !text.trim()) {
    opts.onEnd?.();
    return false;
  }
  lastEngine = "browser";
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.accent === "uk" ? "en-GB" : "en-US";
  u.rate = (opts.rate ?? 1) * (opts.slow ? 0.7 : 1);
  const en = englishVoices();
  if (en.length) u.voice = en[(opts.voiceIndex ?? 0) % en.length];
  if (opts.onEnd) {
    u.onend = opts.onEnd;
    u.onerror = opts.onEnd;
  }
  window.speechSynthesis.speak(u);
  return true;
}

// ------------------------------------------------------------------ public API (unchanged call sites)
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!text.trim()) return false;
  stopSpeaking();
  const my = ++token;
  const voice = AI_VOICES[(opts.voiceIndex ?? 0) % AI_VOICES.length];
  const parts = chunks(text);
  void (async () => {
    for (let i = 0; i < parts.length; i++) {
      const url = await aiUrl(parts[i], voice, !!opts.slow, opts.accent ?? "us");
      if (my !== token) return;
      if (!url) {
        browserSpeak(parts.slice(i).join(" "), opts);
        return;
      }
      lastEngine = "ai";
      const ok = await playUrl(url, opts.rate ?? 1, my);
      if (my !== token) return;
      if (!ok) {
        browserSpeak(parts.slice(i).join(" "), opts);
        return;
      }
    }
    opts.onEnd?.();
  })();
  return true;
}

/** Speak a sequence (e.g. dialogue lines), a different voice per speaker. */
export function speakSequence(lines: { text: string; speaker?: string }[], opts: { rate?: number; onLine?: (i: number) => void; onDone?: () => void } = {}) {
  if (!ttsSupported()) return () => {};
  stopSpeaking();
  const speakers = Array.from(new Set(lines.map((l) => l.speaker ?? "")));
  let stopped = false;
  const next = (i: number) => {
    if (stopped) return;
    if (i >= lines.length) {
      opts.onDone?.();
      return;
    }
    opts.onLine?.(i);
    speak(lines[i].text, { rate: opts.rate, voiceIndex: speakers.indexOf(lines[i].speaker ?? ""), onEnd: () => next(i + 1) });
  };
  next(0);
  return () => {
    stopped = true;
    stopSpeaking();
  };
}

export function stopSpeaking() {
  token++;
  if (player && !player.paused) player.pause();
  if (browserTtsSupported()) window.speechSynthesis.cancel();
}

export function pauseSpeaking() {
  if (lastEngine === "ai" && player) player.pause();
  else if (browserTtsSupported()) window.speechSynthesis.pause();
}

export function resumeSpeaking() {
  if (lastEngine === "ai" && player) void player.play().catch(() => {});
  else if (browserTtsSupported()) window.speechSynthesis.resume();
}

/** Which voice played last ("ai" = OpenAI voice, "browser" = fallback) — for labels. */
export const currentEngine = () => lastEngine;
