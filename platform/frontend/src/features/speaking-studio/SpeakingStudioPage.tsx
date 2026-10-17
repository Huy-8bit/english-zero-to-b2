import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, History, Mic, Radio, Square, Trash2 } from "lucide-react";
import { ai, ERROR_LABELS, newId, type SpeakingSession, type SpeakingTurn } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, PageHeader } from "@/components/ui/misc";
import { AIErrorBox, AILoading, AIUnavailable, SimulatedBanner, useAIStatus } from "@/components/ai/AIStatus";
import { cn } from "@/lib/utils";
import { RealtimePanel } from "./RealtimePanel";

const LEVELS = ["A0", "A1", "A2", "B1", "B2"];

export default function SpeakingStudioPage() {
  const st = useAIStatus();
  const opts = useQuery({ queryKey: ["speaking-options"], queryFn: ai.speakingOptions });
  const hist = useQuery({ queryKey: ["speaking-history"], queryFn: ai.speakingSessions });
  const qc = useQueryClient();
  const [mode, setMode] = useState("guided");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("A2");
  const [session, setSession] = useState<SpeakingSession | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<{ e: unknown; retry: () => void } | null>(null);
  const [tab, setTab] = useState<"practice" | "realtime" | "history">("practice");

  const start = async () => {
    setBusy("start");
    setErr(null);
    try {
      setSession(await ai.startSpeaking({ mode, topic, level }));
    } catch (e) {
      setErr({ e, retry: start });
    } finally {
      setBusy(null);
    }
  };
  const end = async () => {
    if (!session) return;
    setBusy("end");
    try {
      setSession(await ai.endSpeaking(session.id));
      qc.invalidateQueries({ queryKey: ["speaking-history"] });
    } catch (e) {
      setErr({ e, retry: end });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div>
      <PageHeader title="Speaking Studio" subtitle="Luyện nói với AI: ghi âm câu trả lời, xem bản chép lời, nhận góp ý ngữ pháp – từ vựng và trả lời câu hỏi tiếp theo."
        actions={<div className="flex flex-wrap gap-2">
          <Button variant={tab === "practice" ? "primary" : "outline"} onClick={() => setTab("practice")}><Mic size={15} />Luyện nói</Button>
          <Button variant={tab === "realtime" ? "primary" : "outline"} onClick={() => setTab("realtime")}><Radio size={15} />Thời gian thực</Button>
          <Button variant={tab === "history" ? "primary" : "outline"} onClick={() => setTab("history")}><History size={15} />Lịch sử</Button></div>} />
      <SimulatedBanner />
      {st.data && !st.data.enabled && <div className="mb-4"><AIUnavailable /></div>}
      <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">AI chỉ nhận xét dựa trên bản chép lời tự động (speech-to-text): ngữ pháp, từ vựng, mức độ liên quan và độ hoàn chỉnh. Hệ thống không chấm phát âm, trọng âm hay ngữ điệu.
        {opts.data && !opts.data.store_user_audio && " Bản ghi âm của bạn chỉ phát lại trong trình duyệt, không lưu trên máy chủ."}</p>
      {tab === "history" && <SpeakingHistory data={hist.data} onOpen={async (id) => { setSession(await ai.speakingSession(id)); setTab("practice"); }} />}
      {tab === "realtime" && <RealtimePanel level={level} topic={topic} />}
      {tab === "practice" && (!session ? (
        <Card><CardContent className="space-y-4 pt-5">
          <fieldset><legend className="mb-1 text-sm font-medium">Chế độ</legend>
            <div className="flex flex-wrap gap-2">{Object.entries(opts.data?.modes ?? {}).map(([k, v]) => (
              <button key={k} aria-pressed={mode === k} onClick={() => { setMode(k); setTopic(""); }} className={cn("rounded-xl border px-3 py-1.5 text-sm", mode === k ? "border-primary bg-primary-soft text-primary" : "border-border")}>{v}</button>))}</div></fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {mode === "roleplay" ? (
              <label className="text-sm">Tình huống<select className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-2" value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">— chọn —</option>{Object.entries(opts.data?.roleplays ?? {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            ) : <label className="text-sm">Chủ đề<Input className="mt-1" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="vd: hobbies, technology, my hometown" /></label>}
            <label className="text-sm">Trình độ<select className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-2" value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
          </div>
          <Button onClick={start} disabled={busy !== null || !st.data?.enabled || (mode === "roleplay" && !topic)}><Mic size={16} />Bắt đầu</Button>
          {busy === "start" && <AILoading label="AI đang chuẩn bị câu hỏi đầu tiên…" />}
          {err && <AIErrorBox error={err.e} onRetry={err.retry} />}
        </CardContent></Card>
      ) : (
        <Conversation session={session} setSession={setSession} onEnd={end} busyEnd={busy === "end"} maxSeconds={opts.data?.max_audio_seconds ?? 120} onNew={() => setSession(null)} err={err} />
      ))}
    </div>
  );
}

function Conversation({ session, setSession, onEnd, busyEnd, maxSeconds, onNew, err }: {
  session: SpeakingSession; setSession: (s: SpeakingSession) => void; onEnd: () => void; busyEnd: boolean; maxSeconds: number; onNew: () => void;
  err: { e: unknown; retry: () => void } | null;
}) {
  const [localAudio, setLocalAudio] = useState<Record<number, string>>({});
  const ended = session.status === "ended";
  const userTurns = session.turns.filter((t) => t.role === "user");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{session.mode_label}</Badge><Badge>{session.level}</Badge><span className="text-sm text-muted">{session.topic}</span>
        <span className="ml-auto flex gap-2">
          {!ended && <Button variant="outline" onClick={onEnd} disabled={busyEnd || userTurns.length === 0}><Flag size={15} />{busyEnd ? "Đang tổng kết…" : "Kết thúc & xem tổng kết"}</Button>}
          {ended && <Button onClick={onNew}>Phiên mới</Button>}
        </span>
      </div>
      <ol className="space-y-3">
        {session.turns.map((t, i) => <TurnView key={t.id} turn={t} local={localAudio[userTurns.indexOf(t)]} last={i === session.turns.length - 1} />)}
      </ol>
      {!ended && <Recorder sessionId={session.id} maxSeconds={maxSeconds} onDone={(s, url) => { setLocalAudio((m) => ({ ...m, [userTurns.length]: url })); setSession(s); }} />}
      {busyEnd && <AILoading label="AI đang tổng kết phiên luyện nói…" />}
      {err && <AIErrorBox error={err.e} onRetry={err.retry} />}
      {ended && session.summary && <Summary s={session} />}
    </div>
  );
}

function TurnView({ turn, local, last }: { turn: SpeakingTurn; local?: string; last: boolean }) {
  const fb = (turn.feedback ?? {}) as Record<string, unknown>;
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => { if (last && turn.role === "ai" && turn.audio_url) audioRef.current?.play().catch(() => {}); }, [last, turn]);
  if (turn.role === "ai") {
    return (
      <li className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold text-primary">{fb.type === "read_aloud_target" ? "Đọc to câu này" : "AI"}</p>
        <p className="text-lg">{turn.text}</p>
        {turn.audio_url ? <audio ref={audioRef} controls src={turn.audio_url} className="mt-2 h-9 w-full max-w-sm" aria-label="Nghe câu hỏi" /> : <p className="text-xs text-muted">(không có âm thanh — TTS lỗi hoặc tắt)</p>}
        {typeof fb.hint_vi === "string" && <p className="mt-1 text-sm text-muted">💡 {fb.hint_vi}</p>}
        {Array.isArray(fb.useful_expressions) && <p className="text-sm">Mẫu câu: {(fb.useful_expressions as string[]).map((e) => <Badge key={e} className="mr-1">{e}</Badge>)}</p>}
      </li>
    );
  }
  const ind = fb.indicators as Record<string, number | null | string> | undefined;
  const match = fb.match as { word_match_percent: number; missing_words: string[]; different_words: string[]; note_vi: string } | undefined;
  const grammar = (fb.grammar_feedback as { original: string; correction: string; category: string; explanation_vi: string }[]) ?? [];
  return (
    <li className="ml-6 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4 text-sm">
      <p className="text-xs font-semibold">Bạn nói (bản chép lời tự động)</p>
      <p className="text-[15px]">{turn.text}</p>
      {local && <audio controls src={local} className="mt-2 h-9 w-full max-w-sm" aria-label="Nghe lại bản ghi của bạn" />}
      {ind && <p className="mt-2 text-xs text-muted">{ind.words} từ{ind.words_per_minute ? ` · ~${ind.words_per_minute} từ/phút` : ""} · {ind.fillers} từ đệm · {ind.sentences} câu</p>}
      {match && (
        <div className="mt-2 rounded-xl bg-surface p-2"><p><b>Khớp từ: {match.word_match_percent}%</b>{match.missing_words.length ? ` · thiếu: ${match.missing_words.join(", ")}` : ""}{match.different_words.length ? ` · khác: ${match.different_words.join(", ")}` : ""}</p>
          <p className="text-xs text-muted">{match.note_vi}</p></div>
      )}
      {fb.type === "conversation" && (
        <div className="mt-2 space-y-1">
          {typeof fb.relevance_vi === "string" && <p>🎯 {fb.relevance_vi}</p>}
          {grammar.map((g, i) => <p key={i}><Badge tone="danger">{ERROR_LABELS[g.category] ?? g.category}</Badge> <s>{g.original}</s> → <b className="text-success">{g.correction}</b> <span className="text-muted">{g.explanation_vi}</span></p>)}
          {typeof fb.vocabulary_feedback_vi === "string" && <p>📚 {fb.vocabulary_feedback_vi}</p>}
          {typeof fb.completeness_vi === "string" && <p>🧩 {fb.completeness_vi}</p>}
          {typeof fb.improved_answer === "string" && <p>✨ Câu tốt hơn: <i>{fb.improved_answer}</i></p>}
          {Array.isArray(fb.natural_expressions) && (fb.natural_expressions as string[]).length > 0 && <p>Cách nói tự nhiên: {(fb.natural_expressions as string[]).join(" · ")}</p>}
        </div>
      )}
    </li>
  );
}

/** MediaRecorder → upload; a failed upload keeps the recording and retries with the same turn id. */
function Recorder({ sessionId, maxSeconds, onDone }: { sessionId: string; maxSeconds: number; onDone: (s: SpeakingSession, url: string) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<{ blob: Blob; seconds: number; id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const started = useRef(0);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setElapsed(s);
      if (s >= maxSeconds) rec.stop();
    }, 250);
    return () => clearInterval(t);
  }, [rec, maxSeconds]);
  const upload = async (p: { blob: Blob; seconds: number; id: string; url: string }) => {
    setBusy(true);
    setErr(null);
    try {
      onDone(await ai.answerSpeaking(sessionId, p.blob, p.seconds, p.id), p.url);
      setPending(null);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
        const p = { blob, seconds: Math.round((Date.now() - started.current) / 100) / 10, id: newId(), url: URL.createObjectURL(blob) };
        setRec(null);
        setPending(p);
        void upload(p);
      };
      started.current = Date.now();
      setElapsed(0);
      r.start();
      setRec(r);
    } catch {
      setErr(new Error("Không truy cập được micro. Hãy cho phép quyền micro cho trang này."));
    }
  };
  if (!supported) return <p className="text-sm text-muted">Trình duyệt này không hỗ trợ ghi âm.</p>;
  return (
    <div className="sticky bottom-3 z-10 rounded-2xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        {!rec ? <Button onClick={start} disabled={busy}><Mic size={16} />Ghi âm câu trả lời</Button> : <Button variant="danger" onClick={() => rec.stop()}><Square size={16} />Dừng & gửi</Button>}
        <span className="tabular-nums text-sm text-muted">{rec ? `${Math.floor(elapsed)}s / ${maxSeconds}s` : `Tối đa ${maxSeconds} giây`}</span>
        {pending && err != null && <Button variant="outline" onClick={() => upload(pending)}>Gửi lại bản ghi</Button>}
      </div>
      {busy && <div className="mt-2"><AILoading label="Đang chép lời và phân tích câu trả lời…" /></div>}
      {err != null && <div className="mt-2"><AIErrorBox error={err} /></div>}
    </div>
  );
}

