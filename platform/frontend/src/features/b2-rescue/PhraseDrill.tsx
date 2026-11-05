import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SpeakButton } from "@/components/SpeakButton";
import type { Phrase } from "./content";
import { LEARNING_BY_ID } from "./topicVocabulary";
import { markAnswer, nextPrompt, type RescueState, type Run } from "./state";

export function PhraseDetails({ phrase: p }: { phrase: Phrase }) {
  return <div className="space-y-3 text-sm">
    <div className="flex items-start gap-2"><p className="text-xl font-semibold text-primary" lang="en">{p.en}</p><SpeakButton text={p.en} /></div>
    <p className="font-medium">{p.vi}</p>
    <p className="rounded-xl bg-surface-2 p-3" lang="en">{p.pattern}</p>
    <div><p className="text-xs font-bold uppercase text-muted">Writing</p><p className="mt-1" lang="en">{p.writing} <SpeakButton text={p.writing} /></p></div>
    <div><p className="text-xs font-bold uppercase text-muted">Speaking / cách nói tự nhiên</p><p className="mt-1" lang="en">{p.speaking} <SpeakButton text={p.speaking} /></p></div>
    <p className="rounded-xl border border-border p-3"><b>Nhớ cách dùng:</b> {p.trap}</p>
  </div>;
}

export function PhraseDrill({ state, runKey, update, nextBlock, restart, nextLabel = "Sang chặng tiếp theo" }: {
  state: RescueState; runKey: string; update: (fn: (s: RescueState) => RescueState) => void; nextBlock: () => void; restart: () => void; nextLabel?: string;
}) {
  const run = state.runs[runKey];
  const prompt = run?.queue[0];
  const phrase = prompt ? LEARNING_BY_ID[prompt.id] : undefined;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (prompt) input.current?.focus(); }, [prompt?.id, prompt?.mode, run?.answered]);
  const change = (patch: Partial<Run>) => update((s) => ({ ...s, runs: { ...s.runs, [runKey]: { ...s.runs[runKey], ...patch } } }));
  if (!run || !phrase) return <Card className="space-y-4 p-6" data-testid="drill-finished"><h2 className="text-xl font-bold">Đã đi hết lượt luyện này</h2><p>Chuyển sang phần tiếp theo. Các cụm đã bỏ qua vẫn nằm trong danh sách cần ôn.</p><div className="flex flex-wrap gap-2"><Button onClick={nextBlock}>{nextLabel}</Button><Button variant="outline" onClick={restart}>Luyện nhớ lại lượt mới</Button></div></Card>;
  const visible = prompt.mode === "copy" || run.hinted || !!run.feedback;
  return <Card className="space-y-5 p-5 sm:p-7" data-testid="phrase-drill">
    <div className="flex flex-wrap justify-between gap-2 text-sm"><b>{prompt.mode === "copy" ? "① Hiểu → nghe → nhìn và gõ" : "② Che đáp án → tự nhớ"}</b><span className="text-muted">Còn {run.queue.length} lượt · đã làm {run.answered}</span></div>
    {visible ? <PhraseDetails phrase={phrase} /> : <div className="space-y-4 py-6"><p className="text-xs uppercase tracking-wider text-muted">Từ nghĩa Việt, nhớ lại đúng cụm đã học</p><h2 className="text-2xl font-bold">{phrase.vi}</h2><p className="text-sm text-muted">Không cần viết cả câu. Chấp nhận khác biệt chữ hoa và dấu câu.</p></div>}
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run.feedback) update((s) => nextPrompt(s, runKey)); else if (run.text.trim()) update((s) => markAnswer(s, runKey)); }}>
      <label className="block text-sm font-medium" htmlFor="rescue-answer">Gõ cụm tiếng Anh</label>
      <input ref={input} id="rescue-answer" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={run.text} readOnly={!!run.feedback}
        onChange={(e) => change({ text: e.target.value })} className="min-h-12 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base focus:border-primary" />
      {run.feedback && <div role="status" className="rounded-xl bg-surface-2 p-3 text-sm">
        {run.feedback === "copy" ? "Gõ đúng. Lát nữa bạn sẽ tự nhớ khi đáp án đã ẩn." : run.feedback === "correct" ? "Đúng, không dùng gợi ý. Nói cụm này thành tiếng trước khi tiếp tục." : "Chưa tính là tự nhớ. Đọc đáp án, chú ý chỗ khác và thử lại ở cuối lượt."}
        {run.feedback === "retry" && <p className="mt-2">Đáp án cần nhớ: <b lang="en">{phrase.en}</b></p>}
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!run.feedback && !run.text.trim()}>{run.feedback ? "Tiếp tục ↵" : "Kiểm tra ↵"}</Button>
        {!visible && <Button variant="outline" onClick={() => change({ hinted: true })}>Gợi ý / xem đáp án</Button>}
        {!run.feedback && <Button variant="ghost" onClick={() => update((s) => nextPrompt(s, runKey, true))}>Để ôn sau</Button>}
      </div>
      {run.hinted && !run.feedback && <p className="text-xs text-muted">Đã xem gợi ý: lượt này giúp học lại, chưa được tính là tự nhớ.</p>}
    </form>
  </Card>;
}
