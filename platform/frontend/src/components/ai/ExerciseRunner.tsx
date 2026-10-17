import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, RotateCcw } from "lucide-react";
import { ai, newId, QTYPE_LABELS, type PublicQuestion, type Review } from "@/services/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/misc";
import { Markdown } from "@/components/Markdown";
import { toast } from "@/components/ui/toast";
import { cn, safeStorage } from "@/lib/utils";
import { AIErrorBox, AILoading } from "./AIStatus";
import { ReviewCard } from "./FeedbackCard";

type Answer = string | number | string[] | Record<string, string> | undefined;
interface Saved { answers: Record<string, Answer>; times: Record<string, number>; clientId: string }
const store = safeStorage();
const OPTION_TYPES = new Set(["multiple_choice", "contextual_grammar", "reading_comprehension", "listening_comprehension", "true_false"]);
const SHORT = new Set(["fill_blank", "verb_conjugation"]);

export function isAnswered(q: PublicQuestion, a: Answer): boolean {
  if (a === undefined || a === null || a === "") return false;
  if (q.qtype === "matching") return typeof a === "object" && Object.keys(a as object).length === (q.left?.length ?? 0);
  if (q.qtype === "sentence_ordering") return Array.isArray(a) && a.length === (q.tokens?.length ?? 0);
  return true;
}

function toPayload(q: PublicQuestion, a: Answer): unknown {
  if (q.qtype === "sentence_ordering" && Array.isArray(a)) return (a as string[]).map((i) => q.tokens![Number(i)]).join(" ");
  return a;
}

/**
 * Answer → submit → review for AI-generated sets (practice, listening, reading).
 * Answers autosave locally; a failed submit keeps them and retries with the same id (no double grading).
 */