function Summary({ s }: { s: SpeakingSession }) {
  const sum = s.summary as Record<string, unknown>;
  if (sum.empty) return <p className="text-sm text-muted">Phiên chưa có câu trả lời nào.</p>;
  if (sum.type === "read_aloud") return <Card className="p-4"><p className="font-semibold">Tổng kết đọc to: {String(sum.sentences)} câu · khớp từ trung bình {String(sum.average_word_match)}%</p><p className="text-xs text-muted">{String(sum.note_vi)}</p></Card>;
  const mistakes = (sum.key_mistakes as { original: string; correction: string; explanation_vi: string; category: string }[]) ?? [];
  return (
    <Card>
      <CardHeader><CardTitle>Tổng kết phiên</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{String(sum.overall_vi)}</p>
        {mistakes.length > 0 && <div><p className="font-semibold">Lỗi chính</p>{mistakes.map((m, i) => <p key={i}><s>{m.original}</s> → <b className="text-success">{m.correction}</b> — {m.explanation_vi}</p>)}</div>}
        <div><p className="font-semibold">Mẫu câu hữu ích</p><p>{(sum.useful_expressions as string[]).join(" · ")}</p></div>
        <div><p className="font-semibold">Câu trả lời mẫu tốt hơn</p><ul className="list-disc pl-5">{(sum.improved_sample_answers as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div><p className="font-semibold">Luyện tiếp</p><ul className="list-disc pl-5">{(sum.follow_up_practice_vi as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <p className="text-xs text-muted">{String(sum.pronunciation_note_vi ?? "")}</p>
      </CardContent>
    </Card>
  );
}

function SpeakingHistory({ data, onOpen }: { data?: Awaited<ReturnType<typeof ai.speakingSessions>>; onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  if (!data) return null;
  return (
    <ul className="space-y-2">
      {data.sessions.length === 0 && <p className="text-sm text-muted">Chưa có phiên nào.</p>}
      {data.sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
          <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(s.id)}>
            <span className="block font-medium">{s.mode} · {s.topic}</span>
            <span className="text-xs text-muted">{new Date(s.created_at).toLocaleString("vi-VN")} · {s.level} · {s.answers} câu trả lời · {s.status === "ended" ? "đã kết thúc" : "đang dở"}</span>
          </button>
          <Button size="icon" variant="ghost" aria-label="Xóa phiên" onClick={async () => { if (window.confirm("Xóa phiên luyện nói này (kèm âm thanh)?")) { await ai.deleteSpeaking(s.id); qc.invalidateQueries({ queryKey: ["speaking-history"] }); } }}><Trash2 size={15} /></Button>
        </li>
      ))}
    </ul>
  );
}
