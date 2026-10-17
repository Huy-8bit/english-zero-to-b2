import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown, CircleAlert, HelpCircle, Lightbulb, MessageCircleQuestion, RefreshCw, XCircle } from "lucide-react";
import { ai, ERROR_LABELS, type GradeFeedback, type Review, type ReviewQuestion } from "@/services/ai";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AIErrorBox } from "./AIStatus";

const TONE: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  correct: { label: "Chính xác", cls: "border-success/40 bg-success-soft", icon: CheckCircle2 },
  partial: { label: "Đúng một phần", cls: "border-warning/40 bg-warning-soft", icon: CircleAlert },
  partially_correct: { label: "Đúng một phần", cls: "border-warning/40 bg-warning-soft", icon: CircleAlert },
  incorrect: { label: "Chưa đúng", cls: "border-danger/40 bg-danger-soft", icon: XCircle },
  needs_review: { label: "Cần xem xét lại", cls: "border-warning/40 bg-warning-soft", icon: HelpCircle },
  unanswered: { label: "Chưa trả lời", cls: "border-border bg-surface-2", icon: HelpCircle },
};

export function GradeView({ fb, expected, explanation, rule }: { fb: GradeFeedback; expected?: string | null; explanation?: string; rule?: string }) {
  const t = TONE[fb.correctness] ?? TONE.incorrect;
  const Icon = t.icon;
  const [open, setOpen] = useState(fb.correctness !== "correct");
  return (
    <div className={cn("rounded-xl border p-3 text-sm", t.cls)} role="status">
      <button className="flex w-full items-center gap-2 text-left font-semibold" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon size={16} />{t.label}{fb.score > 0 && fb.score < 1 ? ` · ${Math.round(fb.score * 100)}%` : ""}
        {fb.grader === "ai" && <Badge tone="primary" className="ml-1">AI chấm</Badge>}
        {fb.confidence === "low" && <Badge tone="warning">AI chưa chắc chắn</Badge>}
        <ChevronDown size={14} className={cn("ml-auto transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-fg">
          {fb.feedback_vi && <p>{fb.feedback_vi}</p>}
          {expected && fb.correctness !== "correct" && <p><b>Đáp án phù hợp:</b> {expected}</p>}
          {fb.corrected_answer && fb.correctness !== "correct" && <p><b>Bản sửa:</b> {fb.corrected_answer}</p>}
          {!!fb.acceptable_alternatives?.length && <p className="text-muted"><b>Cách nói khác cũng đúng:</b> {fb.acceptable_alternatives.join(" · ")}</p>}
          {!!fb.errors?.length && (
            <ul className="space-y-1">
              {fb.errors.map((e, i) => (
                <li key={i} className="rounded-lg bg-surface/70 px-2 py-1">
                  <Badge tone="danger">{ERROR_LABELS[e.category] ?? e.category}</Badge>{" "}
                  <span className="line-through decoration-danger">{e.original}</span> → <span className="font-medium text-success">{e.correction}</span>
                  <span className="block text-xs text-muted">{e.explanation_vi}</span>
                </li>
              ))}
            </ul>
          )}
          {(fb.grammar_explanation_vi || explanation) && (
            <div className="rounded-lg bg-surface/70 p-2"><p className="text-xs font-semibold uppercase text-muted">Quy tắc</p>
              <Markdown className="text-sm">{fb.grammar_explanation_vi || explanation || ""}</Markdown>
              {rule && <p className="text-xs text-muted">Công thức: {rule}</p>}</div>
          )}
          {fb.improvement_suggestion_vi && <p className="flex gap-1"><Lightbulb size={14} className="mt-0.5 shrink-0 text-warning" />{fb.improvement_suggestion_vi}</p>}
          {fb.follow_up_suggestion_vi && <p className="text-muted">Gợi ý luyện tiếp: {fb.follow_up_suggestion_vi}</p>}
        </div>
      )}
    </div>
  );
}

