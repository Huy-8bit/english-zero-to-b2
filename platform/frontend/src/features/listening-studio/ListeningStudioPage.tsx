import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { ai, type ListeningSet, type Review } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBox, Input, PageHeader, Skeleton } from "@/components/ui/misc";
import { LookupText, SaveWordButton } from "@/features/vocab/Lookup";
import { ExerciseRunner } from "@/components/ai/ExerciseRunner";
import { AIErrorBox, AILoading, AIUnavailable, SimulatedBanner, useAIStatus } from "@/components/ai/AIStatus";

const LEVELS = ["A0", "A1", "A2", "B1", "B2"];

export function ListeningStudioPage() {
  const st = useAIStatus();
  const nav = useNavigate();
  const hist = useQuery({ queryKey: ["ai-sets", "listening"], queryFn: () => ai.exercises("listening") });
  const [f, setF] = useState({ level: "A2", topic: "", minutes: 1.5, difficulty: "normal", question_count: 5, format: "dialogue", mode: "practice" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const gen = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await ai.generateListening({ ...f, topic: f.topic || "daily life" });
      nav(`/listening-studio/${r.id}`);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const sel = (k: keyof typeof f, opts: [string | number, string][]) => (
    <select className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2" value={String(f[k])} onChange={(e) => setF({ ...f, [k]: typeof f[k] === "number" ? Number(e.target.value) : e.target.value })}>
      {opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
    </select>
  );
  return (
    <div>
      <PageHeader title="Listening Studio" subtitle="AI viết đoạn hội thoại/bài nói theo trình độ, đọc bằng giọng AI tự nhiên (OpenAI TTS, giọng máy tạo) và tạo câu hỏi chỉ trả lời được khi nghe. Tạo một bài mất khoảng 30–90 giây." />
      <SimulatedBanner />
      {st.data && !st.data.enabled && <div className="mb-4"><AIUnavailable /></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card><CardHeader><CardTitle>Tạo bài nghe</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <label>Trình độ{sel("level", LEVELS.map((l) => [l, l]))}</label>
              <label>Độ dài{sel("minutes", [[1, "≈1 phút"], [1.5, "≈1,5 phút"], [2, "≈2 phút"], [3, "≈3 phút"]])}</label>
              <label>Số câu hỏi{sel("question_count", [[3, "3"], [5, "5"], [8, "8"]])}</label>
              <label>Dạng{sel("format", [["dialogue", "Hội thoại (2 giọng)"], ["monologue", "Bài nói (1 giọng)"]])}</label>
              <label>Độ khó{sel("difficulty", [["easy", "Dễ"], ["normal", "Vừa"], ["hard", "Khó"]])}</label>
              <label>Chế độ{sel("mode", [["practice", "Luyện tập (có thể bật transcript)"], ["test", "Kiểm tra (transcript sau khi nộp)"]])}</label>
            </div>
            <label className="block">Chủ đề<Input className="mt-1" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="vd: booking a hotel, a job interview" /></label>
            <Button onClick={gen} disabled={busy || !st.data?.enabled}><Headphones size={16} />{busy ? "Đang tạo…" : "Tạo bài nghe"}</Button>
            {busy && <AILoading label="AI đang viết kịch bản, kiểm tra câu hỏi và tạo âm thanh…" />}
            {err != null && <AIErrorBox error={err} onRetry={gen} />}
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Bài đã tạo</CardTitle></CardHeader>
          <CardContent><ul className="space-y-2 text-sm">{hist.data?.sets.map((s) => (
            <li key={s.id}><Link to={`/listening-studio/${s.id}`} className="block rounded-xl border border-border p-3 hover:border-primary">{s.title}<span className="block text-xs text-muted">{s.level} · {s.questions} câu · {s.attempts ? `${s.last_score}/${s.questions}` : "chưa làm"}</span></Link></li>))}
            {!hist.data?.sets.length && <p className="text-muted">Chưa có bài nào.</p>}</ul></CardContent></Card>
      </div>
    </div>
  );
}

export function ListeningSetPage() {
  const { setId = "" } = useParams();
  return <ListeningSetPageSession key={setId} setId={setId} />;
}

function ListeningSetPageSession({ setId }: { setId: string }) {
  const [reveal, setReveal] = useState(false);
  const q = useQuery({ queryKey: ["listening", setId, reveal], queryFn: () => ai.listening(setId, reveal) });
  const [data, setData] = useState<ListeningSet | null>(null);
  const [review, setReview] = useState<Review | null | undefined>(undefined);
  if (q.isLoading && !data) return <Skeleton className="h-96" />;
  if (q.error || (!q.data && !data)) return <ErrorBox error={q.error} />;
  const ls = data ?? q.data!;
  const canToggle = ls.transcript_policy === "toggle" && !ls.submitted;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/listening-studio" className="text-sm text-primary">← Listening Studio</Link>
      <h1 className="text-2xl font-bold">{ls.title}</h1>
      <div className="flex flex-wrap gap-2"><Badge>{ls.level}</Badge><Badge>{String(ls.meta.mode) === "test" ? "Chế độ kiểm tra" : "Luyện tập"}</Badge></div>
      <SimulatedBanner />
      <Player src={ls.audio_url} />
      <p className="text-xs text-muted">🔊 Giọng đọc AI (OpenAI TTS) — giọng máy tạo, không phải bản ghi âm người thật. Nghe lại không tạo thêm yêu cầu AI.</p>
      {canToggle && <Button size="sm" variant="outline" onClick={() => setReveal((v) => !v)}>{reveal ? <EyeOff size={14} /> : <Eye size={14} />}{reveal ? "Ẩn transcript" : "Hiện transcript (hỗ trợ)"}</Button>}
      {ls.transcript && (
        <Card className="p-4"><p className="mb-2 text-xs font-semibold uppercase text-muted">Transcript</p>
          <ol className="space-y-1 text-sm">{ls.transcript.map((s, i) => <li key={i}><b>{s.speaker}:</b> <LookupText text={s.text} module="listening" refId={ls.id} /></li>)}</ol>
          <p className="mt-2 text-xs text-muted">Bấm vào từ chưa biết để tra nghĩa và lưu vào sổ từ.</p></Card>
      )}
      {ls.vocabulary && ls.vocabulary.length > 0 && (
        <Card className="p-4"><p className="mb-2 text-xs font-semibold uppercase text-muted">Từ vựng trong bài</p>
          <ul className="space-y-1 text-sm">{ls.vocabulary.map((v) => <li key={v.word}><b>{v.word}</b> — {v.meaning_vi} <i className="text-muted">{v.example}</i><SaveWordButton text={v.word} module="listening" meaning_vi={v.meaning_vi} example={v.example} /></li>)}</ul></Card>
      )}
      <ExerciseRunner setId={ls.id} questions={ls.questions} review={review === undefined ? (q.data as ListeningSet & { review?: Review | null })?.review : review}
        onReview={setReview} submitFn={async (body) => { const r = await ai.submitListening(ls.id, body); setData(r); return r.review; }} />
    </div>
  );
}

/** Audio player: play/pause, replay, speed, progress. Replays use the cached file — no new TTS request. */
function Player({ src }: { src: string }) {
  const a = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [rate, setRate] = useState(1);
  const [plays, setPlays] = useState(0);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <audio ref={a} src={src} preload="auto" onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setD(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => { if (!a.current) return; if (playing) a.current.pause(); else { if (a.current.currentTime === 0) setPlays((p) => p + 1); void a.current.play(); } }}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Tạm dừng" : "Phát"}</Button>
        <Button variant="outline" onClick={() => { if (a.current) { a.current.currentTime = 0; setPlays((p) => p + 1); void a.current.play(); } }}><RotateCcw size={15} />Nghe lại</Button>
        <label className="ml-auto flex items-center gap-1 text-xs text-muted">Tốc độ
          <select className="rounded-lg border border-border bg-surface px-1 py-1" value={rate} onChange={(e) => { setRate(Number(e.target.value)); if (a.current) a.current.playbackRate = Number(e.target.value); }}>
            {[0.75, 0.9, 1, 1.15, 1.25].map((r) => <option key={r} value={r}>{r}×</option>)}</select></label>
      </div>
      <input type="range" min={0} max={d || 0} step={0.1} value={t} onChange={(e) => { if (a.current) a.current.currentTime = Number(e.target.value); }} className="mt-3 w-full" aria-label="Tiến độ bài nghe" />
      <p className="text-xs text-muted tabular-nums">{fmt(t)} / {fmt(d)} · đã nghe {plays} lần</p>
    </div>
  );
}
const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
