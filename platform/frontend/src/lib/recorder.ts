import { useEffect, useRef, useState } from "react";

export interface Recording { blob: Blob; seconds: number; url: string }

/** Microphone recording with a time limit. `stop()` resolves the recording via `onDone`. */
export function useRecorder(maxSeconds: number, onDone: (r: Recording) => void) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setElapsed(s);
      if (s >= maxSeconds && rec.state === "recording") rec.stop();
    }, 200);
    return () => clearInterval(t);
  }, [rec, maxSeconds]);
  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
        setRec(null);
        done.current({ blob, seconds: Math.round((Date.now() - started.current) / 100) / 10, url: URL.createObjectURL(blob) });
      };
      started.current = Date.now();
      setElapsed(0);
      r.start();
      setRec(r);
    } catch {
      setError("Không truy cập được micro. Hãy cho phép quyền micro cho trang này.");
    }
  };
  const stop = () => { if (rec && rec.state === "recording") rec.stop(); };
  return { supported, recording: !!rec, elapsed, error, start, stop };
}