export function ExerciseRunner({ setId, questions, review, onReview, submitFn, onSimilar, renderBefore }: {
  setId: string; questions: PublicQuestion[]; review: Review | null | undefined; onReview: (r: Review) => void;
  submitFn?: (body: { answers: Record<string, unknown>; times_ms: Record<string, number>; client_submission_id: string }) => Promise<Review>;
  onSimilar?: () => void; renderBefore?: (q: PublicQuestion, i: number) => React.ReactNode;
}) {
  const key = `em-ex-${setId}`;
  const [saved, setSaved] = useState<Saved>(() => store.get<Saved>(key, { answers: {}, times: {}, clientId: newId() }));
  const [mode, setMode] = useState<"answer" | "review">(review ? "review" : "answer");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const firstSeen = useRef<Record<string, number>>({});
  useEffect(() => { store.set(key, saved); }, [key, saved]);
  useEffect(() => { if (review) setMode("review"); }, [review]);

  const setAnswer = (q: PublicQuestion, a: Answer) => {
    firstSeen.current[q.id] ??= Date.now();
    setSaved((s) => ({ ...s, answers: { ...s.answers, [q.id]: a }, times: { ...s.times, [q.id]: Date.now() - firstSeen.current[q.id] } }));
  };
  const answered = questions.filter((q) => isAnswered(q, saved.answers[q.id])).length;

  const submit = async () => {
    if (answered < questions.length && !window.confirm(`Còn ${questions.length - answered} câu chưa trả lời. Vẫn nộp bài?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const body = { answers: Object.fromEntries(questions.map((q) => [q.id, toPayload(q, saved.answers[q.id]) ?? ""])), times_ms: saved.times, client_submission_id: saved.clientId };
      const r = submitFn ? await submitFn(body) : await ai.submit(setId, body);
      onReview(r);
      setMode("review");
      setSaved((s) => ({ ...s, clientId: newId() }));  // next retry is a new attempt
      toast.success(`Điểm: ${r.score}/${r.max_score}`);
    } catch (e) {
      setErr(e);  // answers are kept; retry reuses the same submission id
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setSaved({ answers: {}, times: {}, clientId: newId() });
    firstSeen.current = {};
    setMode("answer");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reviewById = useMemo(() => Object.fromEntries((review?.questions ?? []).map((q) => [q.id, q])), [review]);

  return (
    <div className="space-y-4">
      {mode === "review" && review && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-lg font-semibold">Kết quả: {review.score}/{review.max_score}</p>
          <Badge>{review.attempt_count} lần làm</Badge>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={retry}><RotateCcw size={15} />Làm lại</Button>
            {onSimilar && <Button variant="secondary" onClick={onSimilar}>Tạo bộ bài tương tự</Button>}
          </div>
        </div>
      )}
      <ol className="space-y-4">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-2xl border border-border bg-surface p-4" data-question={q.id}>
            {renderBefore?.(q, i)}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">Câu {i + 1}</span>
              <Badge>{QTYPE_LABELS[q.qtype] ?? q.qtype}</Badge>
              {q.difficulty && <Badge tone={q.difficulty === "hard" ? "danger" : q.difficulty === "easy" ? "success" : "neutral"}>{q.difficulty}</Badge>}
            </div>
            {q.instructions_vi && <p className="mb-1 text-sm text-muted">{q.instructions_vi}</p>}
            {q.context_passage && <div className="mb-2 rounded-xl bg-surface-2 p-3 text-sm"><Markdown>{q.context_passage}</Markdown></div>}
            <Markdown className="text-[15px]">{q.question_text}</Markdown>
            <div className="mt-3">
              <QuestionInput q={q} value={saved.answers[q.id]} onChange={(a) => setAnswer(q, a)} disabled={mode === "review"} />
            </div>
            {mode === "review" && reviewById[q.id] && (
              <div className="mt-3"><ReviewCard q={reviewById[q.id]} setId={setId} onRegraded={onReview} /></div>
            )}
          </li>
        ))}
      </ol>
      {mode === "answer" && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
          <span className="text-sm text-muted">{answered}/{questions.length} câu đã trả lời · tự động lưu</span>
          <Button className="ml-auto" onClick={submit} disabled={busy || answered === 0}><CheckCheck size={16} />{busy ? "Đang chấm…" : "Nộp bài"}</Button>
        </div>
      )}
      {busy && <AILoading label="Đang chấm: câu có đáp án xác định chấm bằng code, câu mở do AI chấm…" />}
      {err != null && <AIErrorBox error={err} onRetry={submit} />}
    </div>
  );
}

function QuestionInput({ q, value, onChange, disabled }: { q: PublicQuestion; value: Answer; onChange: (a: Answer) => void; disabled: boolean }) {
  if (OPTION_TYPES.has(q.qtype) && q.options.length) {
    return (
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} disabled={disabled} onClick={() => onChange(i)}
            className={cn("flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-[15px]", value === i ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50")}>
            <span className="grid h-6 min-w-6 place-items-center rounded-md bg-surface-2 text-xs font-bold">{"ABCDEFGH"[i]}</span>{o}
          </button>
        ))}
      </div>
    );
  }
  if (q.qtype === "sentence_ordering" && q.tokens) {
    const chosen = (Array.isArray(value) ? value : []) as string[];
    return (
      <div className="space-y-2">
        <div className="flex min-h-12 flex-wrap gap-2 rounded-xl border border-dashed border-border bg-surface-2 p-2" aria-label="Câu đang sắp xếp">
          {chosen.length === 0 && <span className="text-sm text-muted">Bấm các từ theo đúng thứ tự</span>}
          {chosen.map((ti, p) => <button key={p} type="button" disabled={disabled} className="rounded-lg bg-primary px-2.5 py-1 text-sm text-primary-fg" onClick={() => onChange(chosen.filter((_, x) => x !== p))}>{q.tokens![Number(ti)]}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          {q.tokens.map((t, ti) => <button key={ti} type="button" disabled={disabled || chosen.includes(String(ti))} onClick={() => onChange([...chosen, String(ti)])} className="rounded-lg border border-border px-2.5 py-1 text-sm disabled:opacity-30">{t}</button>)}
        </div>
      </div>
    );
  }
  if (q.qtype === "matching" && q.left && q.right) {
    const map = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, string>;
    return (
      <div className="space-y-2">
        {q.left.map((l) => (
          <label key={l} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-32 font-medium">{l}</span>→
            <select className="h-10 min-w-40 flex-1 rounded-xl border border-border bg-surface px-2" disabled={disabled} value={map[l] ?? ""} onChange={(e) => onChange({ ...map, [l]: e.target.value })}>
              <option value="">— chọn —</option>
              {q.right!.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        ))}
      </div>
    );
  }
  const prefill = q.qtype === "error_correction" && value === undefined ? q.question_text : undefined;
  if (SHORT.has(q.qtype)) {
    return <Input value={(value as string) ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="Nhập đáp án" aria-label="Đáp án" autoComplete="off" spellCheck={false} />;
  }
  return <Textarea rows={q.qtype === "sentence_writing" ? 4 : 2} value={(value as string) ?? prefill ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder="Câu trả lời của bạn" aria-label="Câu trả lời" />;
}
