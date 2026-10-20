import { useEffect, useMemo, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import type { ItemResult, QuizItem } from "@/types/content";
import { InlineMd, Markdown } from "@/components/Markdown";
import { Input, Textarea } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { SpeakButton } from "@/components/SpeakButton";
import { ResultPanel } from "./ResultPanel";
import { QuizHelpButton } from "./QuizHelp";
import { WritingEditor, wordTarget } from "./WritingEditor";
import { SpeakingRecorder } from "./SpeakingRecorder";
import type { Draft, SpeakingDraft } from "./draft";

interface Props {
  item: QuizItem;
  unitId: string;
  docPath: string;
  draft: Draft;
  onDraft: (d: Draft) => void;
  result?: ItemResult;
  locked: boolean;
  onSelfAssess: (correct: boolean) => void;
  onRetry?: () => void;
  onEnter?: () => void;
  /** "I don't know": show the answer without answering (graded as not correct). Not offered in exams. */
  onReveal?: () => void;
  /** grade answers that differ from the key with AI automatically (journey grades them itself first) */
  aiAuto?: boolean;
  /** shown on its own (not under its exercise): show the group instruction when the item has none of its own */
  single?: boolean;
  /** the parent is grading this answer with AI (non-blocking) */
  aiPending?: boolean;
}

function shuffleOrder(n: number, seed: string): number[] {
  // deterministic shuffle so the token bank does not reorder on every render
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

export function ItemCard({ item, unitId, docPath, draft, onDraft, result, locked, onSelfAssess, onRetry, onEnter, onReveal, aiAuto, single, aiPending }: Props) {
  const disabled = locked || !!result;
  const showPrompt = item.kind !== "long" || item.prompt_md.length < 1200;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4" data-item={item.id}>
      {(item.instruction_md || (single && item.group_md)) && <Markdown docPath={docPath} className="mb-2 text-sm text-muted">{item.instruction_md || item.group_md!}</Markdown>}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{item.label}</span>
        <div className="min-w-0 flex-1">
          {showPrompt ? <Markdown docPath={docPath} className="text-[15px]">{item.prompt_md || "(xem hướng dẫn phía trên)"}</Markdown>
            : <details><summary className="cursor-pointer text-sm text-primary">Xem đề bài</summary><Markdown docPath={docPath}>{item.prompt_md}</Markdown></details>}
        </div>
        {(item.kind === "mc" || item.kind === "text" || item.kind === "choice") && item.prompt_md.length < 200 && /[a-z]{3}/i.test(item.prompt_md) && (
          <SpeakButton text={item.prompt_md.replace(/_{2,}/g, "blank")} label="Nghe câu hỏi" />
        )}
      </div>
      <div className="mt-3">
        <Answer item={item} unitId={unitId} draft={draft} onDraft={onDraft} disabled={disabled} result={result} onEnter={onEnter} />
      </div>
      {!result && !locked && onReveal && <QuizHelpButton key={item.id} itemId={item.id} />}
      {!result && !locked && onReveal && (
        <button type="button" onClick={onReveal} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
          <Eye size={14} />Không biết — xem đáp án
        </button>
      )}
      {result && <ResultPanel key={result.attempt_id} result={result} docPath={docPath} onSelfAssess={onSelfAssess} onRetry={locked ? undefined : onRetry} aiAuto={aiAuto} aiPending={aiPending} />}
    </div>
  );
}

function Answer({ item, unitId, draft, onDraft, disabled, result, onEnter }: {
  item: QuizItem; unitId: string; draft: Draft; onDraft: (d: Draft) => void; disabled: boolean; result?: ItemResult; onEnter?: () => void;
}) {
  switch (item.kind) {
    case "mc":
    case "tfng":
    case "choice":
    case "multi":
      return <Choices item={item} value={draft as string} onChange={onDraft} disabled={disabled} result={result} />;
    case "order":
      return <Ordering item={item} value={(draft as number[]) ?? []} onChange={onDraft} disabled={disabled} />;
    case "long":
      return <WritingEditor value={(draft as string) ?? ""} onChange={onDraft} unitId={unitId} itemId={item.id} target={wordTarget(item.prompt_md)} disabled={disabled} />;
    case "speaking": {
      const d = (draft as SpeakingDraft) ?? { notes: "", checklist: {} };
      return <SpeakingRecorder notes={d.notes} checklist={d.checklist} disabled={disabled}
        onNotes={(notes) => onDraft({ ...d, notes })} onChecklist={(checklist) => onDraft({ ...d, checklist })} />;
    }
    default:
      return <TextAnswer item={item} value={draft as string | undefined} onChange={onDraft} disabled={disabled} onEnter={onEnter} />;
  }
}

function TextAnswer({ item, value, onChange, disabled, onEnter }: { item: QuizItem; value?: string; onChange: (v: string) => void; disabled: boolean; onEnter?: () => void }) {
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (value === undefined && item.prefill && !touched) onChange(item.prefill);
  }, [value, item.prefill, touched, onChange]);
  const hint = item.prefill ? "Sửa câu trực tiếp trong ô" : "Nhập câu trả lời";
  if (item.multiline) {
    return <Textarea rows={3} value={value ?? ""} disabled={disabled} aria-label={hint} placeholder={hint}
      onChange={(e) => { setTouched(true); onChange(e.target.value); }} />;
  }
  return (
    <Input value={value ?? ""} disabled={disabled} aria-label={hint} placeholder={hint} autoComplete="off" spellCheck={false}
      onChange={(e) => { setTouched(true); onChange(e.target.value); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter?.(); } }} />
  );
}

