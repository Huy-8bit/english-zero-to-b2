import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/misc";

type SR = { start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; continuous: boolean; interimResults: boolean; lang: string; onend: (() => void) | null };

const CHECKLIST = [
  "Trả lời đúng trọng tâm câu hỏi / nhiệm vụ",
  "Nói liên tục, không dừng quá lâu",
  "Dùng được cấu trúc ngữ pháp của bài",
  "Có lý do hoặc ví dụ cụ thể",
  "Phát âm rõ, có âm cuối (tự nghe lại bản ghi)",
];

/**
 * Speaking practice: timer, microphone recording with playback (kept in this browser tab only),
 * optional browser speech recognition. Recognition text is a rough transcript, NOT a pronunciation score.
 */
export function SpeakingRecorder({ notes, onNotes, checklist, onChecklist, disabled }: {
  notes: string; onNotes: (v: string) => void; checklist: Record<string, boolean>; onChecklist: (v: Record<string, boolean>) => void; disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [limit, setLimit] = useState(60);
  const [timerOn, setTimerOn] = useState(false);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recog = useRef<SR | null>(null);
  const supportsRec = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  const SRClass = typeof window !== "undefined" ? ((window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition) : undefined;
  const [useRecognition, setUseRecognition] = useState(false);

  useEffect(() => {
    if (!timerOn) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [timerOn]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setAudioUrl(URL.createObjectURL(new Blob(chunks.current, { type: rec.mimeType })));
      };
      rec.start();
      media.current = rec;
      setRecording(true);
      setElapsed(0);
      setTimerOn(true);
      if (useRecognition && SRClass) {
        const r = new SRClass();
        r.lang = "en-US";
        r.continuous = true;
        r.interimResults = false;
        r.onresult = (e) => {
          const text = Array.from(e.results).map((x) => x[0].transcript).join(" ");
          onNotes(text);
        };
        r.start();
        recog.current = r;
      }
    } catch {
      setError("Không truy cập được micro. Hãy cấp quyền micro cho trang này hoặc luyện nói không ghi âm.");
    }
  };
  const stop = () => {
    media.current?.stop();
    recog.current?.stop();
    setRecording(false);
    setTimerOn(false);
  };
  const over = elapsed >= limit;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-sm tabular-nums">
          <Timer size={14} /> <span className={over ? "text-danger font-semibold" : ""}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span> / {limit / 60 >= 1 ? `${limit / 60} phút` : `${limit}s`}
        </span>
        {[30, 60, 120].map((s) => (
          <button key={s} type="button" onClick={() => setLimit(s)} className={`rounded-lg px-2 py-1 text-xs ${limit === s ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2"}`}>
            {s < 60 ? `${s}s` : `${s / 60} phút`}
          </button>
        ))}
        {!recording && <Button size="sm" variant="ghost" onClick={() => { setTimerOn((v) => !v); }}>{timerOn ? <Pause size={14} /> : <Play size={14} />}{timerOn ? "Dừng giờ" : "Bấm giờ (không ghi âm)"}</Button>}
      </div>
      {supportsRec ? (
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <Button size="sm" onClick={start} disabled={disabled}><Mic size={14} />Ghi âm</Button>
          ) : (
            <Button size="sm" variant="danger" onClick={stop}><Square size={14} />Dừng ghi</Button>
          )}
          {audioUrl && <audio controls src={audioUrl} className="h-9 max-w-full" aria-label="Nghe lại bản ghi của bạn" />}
          {SRClass && (
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={useRecognition} onChange={(e) => setUseRecognition(e.target.checked)} disabled={recording} />
              Tự chép lời bằng nhận diện giọng nói của trình duyệt
            </label>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">Trình duyệt không hỗ trợ ghi âm. Bạn vẫn có thể bấm giờ và luyện nói to.</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-muted">Bản ghi chỉ lưu tạm trong tab này (không gửi lên máy chủ). Nhận diện giọng nói chỉ chép lời gần đúng, không phải chấm điểm phát âm.</p>
      <Textarea rows={3} value={notes} onChange={(e) => onNotes(e.target.value)} disabled={disabled}
        placeholder="Ghi chú ý chính / lời bạn đã nói (không bắt buộc)" aria-label="Ghi chú phần nói" />
      <fieldset className="rounded-xl border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-muted">Tự đánh giá sau khi nói</legend>
        {CHECKLIST.map((c) => (
          <label key={c} className="flex items-start gap-2 py-0.5 text-sm">
            <input type="checkbox" className="mt-1" checked={!!checklist[c]} onChange={(e) => onChecklist({ ...checklist, [c]: e.target.checked })} />
            {c}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
