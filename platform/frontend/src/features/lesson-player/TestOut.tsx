import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/ui/toast";
import { api } from "@/services/api";
import { ai } from "@/services/ai";
import type { ItemResult, QuizItem, StepsPayload } from "@/types/content";
import { ItemCard } from "@/features/quizzes/ItemCard";
import { isAnswered, toResponse, type Draft } from "@/features/quizzes/draft";

type Result = Awaited<ReturnType<typeof api.testOutFinish>>;

/** "Kiểm tra vượt bài": about 8 questions picked by the server; 7/8 right on the first try completes the lesson. */
export function TestOut({ unitId, data, nextId, onStudy }: { unitId: string; data: StepsPayload; nextId: string | null; onStudy: () => void }) {
  const [test, setTest] = useState<{ test_id: number; items: string[]; pass_mark: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [results, setResults] = useState<Record<string, ItemResult>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Result | null>(null);
  useEffect(() => {
    api.testOutStart(unitId).then(setTest).catch((e) => setErr(e instanceof Error ? e.message : "Không bắt đầu được"));
  }, [unitId]);
  const byId = useMemo(() => {
    const m: Record<string, { item: QuizItem; quizId: string; intro: string }> = {};
    data.steps.forEach((s) => (s.items ?? []).forEach((item) => { m[item.id] = { item, quizId: s.quiz_id!, intro: s.intro_md ?? "" }; }));
    return m;
  }, [data.steps]);

  if (err) return <div className="space-y-3"><p className="rounded-2xl bg-warning-soft p-4 text-warning">{err}</p><Button onClick={onStudy}>Học bài</Button></div>;
  if (!test) return <p className="text-muted">Đang chuẩn bị bài kiểm tra…</p>;
  if (done) {
    return (
      <div className="space-y-4 text-center" data-testid="test-out-result">
        {done.passed ? <Rocket className="mx-auto text-success" size={40} /> : <CheckCircle2 className="mx-auto text-primary" size={40} />}
        <p className="text-2xl font-bold">{done.passed ? "Vượt bài!" : "Chưa đủ để vượt bài"}</p>
        <p>Đúng <b>{done.correct}/{done.total}</b> câu ngay lần đầu (cần {done.pass_mark}).</p>
        <p className="text-sm text-muted">{done.passed ? "Bài được tính là hoàn thành; hệ thống vẫn hẹn ôn lại theo lịch giãn cách." : "Học bài để lấp phần còn thiếu — những câu sai sẽ được hỏi lại trong bài."}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {done.passed && nextId && <Link to={`/learn/${nextId}`}><Button>Bài tiếp theo<ArrowRight size={16} /></Button></Link>}
          <Button variant={done.passed ? "outline" : "primary"} onClick={onStudy}>{done.passed ? "Vẫn học bài này" : "Học bài"}</Button>
        </div>
      </div>
    );
  }
  const id = test.items[idx];
  const q = byId[id];
  const result = results[id];
  const check = async () => {
    if (busy || !isAnswered(q.item, drafts[id])) return;
    setBusy(true);
    try {
      const r = await api.submitQuiz(q.quizId, { [id]: toResponse(q.item, drafts[id]) });
      let res = r.results[id];
      if (res.verdict === "mismatch" && res.has_key) {
        try { res = { ...res, ai_correct: (await ai.gradeAttempt(res.attempt_id)).score >= 0.75 }; } catch { /* counts as not correct */ }
      }
      setResults((x) => ({ ...x, [id]: res }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không chấm được");
    } finally {
      setBusy(false);
    }
  };
  const next = async () => {
    if (idx + 1 < test.items.length) return setIdx(idx + 1);
    setBusy(true);
    try {
      setDone(await api.testOutFinish(unitId, test.test_id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không chấm được bài kiểm tra");
    } finally {
      setBusy(false);
    }
  };
  if (!q) return <p className="text-muted">Câu hỏi không còn trong bài.</p>;
  return (
    <div className="space-y-3" data-testid="test-out">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary"><Rocket size={12} />Kiểm tra vượt bài</Badge>
        <span className="text-sm text-muted">Câu {idx + 1}/{test.items.length} · cần đúng {test.pass_mark} câu ngay lần đầu · không có gợi ý</span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onStudy}><X size={14} />Thôi, học bài</Button>
      </div>
      <Progress value={(100 * idx) / test.items.length} label={`Câu ${idx + 1}/${test.items.length}`} />
      {q.intro && <Markdown docPath={data.unit.path} className="text-sm text-muted">{q.intro}</Markdown>}
      <ItemCard item={q.item} unitId={unitId} docPath={data.unit.path} draft={drafts[id]} onDraft={(d) => setDrafts((x) => ({ ...x, [id]: d }))}
        result={result} locked={false} aiAuto={false} onSelfAssess={() => {}} onRetry={() => {}} onEnter={() => void (result ? next() : check())} />
      <div className="flex justify-end">
        {result ? <Button onClick={() => void next()} disabled={busy}>{idx + 1 < test.items.length ? "Câu tiếp" : "Xem kết quả"}<ArrowRight size={16} /></Button>
          : <Button onClick={() => void check()} disabled={busy || !isAnswered(q.item, drafts[id])}>Kiểm tra</Button>}
      </div>
    </div>
  );
}
