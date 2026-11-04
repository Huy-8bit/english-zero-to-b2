import { useEffect, useLayoutEffect, useRef } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BRIEF_QUESTION_MAP } from "./briefQuestions";
import { COMPACT_GRAMMAR } from "./compactGrammar";
import { advanceBriefQuiz, answerBriefQuiz, hideBriefQuiz, startBriefQuiz, type NightSession } from "./nightPlan";

/** Local retrieval practice; one committed answer per question/run, no server grading or XP. */
export function BriefQuiz({ session, onChange, onClose, paused = false, onContinue, continueLabel }: {
  session: NightSession; onChange: () => void; onClose: () => void; paused?: boolean; onContinue?: () => void; continueLabel?: string;
}) {
  const run = session.briefQuiz;
  const panel = useRef<HTMLElement>(null);
  const q = run && BRIEF_QUESTION_MAP[run.ids[run.index]];
  const choice = q ? run?.choices[q.id] : undefined;
  const answered = choice !== undefined;
  const close = () => { hideBriefQuiz(); onChange(); onClose(); };
  const answer = (i: number) => { if (q) { answerBriefQuiz(q.id, i); onChange(); } };
  const advance = () => { advanceBriefQuiz(); onChange(); };
  useLayoutEffect(() => {
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: "start" });
  }, [q?.id, run?.index, run?.key]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (/^[1-4]$/.test(e.key) && q && !answered) { e.preventDefault(); answer(Number(e.key) - 1); }
      if (e.key === "Enter" && answered && !(e.target instanceof HTMLElement && e.target.closest("button, a, summary"))) { e.preventDefault(); advance(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  if (!run) return null;
  const correct = run.ids.filter((id) => run.choices[id] === BRIEF_QUESTION_MAP[id]?.correct).length;
  const wrong = run.ids.filter((id) => run.choices[id] !== undefined && run.choices[id] !== BRIEF_QUESTION_MAP[id]?.correct);
  if (!q) return <section ref={panel} tabIndex={-1} className="reader-prose scroll-mt-24 space-y-4 rounded-3xl border border-border bg-surface p-5 outline-none sm:p-7" data-testid="brief-quiz-result">
    <h2 className="text-2xl font-bold">Đúng {correct}/{run.ids.length} câu trong lượt này</h2>
    <p className="text-muted">{wrong.length ? `${wrong.length} câu cần ôn lại. Thử nhớ quy tắc trước khi chọn; câu sai cũng được giữ trong mục ôn ở trang Ngữ pháp 1 đêm.` : "Bạn đã trả lời đúng các câu trong lượt này. Sau vài chủ điểm, dùng ôn trộn để thử nhớ lại lần nữa."}</p>
    <div className="flex flex-wrap gap-2">
      {wrong.length > 0 && <Button onClick={() => { startBriefQuiz(run.key, wrong, true); onChange(); }}><RotateCcw size={16} />Ôn {wrong.length} câu sai</Button>}
      <Button variant="outline" onClick={() => { startBriefQuiz(run.key, run.ids, true); onChange(); }}>Làm lại lượt này</Button>
      <Button onClick={close}>Xong — quay lại</Button>
      {onContinue && <Button onClick={onContinue}>{continueLabel}<ArrowRight size={16} /></Button>}
    </div>
  </section>;
  const topic = COMPACT_GRAMMAR.find((b) => b.id === q.brief);
  return <section ref={panel} tabIndex={-1} className="reader-prose scroll-mt-24 space-y-4 rounded-3xl border border-border bg-surface p-5 outline-none sm:p-7" data-testid="brief-quiz">
    <div className="flex flex-wrap items-center gap-2"><Badge tone="primary">Câu {run.index + 1}/{run.ids.length}</Badge><h2 className="font-bold">Trắc nghiệm để nhớ</h2>
      <Button className="ml-auto" size="sm" variant="ghost" onClick={close}><X size={14} />Tạm dừng</Button></div>
    <Progress value={100 * run.index / run.ids.length} label={`Đã làm ${run.index}/${run.ids.length} câu`} />
    <p className="text-xs text-muted">{topic?.title}</p>
    <p className="text-lg font-semibold">{q.prompt}</p>
    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Chọn đáp án">
      {q.options.map((option, i) => <button key={option} type="button" disabled={answered} onClick={() => answer(i)}
        className={cn("flex items-start gap-2 rounded-2xl border p-4 text-left transition disabled:opacity-100", !answered ? "border-border hover:border-primary hover:bg-primary-soft" : i === q.correct ? "border-success bg-success-soft" : i === choice ? "border-danger bg-danger-soft" : "border-border text-muted")}>
        <span className="font-semibold">{String.fromCharCode(65 + i)}.</span><span className="flex-1">{option}</span>{answered && i === q.correct && <Check size={18} aria-label="Đáp án đúng" />}
      </button>)}
    </div>
    {answered && <div className="space-y-2 rounded-2xl bg-surface-2 p-4" role="status">
      <p className={cn("font-bold", choice === q.correct ? "text-success" : "text-danger")}>{choice === q.correct ? "Đúng rồi" : `Chưa đúng. Đáp án: ${String.fromCharCode(65 + q.correct)}. ${q.options[q.correct]}`}</p>
      <p>{q.explanation}</p>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">Phím 1–4 chọn đáp án · Enter sang câu tiếp</span>
      {answered && <Button onClick={advance}>{run.index + 1 < run.ids.length ? "Câu tiếp" : "Xem kết quả"}<ArrowRight size={16} /></Button>}</div>
    <p className="text-xs text-muted">Câu trả lời lưu trong đêm học trên trình duyệt; không cộng XP hay tự hoàn thành bài gốc.</p>
  </section>;
}
