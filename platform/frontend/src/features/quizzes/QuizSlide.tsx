import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";
import type { ItemResult, Step } from "@/types/content";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { api } from "@/services/api";
import { ItemCard } from "./ItemCard";
import { AudioPanel } from "./AudioPanel";
import { ReadingPassage } from "./ReadingPassage";
import { isAnswered, toResponse, type Draft } from "./draft";

export interface QuizSlideProps {
  step: Step;
  unitId: string;
  docPath: string;
  drafts: Record<string, Draft>;
  setDraft: (itemId: string, d: Draft) => void;
  results: Record<string, ItemResult>;
  setResults: (r: Record<string, ItemResult>) => void;
  clearResult: (itemId: string) => void;
  highlights: string[];
  onHighlights: (h: string[]) => void;
  /** Exam mode: answers are collected and submitted together at the end. */
  deferred: boolean;
  examSubmitted: boolean;
  registerPrimary: (fn: (() => void) | null, label?: string) => void;
  onXp: (xp: number, badges: string[]) => void;
}

export function QuizSlide(p: QuizSlideProps) {
  const { step, results, drafts } = p;
  const items = useMemo(() => step.items ?? [], [step.items]);
  const [busy, setBusy] = useState(false);
  const pending = items.filter((it) => !results[it.id] && isAnswered(it, drafts[it.id]));
  const answeredOrDone = items.filter((it) => results[it.id] || isAnswered(it, drafts[it.id])).length;

  const check = useCallback(async () => {
    if (!pending.length || busy || p.deferred) return;
    setBusy(true);
    try {
      const answers = Object.fromEntries(pending.map((it) => [it.id, toResponse(it, drafts[it.id])]));
      const r = await api.submitQuiz(step.quiz_id!, answers);
      p.setResults(r.results);
      p.onXp(r.xp_gained, r.new_achievements);
      const auto = Object.values(r.results).filter((x) => x.auto);
      if (auto.length) {
        const ok = auto.filter((x) => x.verdict === "correct").length;
        toast.info(`Đúng ${ok}/${auto.length} câu tự chấm${r.xp_gained ? ` · +${r.xp_gained} XP` : ""}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không nộp được bài");
    } finally {
      setBusy(false);
    }
  }, [pending, busy, p, drafts, step.quiz_id]);

  const { registerPrimary } = p;
  useEffect(() => {
    registerPrimary(pending.length && !p.deferred ? check : null, busy ? "Đang chấm…" : `Kiểm tra (${pending.length})`);
    return () => registerPrimary(null);
  }, [pending.length, check, registerPrimary, p.deferred, busy]);

  const selfAssess = async (r: ItemResult, correct: boolean) => {
    try {
      const res = await api.selfAssess(r.attempt_id, correct);
      p.setResults({ [r.item_id]: res.result });
      if (res.xp_gained) p.onXp(res.xp_gained, []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được");
    }
  };

  const list = (
    <div className="space-y-3">
      {items.map((it) => (
        <ItemCard key={it.id} item={it} unitId={p.unitId} docPath={p.docPath} draft={drafts[it.id]}
          onDraft={(d) => p.setDraft(it.id, d)} result={results[it.id]} locked={p.deferred && p.examSubmitted}
          onSelfAssess={(c) => results[it.id] && selfAssess(results[it.id], c)} onRetry={() => p.clearResult(it.id)}
          onEnter={check} />
      ))}
    </div>
  );

  const footer = !p.deferred && (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <span className="text-sm text-muted">{answeredOrDone}/{items.length} câu đã trả lời</span>
      <Button className="ml-auto" onClick={check} disabled={!pending.length || busy}><CheckCheck size={16} />{busy ? "Đang chấm…" : `Kiểm tra${pending.length ? ` (${pending.length})` : ""}`}</Button>
    </div>
  );

  const intro = step.intro_md && step.variant !== "reading" ? <Markdown docPath={p.docPath} className="mb-4">{step.intro_md}</Markdown> : null;
  const deferredNote = p.deferred && !p.examSubmitted && (
    <p className="mb-3 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">Chế độ kiểm tra: đáp án và giải thích chỉ hiện sau khi bạn nộp toàn bài ở slide cuối.</p>
  );

  if (step.variant === "reading" && step.passage_md) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          <ReadingPassage md={step.passage_md} docPath={p.docPath} highlights={p.highlights} onHighlights={p.onHighlights} />
        </div>
        <div>{deferredNote}{list}{footer}</div>
      </div>
    );
  }
  return (
    <div>
      {intro}
      {step.variant === "listening" && step.transcript && (
        <div className="mb-4"><AudioPanel lines={step.transcript.lines} transcriptMd={step.transcript.md} docPath={p.docPath} /></div>
      )}
      {deferredNote}
      {list}
      {footer}
    </div>
  );
}
