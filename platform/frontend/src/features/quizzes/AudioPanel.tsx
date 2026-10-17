import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Pause, Play, RotateCcw, Square } from "lucide-react";
import type { DialogueLine } from "@/types/content";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import { pauseSpeaking, resumeSpeaking, speakSequence, stopSpeaking, ttsSupported } from "@/lib/tts";
import { useUI } from "@/stores/ui";
import { TtsNote } from "@/components/SpeakButton";

/**
 * Listening player for transcripts. The curriculum ships no audio files, so playback uses the
 * browser's synthetic voice; the transcript stays hidden until the learner chooses to show it.
 */
export function AudioPanel({ lines, transcriptMd, docPath }: { lines: DialogueLine[]; transcriptMd: string; docPath: string }) {
  const { ttsRate, setTtsRate } = useUI();
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [current, setCurrent] = useState(-1);
  const [plays, setPlays] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const stopRef = useRef<() => void>(() => {});
  const spoken = lines.filter((l) => l.text && !/^\(.*\)$/.test(l.text));
  useEffect(() => () => stopSpeaking(), []);
  const play = () => {
    stopRef.current();
    setPlays((p) => p + 1);
    setState("playing");
    stopRef.current = speakSequence(spoken, {
      rate: ttsRate,
      onLine: setCurrent,
      onDone: () => { setState("idle"); setCurrent(-1); },
    });
  };
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {state === "playing" ? (
          <Button size="sm" onClick={() => { pauseSpeaking(); setState("paused"); }} aria-label="Tạm dừng"><Pause size={15} />Tạm dừng</Button>
        ) : state === "paused" ? (
          <Button size="sm" onClick={() => { resumeSpeaking(); setState("playing"); }}><Play size={15} />Tiếp tục</Button>
        ) : (
          <Button size="sm" onClick={play} disabled={!ttsSupported() || !spoken.length}><Play size={15} />{plays ? "Nghe lại" : "Nghe"}</Button>
        )}
        {state !== "idle" && <Button size="sm" variant="outline" onClick={() => { stopRef.current(); setState("idle"); setCurrent(-1); }}><Square size={14} />Dừng</Button>}
        {state === "idle" && plays > 0 && <Button size="sm" variant="ghost" onClick={play}><RotateCcw size={14} />Phát lại từ đầu</Button>}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          Tốc độ
          <select value={ttsRate} onChange={(e) => setTtsRate(Number(e.target.value))} className="rounded-lg border border-border bg-surface px-2 py-1 text-xs">
            {[0.6, 0.75, 0.9, 1, 1.15].map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        </label>
        <Button size="sm" variant="ghost" onClick={() => setShowTranscript((v) => !v)} aria-pressed={showTranscript}>
          {showTranscript ? <EyeOff size={14} /> : <Eye size={14} />}{showTranscript ? "Ẩn transcript" : "Hiện transcript"}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <TtsNote />
        <span className="text-xs text-muted">Đã nghe {plays} lần{plays > 2 ? " — đề thi thường chỉ cho nghe 1–2 lần" : ""}</span>
      </div>
      {state !== "idle" && current >= 0 && !showTranscript && (
        <p className="mt-2 text-xs text-muted">Đang đọc câu {current + 1}/{spoken.length}{spoken[current]?.speaker ? ` · ${spoken[current].speaker}` : ""}</p>
      )}
      {showTranscript && (
        <div className="mt-3 rounded-xl border border-border bg-surface p-3">
          {lines.some((l) => l.speaker) ? (
            <ol className="space-y-1 text-sm">
              {spoken.map((l, i) => (
                <li key={i} className={i === current ? "rounded bg-primary-soft px-1" : "px-1"}>
                  {l.speaker && <b>{l.speaker}: </b>}{l.text}
                </li>
              ))}
            </ol>
          ) : <Markdown docPath={docPath} className="text-sm">{transcriptMd}</Markdown>}
        </div>
      )}
    </div>
  );
}
