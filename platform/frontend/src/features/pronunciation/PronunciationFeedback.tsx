import { useState } from "react";
import { CheckCircle2, Mic, Square, Turtle, Volume2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AIErrorBox, AILoading } from "@/components/ai/AIStatus";
import { cn } from "@/lib/utils";
import { speak } from "@/lib/tts";
import { useRecorder, type Recording } from "@/lib/recorder";
import { ai, type PronunciationResult, type PronWord } from "@/services/ai";

const STATUS: Record<PronWord["status"], { label: string; cls: string }> = {
  ok: { label: "rõ", cls: "text-fg" },
  unclear: { label: "chưa rõ", cls: "bg-warning-soft text-warning underline decoration-dotted" },
  different: { label: "nghe thành từ khác", cls: "bg-danger-soft text-danger underline decoration-wavy" },
  missing: { label: "bị bỏ sót", cls: "text-muted line-through" },
};

/** Record → upload button used for whole sentences and single words. */
export function RecordButton({ label, onRecorded, maxSeconds = 30, size = "sm", disabled }: {
  label: string; onRecorded: (r: Recording) => void; maxSeconds?: number; size?: "sm" | "md"; disabled?: boolean;
}) {
  const r = useRecorder(maxSeconds, onRecorded);
  if (!r.supported) return <span className="text-xs text-muted">Trình duyệt không hỗ trợ ghi âm.</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {r.recording
        ? <Button size={size} variant="danger" onClick={r.stop}><Square size={14} />Dừng ({Math.floor(r.elapsed)}s)</Button>
        : <Button size={size} onClick={() => void r.start()} disabled={disabled}><Mic size={14} />{label}</Button>}
      {r.error && <span className="text-xs text-danger">{r.error}</span>}
    </span>
  );
}

function useAssess(reference: string, opts: { source: string; level?: string; sourceRef?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const run = async (rec: Recording): Promise<PronunciationResult | null> => {
    setBusy(true);
    setErr(null);
    try {
      return await ai.assessPronunciation(rec.blob, reference, { seconds: rec.seconds, ...opts });
    } catch (e) {
      setErr(e);
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, run };
}

/** One word to fix: dictionary IPA, what was heard, how to make the sound, listen (normal/slow), record the word again. */
function WordFix({ w, level }: { w: PronWord; level?: string }) {
  const { busy, err, run } = useAssess(w.word, { source: "word", level });
  const [retry, setRetry] = useState<PronunciationResult | null>(null);
  const ok = retry && retry.score === 100;
  return (
    <li className="rounded-xl border border-border bg-surface p-3 text-sm" data-testid="word-fix">
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-base">{w.word}</b>
        {w.ipa && <span className="font-mono text-muted" title="IPA từ từ điển">{w.ipa}</span>}
        <Badge tone={w.status === "different" ? "danger" : "warning"}>
          {w.status === "different" ? `máy nghe thành “${w.heard}”` : STATUS[w.status].label}
        </Badge>
        <span className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => speak(w.word)} aria-label={`Nghe “${w.word}”`}><Volume2 size={14} />Nghe</Button>
          <Button size="sm" variant="ghost" onClick={() => speak(w.word, { slow: true })} aria-label={`Nghe chậm “${w.word}”`}><Turtle size={14} />Chậm</Button>
        </span>
      </div>
      {w.explain && (
        <div className="mt-1 space-y-0.5">
          <p><b>Âm cần sửa:</b> {w.explain.sound_vi}</p>
          <p><b>Cách đọc:</b> {w.explain.how_vi}</p>
        </div>
      )}
      {!!w.tips_vi?.length && <ul className="mt-1 space-y-0.5 text-muted">{w.tips_vi.map((t) => <li key={t}>• {t}</li>)}</ul>}
      {!!w.explain?.practice.length && (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">Luyện: {w.explain.practice.map((p) => (
          <button key={p} type="button" className="rounded-full border border-border px-2 py-0.5 hover:border-primary" onClick={() => speak(p, { slow: true })}>{p} 🔊</button>
        ))}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <RecordButton label="Đọc lại từ này" maxSeconds={6} onRecorded={async (r) => setRetry(await run(r))} disabled={busy} />
        {busy && <span className="text-xs text-muted">Đang nghe…</span>}
        {retry && (ok
          ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={14} />Máy đã nghe rõ “{w.word}”!</span>
          : <span className="inline-flex items-center gap-1 text-danger"><XCircle size={14} />Máy nghe thành “{retry.heard || "…"}” — thử lại, đọc chậm hơn.</span>)}
      </div>
      {err != null && <div className="mt-1"><AIErrorBox error={err} /></div>}
    </li>
  );
}

/** Result of reading a sentence aloud: each word coloured by what the recogniser heard, then how to fix the problem words. */
export function PronunciationFeedback({ result, level, source = "practice", sourceRef }: {
  result: PronunciationResult; level?: string; source?: string; sourceRef?: string;
}) {
  const [r, setR] = useState(result);
  const { busy, err, run } = useAssess(r.reference, { source, level, sourceRef });
  const problems = r.words.filter((w) => w.status !== "ok");
  const delta = r.previous_score !== null ? r.score - r.previous_score : null;
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-2/50 p-3" data-testid="pronunciation">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-lg font-bold tabular-nums">Độ rõ: {r.score}%</p>
        {delta !== null && delta !== 0 && <Badge tone={delta > 0 ? "success" : "warning"}>{delta > 0 ? "+" : ""}{delta} so với lần trước</Badge>}
        {r.words_per_minute && <span className="text-xs text-muted">~{r.words_per_minute} từ/phút</span>}
        <Progress className="min-w-32 flex-1" value={r.score} label={`Độ rõ ${r.score}%`} />
      </div>
      <p className="text-[17px] leading-relaxed" aria-label="Câu mẫu, từ được tô màu theo kết quả">
        {r.words.map((w, i) => (
          <span key={i} className={cn("mr-1 inline-block rounded px-0.5", STATUS[w.status].cls)} title={w.status === "ok" ? "Máy nghe rõ" : `${STATUS[w.status].label}${w.heard && w.status === "different" ? `: “${w.heard}”` : ""}`}>
            {w.word}
          </span>
        ))}
      </p>
      <p className="text-xs text-muted">Máy nghe được: “{r.heard}”</p>
      <p className="text-sm">{r.summary_vi}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => speak(r.reference)}><Volume2 size={14} />Nghe câu mẫu</Button>
        <Button size="sm" variant="outline" onClick={() => speak(r.reference, { slow: true })}><Turtle size={14} />Nghe chậm</Button>
        <RecordButton label="Đọc lại cả câu" onRecorded={async (rec) => { const n = await run(rec); if (n) setR(n); }} disabled={busy} />
        {busy && <AILoading label="Đang nghe và chấm…" />}
      </div>
      {err != null && <AIErrorBox error={err} />}
      {problems.length > 0 ? (
        <div>
          <p className="mb-1 text-sm font-semibold">Sửa {problems.length} từ</p>
          <ul className="space-y-2">{problems.map((w, i) => <WordFix key={`${r.attempt_id}-${i}`} w={w} level={level} />)}</ul>
        </div>
      ) : <p className="text-sm font-medium text-success"><CheckCircle2 size={14} className="mr-1 inline" />Máy nghe rõ tất cả các từ. Thử câu dài hơn hoặc đọc nhanh, tự nhiên hơn.</p>}
      <p className="text-xs text-muted">{r.note_vi}</p>
    </div>
  );
}