/** "Why is it wrong? / Explain again / Another example" — saved to history per question. */
export function FollowUps({ targetType, targetId }: { targetType: "question" | "attempt"; targetId: string }) {
  const [msgs, setMsgs] = useState<{ action: string; content: string }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const load = async () => {
    if (msgs === null) setMsgs((await ai.followUps(targetType, targetId).catch(() => ({ messages: [] }))).messages);
  };
  const ask = async (action: string) => {
    setBusy(action);
    setErr(null);
    await load();
    try {
      const r = await ai.followUp({ target_type: targetType, target_id: targetId, action });
      setMsgs((m) => [...(m ?? []), r]);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {[["why_wrong", "Vì sao sai?"], ["explain_again", "Giải thích lại"], ["another_example", "Ví dụ khác"]].map(([a, l]) => (
          <Button key={a} size="sm" variant="outline" disabled={!!busy} onClick={() => ask(a)}><MessageCircleQuestion size={13} />{busy === a ? "Đang hỏi…" : l}</Button>
        ))}
        {msgs === null && <Button size="sm" variant="ghost" onClick={load}>Xem lịch sử giải thích</Button>}
      </div>
      {err != null && <AIErrorBox error={err} onRetry={() => setErr(null)} />}
      {msgs?.map((m, i) => <div key={i} className="rounded-xl bg-surface-2 p-3"><Markdown className="text-sm">{m.content}</Markdown></div>)}
    </div>
  );
}

export function ReviewCard({ q, setId, onRegraded, showFollowUps = true }: { q: ReviewQuestion; setId: string; onRegraded?: (r: Review) => void; showFollowUps?: boolean }) {
  const r = q.response;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  if (!r) return null;
  const canReview = (r.feedback.reviewable || r.feedback.needs_manual_review) && !r.feedback.reviewed_by_ai;
  return (
    <div className="space-y-2">
      <p className="text-sm"><span className="text-muted">Bạn trả lời:</span> <b>{formatAnswer(q, r.answer)}</b></p>
      <GradeView fb={{ ...r.feedback, grader: r.grader, correctness: r.correctness, score: r.score }} expected={q.expected_answer} explanation={q.explanation_vi} rule={q.grammar_rule} />
      {q.options.length > 0 && q.wrong_option_explanations_vi.some(Boolean) && (
        <details className="text-sm"><summary className="cursor-pointer text-primary">Vì sao các phương án khác sai</summary>
          <ul className="mt-1 list-disc pl-5">{q.options.map((o, i) => q.wrong_option_explanations_vi[i] ? <li key={i}><b>{o}:</b> {q.wrong_option_explanations_vi[i]}</li> : null)}</ul></details>
      )}
      {q.evidence_quote && <p className="text-sm"><span className="text-muted">Căn cứ:</span> “{q.evidence_quote}”</p>}
      {q.reading_strategy_vi && <p className="text-sm text-muted">Chiến thuật: {q.reading_strategy_vi}</p>}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {q.related_lesson && <Link className="text-primary underline" to={`/learn/${q.related_lesson.id}`}>Ôn bài {q.related_lesson.id} · {q.related_lesson.title}</Link>}
        {canReview && <Button size="sm" variant="secondary" disabled={busy} onClick={async () => { setBusy(true); setErr(null); try { onRegraded?.(await ai.regrade(setId, q.id)); } catch (e) { setErr(e); } finally { setBusy(false); } }}>
          <RefreshCw size={13} />{busy ? "AI đang xem lại…" : "Yêu cầu xem xét lại"}</Button>}
      </div>
      {err != null && <AIErrorBox error={err} />}
      {showFollowUps && r.correctness !== "correct" && <FollowUps targetType="question" targetId={q.id} />}
    </div>
  );
}

function formatAnswer(q: ReviewQuestion, answer: string): string {
  if (!answer) return "(bỏ trống)";
  if (q.options.length && /^\d+$/.test(answer)) return q.options[Number(answer)] ?? answer;
  if (q.qtype === "matching") {
    try {
      return Object.entries(JSON.parse(answer) as Record<string, string>).map(([l, r]) => `${l} → ${r}`).join("; ");
    } catch {
      return answer;
    }
  }
  return answer;
}