function Choices({ item, value, onChange, disabled, result }: { item: QuizItem; value?: string; onChange: (v: string) => void; disabled: boolean; result?: ItemResult }) {
  const correct = result?.correct_option;
  return (
    <div role="radiogroup" aria-label={`Lựa chọn cho câu ${item.label}`} className="grid gap-2 sm:grid-cols-2">
      {(item.options ?? []).map((o) => {
        const chosen = value === o.key;
        const isCorrect = correct && o.key === correct;
        const isWrongChoice = result && chosen && correct && o.key !== correct;
        return (
          <button key={o.key} type="button" role="radio" aria-checked={chosen} disabled={disabled} onClick={() => onChange(o.key)}
            className={cn("flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-[15px] transition",
              chosen ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50 hover:bg-surface-2",
              isCorrect && "border-success bg-success-soft", isWrongChoice && "border-danger bg-danger-soft", disabled && "cursor-default")}>
            <span className={cn("grid h-6 min-w-6 place-items-center rounded-md px-1 text-xs font-bold", chosen ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted")}>{o.key}</span>
            <span className="min-w-0"><InlineMd>{o.text}</InlineMd></span>
          </button>
        );
      })}
    </div>
  );
}

function Ordering({ item, value, onChange, disabled }: { item: QuizItem; value: number[]; onChange: (v: number[]) => void; disabled: boolean }) {
  const tokens = item.tokens ?? [];
  const bank = useMemo(() => shuffleOrder(tokens.length, item.id), [tokens.length, item.id]);
  return (
    <div className="space-y-2">
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 p-2" aria-label="Câu bạn đang sắp xếp">
        {value.length === 0 && <span className="px-1 text-sm text-muted">Bấm các từ bên dưới theo đúng thứ tự</span>}
        {value.map((ti, pos) => (
          <button key={`${ti}-${pos}`} type="button" disabled={disabled} onClick={() => onChange(value.filter((_, p) => p !== pos))}
            className="rounded-lg bg-primary px-2.5 py-1 text-sm text-primary-fg" aria-label={`Bỏ từ ${tokens[ti]}`}>{tokens[ti]}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {bank.map((ti) => (
          <button key={ti} type="button" disabled={disabled || value.includes(ti)} onClick={() => onChange([...value, ti])}
            className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm hover:border-primary disabled:opacity-30">{tokens[ti]}</button>
        ))}
        {value.length > 0 && !disabled && (
          <button type="button" onClick={() => onChange([])} className="inline-flex items-center gap-1 px-2 text-xs text-muted hover:text-fg"><RotateCcw size={12} />Xếp lại</button>
        )}
      </div>
    </div>
  );
}
