/** Browser speech synthesis (TTS). This is a synthetic voice, not recorded audio. */
export const ttsSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

let cachedVoices: SpeechSynthesisVoice[] = [];
function voices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length) cachedVoices = v;
  return cachedVoices;
}
if (ttsSupported()) window.speechSynthesis.onvoiceschanged = () => voices();

export function englishVoices(): SpeechSynthesisVoice[] {
  return voices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

export interface SpeakOptions {
  rate?: number;
  voiceIndex?: number;
  onEnd?: () => void;
  onBoundary?: () => void;
}

export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!ttsSupported() || !text.trim()) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = opts.rate ?? 1;
  const en = englishVoices();
  if (en.length) u.voice = en[(opts.voiceIndex ?? 0) % en.length];
  if (opts.onEnd) {
    u.onend = opts.onEnd;
    u.onerror = opts.onEnd;
  }
  window.speechSynthesis.speak(u);
  return true;
}

/** Speak a sequence (e.g. dialogue lines), alternating voices per speaker. */
export function speakSequence(lines: { text: string; speaker?: string }[], opts: { rate?: number; onLine?: (i: number) => void; onDone?: () => void } = {}) {
  if (!ttsSupported()) return () => {};
  window.speechSynthesis.cancel();
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
    window.speechSynthesis.cancel();
  };
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

export function pauseSpeaking() {
  if (ttsSupported()) window.speechSynthesis.pause();
}

export function resumeSpeaking() {
  if (ttsSupported()) window.speechSynthesis.resume();
}
