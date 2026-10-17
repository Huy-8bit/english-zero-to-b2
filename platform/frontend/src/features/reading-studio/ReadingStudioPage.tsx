import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Timer } from "lucide-react";
import { ai, QTYPE_LABELS, type Review } from "@/services/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ErrorBox, Input, PageHeader, Skeleton } from "@/components/ui/misc";
import { LookupText, SaveWordButton } from "@/features/vocab/Lookup";
import { ExerciseRunner } from "@/components/ai/ExerciseRunner";
import { AIErrorBox, AILoading, AIUnavailable, SimulatedBanner, useAIStatus } from "@/components/ai/AIStatus";

export function ReadingStudioPage() {
  const st = useAIStatus();
  const nav = useNavigate();
  const hist = useQuery({ queryKey: ["ai-sets", "reading"], queryFn: () => ai.exercises("reading") });
  const analytics = useQuery({ queryKey: ["reading-analytics"], queryFn: ai.readingAnalytics });
  const [f, setF] = useState({ level: "B1", topic: "", words: 250, text_type: "article", question_count: 5, question_types: ["multiple_choice", "true_false"] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const gen = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await ai.generateReading(f);
      nav(`/reading-studio/${r.id}`);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader title="Reading Studio" subtitle="Bài đọc do AI viết theo trình độ, câu hỏi có trích dẫn căn cứ từ bài đọc và giải thích paraphrase." />
      <SimulatedBanner />
      {st.data && !st.data.enabled && <div className="mb-4"><AIUnavailable /></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card><CardHeader><CardTitle>Tạo bài đọc</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <label>Trình độ<select className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{["A0", "A1", "A2", "B1", "B2"].map((l) => <option key={l}>{l}</option>)}</select></label>
              <label>Loại văn bản<select className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2" value={f.text_type} onChange={(e) => setF({ ...f, text_type: e.target.value })}>
                {[["short_passage", "Đoạn ngắn"], ["article", "Bài thông tin"], ["dialogue", "Hội thoại"], ["opinion", "Bài nêu quan điểm"], ["long_b2", "Bài dài B2"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label>Số từ<select className="mt-1 h-10 w-full rounded-xl border border-border bg-surface px-2" value={f.words} onChange={(e) => setF({ ...f, words: Number(e.target.value) })}>{[120, 250, 400, 600].map((w) => <option key={w} value={w}>~{w}</option>)}</select></label>
            </div>
            <fieldset><legend className="mb-1">Dạng câu hỏi</legend><div className="flex flex-wrap gap-2">{["multiple_choice", "true_false", "matching", "reading_comprehension"].map((t) => (
              <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={f.question_types.includes(t)} onChange={(e) => setF({ ...f, question_types: e.target.checked ? [...f.question_types, t] : f.question_types.filter((x) => x !== t) })} />{QTYPE_LABELS[t]}</label>))}</div></fieldset>
            <label className="block">Chủ đề<Input className="mt-1" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="vd: remote work, city life" /></label>
            <Button onClick={gen} disabled={busy || !st.data?.enabled}><BookOpen size={16} />{busy ? "Đang tạo…" : "Tạo bài đọc"}</Button>
            {busy && <AILoading label="AI đang viết bài đọc và kiểm tra câu hỏi…" />}
            {err != null && <AIErrorBox error={err} onRetry={gen} />}
          </CardContent></Card>
        <div className="space-y-4">
          <Card><CardHeader><CardTitle>Độ chính xác theo dạng câu</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">{analytics.data?.by_type.map((b) => (
              <div key={b.type}><div className="flex justify-between"><span>{QTYPE_LABELS[b.type] ?? b.type}</span><span className="text-muted">{Math.round(b.accuracy * 100)}% · {b.answered} câu{b.avg_seconds ? ` · ${b.avg_seconds}s/câu` : ""}</span></div><Progress value={b.accuracy * 100} label={b.type} /></div>))}
              {!analytics.data?.by_type.length && <p className="text-muted">Chưa có dữ liệu.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Bài đã tạo</CardTitle></CardHeader>
            <CardContent><ul className="space-y-2 text-sm">{hist.data?.sets.map((s) => (
              <li key={s.id}><Link to={`/reading-studio/${s.id}`} className="block rounded-xl border border-border p-3 hover:border-primary">{s.title}<span className="block text-xs text-muted">{s.level} · {s.attempts ? `${s.last_score}/${s.questions}` : "chưa làm"}</span></Link></li>))}</ul></CardContent></Card>
        </div>
      </div>
    </div>
  );
}

export function ReadingSetPage() {
  const { setId = "" } = useParams();
  return <ReadingSetPageSession key={setId} setId={setId} />;
}

function ReadingSetPageSession({ setId }: { setId: string }) {
  const q = useQuery({ queryKey: ["ai-set", setId], queryFn: () => ai.exercise(setId) });
  const [review, setReview] = useState<Review | null | undefined>(undefined);
  const [secs, setSecs] = useState(0);
  const done = !!(review ?? q.data?.review);
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <ErrorBox error={q.error} />;
  const es = q.data;
  const passage = String(es.meta.passage ?? "");
  const rv = review === undefined ? es.review : review;
  const evidence = (rv?.questions ?? []).map((x) => x.evidence_quote).filter(Boolean) as string[];
  return (
    <div>
      <Link to="/reading-studio" className="text-sm text-primary">← Reading Studio</Link>
      <h1 className="mt-1 text-2xl font-bold">{es.title}</h1>
      <div className="mb-3 mt-1 flex gap-2"><Badge>{es.level}</Badge><Badge><Timer size={12} />{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</Badge></div>
      <SimulatedBanner />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <p className="mb-2 text-xs text-muted">Bấm vào một từ để tra nghĩa theo ngữ cảnh và lưu vào sổ từ.</p>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{highlight(passage, evidence, (t, k) => <LookupText key={k} text={t} module="reading" refId={es.id} />)}</p>
          {rv && Array.isArray(es.meta.vocabulary) && <div className="mt-4 border-t border-border pt-3 text-sm"><p className="mb-1 font-semibold">Từ vựng</p>
            {(es.meta.vocabulary as { word: string; meaning_vi: string; example: string }[]).map((v) => <p key={v.word}><b>{v.word}</b> — {v.meaning_vi}<SaveWordButton text={v.word} module="reading" meaning_vi={v.meaning_vi} example={v.example} /></p>)}</div>}
        </Card>
        <ExerciseRunner setId={es.id} questions={es.questions} review={rv} onReview={setReview} />
      </div>
    </div>
  );
}

function highlight(text: string, quotes: string[], plain: (t: string, k: string) => React.ReactNode = (t) => t): React.ReactNode[] {
  if (!quotes.length) return [plain(text, "p0")];
  const out: React.ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest) {
    let best: { i: number; q: string } | null = null;
    for (const q of quotes) {
      const i = rest.toLowerCase().indexOf(q.toLowerCase());
      if (i >= 0 && (!best || i < best.i)) best = { i, q };
    }
    if (!best) { out.push(plain(rest, `p${k++}`)); break; }
    out.push(plain(rest.slice(0, best.i), `p${k++}`));
    out.push(<mark key={k++} className="em-hl" title="Căn cứ cho đáp án">{plain(rest.slice(best.i, best.i + best.q.length), `m${k}`)}</mark>);
    rest = rest.slice(best.i + best.q.length);
  }
  return out;
}
