import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Brain, Check, Keyboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { extendWritingDecks, fixedFrameText, countFixedFrameWords, frameSlots, fillFrame } from "./extendedWritingFrames";
import { FrameApplications, FrameTemplate } from "./FrameApplications";
import { BUDGET_DECKS, FRAME_REVISION } from "./budgetWritingFrames";
import { diffWords } from "./diff";
import { MEMORY_DECKS, WRITING_VOCAB, type MemoryLine } from "./writingMemoryContent";
import {
  advanceMemory, checkMemory, EMPTY_MEMORY, fadedText, hintMemory, memoryTarget, recordMemory, startMemory, STAGE_NAMES, typeMemory,
  writingMemoryFormat, type MemoryProgress, type MemoryRun, type WritingMemoryState,
} from "./writingMemoryState";

const EXTENDED_DECKS = extendWritingDecks(MEMORY_DECKS);

export default function WritingMemory({ saved, onSave, onApply }: {
  saved?: WritingMemoryState; onSave: (state: WritingMemoryState) => void; onApply: (frameId: string) => void;
}) {
  const previous = saved ?? EMPTY_MEMORY;
  const state = { ...previous, format: writingMemoryFormat(previous), frameRevision: FRAME_REVISION };
  const requestedTask = BUDGET_DECKS.find((d) => d.id === state.deckId)?.task ?? 1;
  const budget = state.format === "budget";
  const extended = state.format !== "short";
  const available = budget ? BUDGET_DECKS : extended ? EXTENDED_DECKS : MEMORY_DECKS;
  const deck = available.find((d) => d.id === state.deckId) ?? available.find((d) => d.task === requestedTask) ?? available[0];
  const task = deck.task;
  const rich = extended ? (budget ? BUDGET_DECKS : EXTENDED_DECKS).find((d) => d.id === deck.id) : undefined;
  const deckProgress = budget ? state.budgetDecks ?? {} : extended ? state.extendedDecks ?? {} : state.decks;
  const applicationBucket = budget ? "budgetApplications" : "applications";
  const oldLearned = MEMORY_DECKS.filter((d) => state.decks[d.id]?.passedAt).length;
  const applicationState = state[applicationBucket]?.[deck.id];
  const exampleValues = applicationState?.values ?? rich?.applications[0].values;
  const pack = WRITING_VOCAB.find((p) => p.id === state.packId) ?? WRITING_VOCAB[0];
  const learned = available.filter((d) => deckProgress[d.id]?.passedAt).length;
  const vocabOpen = learned === available.length || BUDGET_DECKS.every((d) => state.budgetDecks?.[d.id]?.passedAt) || oldLearned === MEMORY_DECKS.length || MEMORY_DECKS.every((d) => state.extendedDecks?.[d.id]?.passedAt);
  const isVocab = state.view === "vocabulary" && vocabOpen;
  const items = isVocab ? pack.items : deck.lines;
  const id = isVocab ? pack.id : deck.id;
  const bucket = isVocab ? "packs" : budget ? "budgetDecks" : extended ? "extendedDecks" : "decks";
  const progress = state[bucket]?.[id];
  const active = !!progress?.run && progress.run.phase !== "done";
  const now = Date.now();
  const due = available.filter((d) => (deckProgress[d.id]?.dueAt ?? Infinity) <= now);
  const next = available.find((d) => !deckProgress[d.id]?.passedAt && d.id !== deck.id);
  const saveRun = (run: MemoryRun) => onSave({ ...state, [bucket]: { ...state[bucket], [id]: recordMemory(progress, run) } });
  const choose = (deckId: string) => { onSave({ ...state, deckId, view: "frames" }); };
  return <div className="space-y-5" data-testid="writing-memory-course">
    <Card className="overflow-hidden border-primary/30">
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Gõ để nhớ · Task 1 & Task 2</p><h2 className="mt-2 text-xl font-bold">Thuộc khung trước. Thêm từ vựng sau.</h2>{!active && <p className="mt-2 max-w-2xl text-sm text-muted">Mỗi lần chỉ một câu. Nhìn và gõ → che bớt chữ → tự nhớ hai lượt → ghép cả khung. Học vài câu rồi nghỉ, quay lại đúng chỗ đang gõ.</p>}</div><Badge tone="primary">{learned}/{available.length} khung đã tự gõ được</Badge></div>
        {!isVocab && <label className="block text-sm">Phiên bản khung<select aria-label="Phiên bản khung" className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 sm:max-w-sm" value={state.format} onChange={(e) => onSave({ ...state, format: e.target.value as "budget" | "extended" | "short" })}><option value="budget">Khung mới · Task 1: 70–80 / Task 2: 150–170 từ</option><option value="extended">Khung dài cũ · giữ tiến độ</option><option value="short">Câu dẫn ngắn · bản cũ</option></select></label>}
        {budget && !isVocab && !active && <p className="text-xs text-muted">Khung mới có sẵn câu mở, triển khai và kết; chỉ điền ý theo đề. Số từ cố định không tính tên, nội dung trong ngoặc hoặc dấu câu đứng riêng. Tiến độ các phiên bản được giữ riêng.</p>}
        <Progress value={100 * learned / available.length} label="Tiến độ học thuộc các khung Writing" />
        {!active && <div className="flex flex-wrap gap-2"><Button variant={!isVocab ? "primary" : "outline"} onClick={() => onSave({ ...state, view: "frames" })}><Keyboard size={16} />1. Thuộc toàn bộ khung</Button><Button variant={isVocab ? "primary" : "outline"} disabled={!vocabOpen} onClick={() => onSave({ ...state, view: "vocabulary" })}><BookOpen size={16} />2. Học cụm từ ({WRITING_VOCAB.reduce((n, p) => n + p.items.length, 0)})</Button></div>}
        {active && isVocab && <Button size="sm" variant="outline" onClick={() => onSave({ ...state, view: "frames" })}>Quay lại các khung</Button>}
        {!vocabOpen && !active && <p className="text-xs text-muted">Cụm từ mở sau khi bạn tự gõ được cả {available.length} khung, đúng thứ tự học bạn đã chọn. Có thể xem bài mẫu và viết thử ở các tab phía trên bất cứ lúc nào.</p>}
        {due.length > 0 && !active && <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary-soft p-3 text-sm"><span>{due.length} khung đến lịch nhắc lại.</span><Button size="sm" variant="outline" onClick={() => choose(due[0].id)}>Mở khung cần ôn</Button></div>}
      </CardContent>
    </Card>
    <div className="grid items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <Card><CardContent className="space-y-3 pt-5">
        {isVocab ? <><h3 className="font-semibold">Cụm từ để đưa vào bài</h3><p className="text-xs text-muted">Nhớ theo cụm và xem cả câu áp dụng.</p><label className="block text-sm">Nhóm từ vựng<select aria-label="Nhóm từ vựng" className="mt-2 h-11 w-full rounded-xl border border-border bg-surface px-2" value={pack.id} onChange={(e) => onSave({ ...state, packId: e.target.value })}>{WRITING_VOCAB.map((p) => <option key={p.id} value={p.id}>Task {p.task} · {p.title}{state.packs[p.id]?.passedAt ? " ✓" : ""}</option>)}</select></label></> : <>
          <div className="grid grid-cols-2 gap-2">{([1, 2] as const).map((t) => <Button key={t} variant={task === t ? "primary" : "outline"} aria-pressed={task === t} onClick={() => { if (deck.task !== t) choose(available.find((d) => d.task === t)!.id); }}>Task {t}</Button>)}</div>
          <p className="text-xs text-muted">{task === 1 ? budget ? "Thư / email · 10 khung trang trọng + 8 khung thân mật" : "Thư / email · 10 mục đích thường gặp" : "Bài luận · 10 dạng và biến thể"}</p>
          <label className="block text-sm lg:hidden">Dạng đang học<select aria-label="Dạng đang học" className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-2" value={deck.id} onChange={(e) => choose(e.target.value)}>{available.filter((d) => d.task === task).map((d) => <option key={d.id} value={d.id}>{d.title}{deckProgress[d.id]?.passedAt ? " ✓" : ""}</option>)}</select></label>
          <nav aria-label="Các dạng Writing" className="hidden space-y-1 lg:block">{available.filter((d) => d.task === task).map((d, i) => <button key={d.id} onClick={() => choose(d.id)} aria-current={deck.id === d.id ? "step" : undefined} className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${deck.id === d.id ? "bg-primary-soft font-semibold text-primary" : "hover:bg-surface-2"}`}><span className="mt-0.5 shrink-0">{deckProgress[d.id]?.passedAt ? <Check size={15} aria-label="Đã tự gõ được" /> : `${i + 1}.`}</span><span>{d.title}</span></button>)}</nav>
          <p className={`text-xs text-muted ${active ? "hidden" : ""}`}>Đây là cách chia để tự luyện. Đề thật có thể kết hợp nhiều yêu cầu; hãy đọc từng ý của đề.</p>
        </>}
      </CardContent></Card>
      <div className="min-w-0 space-y-4">
        <div><Badge tone="primary">Task {isVocab ? pack.task : deck.task}</Badge><h2 className="mt-2 text-xl font-bold">{isVocab ? pack.title : deck.title}</h2>{!isVocab && <><p className={`mt-2 rounded-xl bg-surface-2 p-3 font-medium ${active ? "text-xs" : "text-sm"}`}>{deck.map}</p><details className="mt-2" open={active ? undefined : true}><summary className="cursor-pointer text-xs text-muted">Nhận dạng đề và cách dùng khung</summary><p className="mt-2 text-sm">{deck.signal}</p><p className="mt-2 text-sm text-muted">{deck.note}</p></details></>}</div>
        {rich && !isVocab && !active && <div data-testid="frame-budget" className="rounded-xl bg-primary-soft p-3 text-sm"><b>{countFixedFrameWords(memoryTarget(items))} từ cố định</b> có sẵn trong khung. {budget && `Còn ít nhất ${(deck.task === 1 ? 120 : 250) - countFixedFrameWords(memoryTarget(items))} từ ý riêng để đạt mốc của bài hoàn chỉnh. `}Phần trong [ngoặc vuông] là ý cần đổi theo đề; có ví dụ điền sẵn phía dưới.</div>}
        <MemoryPractice key={`${bucket}:${id}`} items={items} progress={progress} whole={!isVocab} onRun={saveRun} exampleValues={isVocab ? undefined : exampleValues} />
        {rich && !isVocab && !active && <FrameApplications key={`${state.format}:${deck.id}`} deck={rich} saved={applicationState} onSave={(value) => onSave({ ...state, [applicationBucket]: { ...state[applicationBucket], [deck.id]: value } })} />}
        {progress?.run?.phase === "done" && <div className="flex flex-wrap gap-2">
          {!isVocab && next && <Button onClick={() => choose(next.id)}>Học khung tiếp theo <ArrowRight size={16} /></Button>}
          {!isVocab && !next && <Button onClick={() => onSave({ ...state, view: "vocabulary" })}>Bắt đầu học cụm từ <ArrowRight size={16} /></Button>}
          <Button variant="outline" onClick={() => onApply(isVocab ? pack.task === 1 ? "informal-email" : "opinion" : deck.frameId)}>Viết thử với khung tham khảo</Button>
        </div>}
        {(!progress?.run || progress.run.phase === "done") && <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Xem toàn bộ {isVocab ? "cụm từ và câu áp dụng" : "khung và nghĩa từng câu"}</summary><ol className="mt-4 space-y-4">{items.map((c, i) => <li key={c.id}><p className="text-xs text-muted">{i + 1}. {c.part} · {c.vi}</p><p className="mt-1 font-medium"><FrameTemplate text={c.en} /> <span className="text-primary">{c.slot}</span></p><p className="mt-1 text-sm text-muted">Ví dụ: {c.example}</p></li>)}</ol></details>}
      </div>
    </div>
  </div>;
}

function MemoryPractice({ items, progress, whole, onRun, exampleValues }: { items: MemoryLine[]; progress?: MemoryProgress; whole: boolean; onRun: (r: MemoryRun) => void; exampleValues?: Record<string, string> }) {
  const run = progress?.run;
  const input = useRef<HTMLTextAreaElement>(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  useEffect(() => { input.current?.focus(); }, [run?.index, run?.phase]);
  const start = () => { const fresh = startMemory(items); onRun(reviewOnly ? { ...fresh, jobs: fresh.jobs.filter((j) => j.stage >= 2) } : fresh); };
  if (!run || run.phase === "done") return <Card><CardHeader><CardTitle>{run?.phase === "done" ? "Bạn đã tự gõ được " + (whole ? "cả khung" : "nhóm cụm từ") : "Học từng phần của khung"}</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted">{run?.phase === "done" ? `Lượt này có ${run.mistakes} lần chưa khớp đã được luyện lại. Hãy nhắc lại sau một ngày, rồi 3 ngày và 7 ngày để kiểm tra khả năng nhớ lâu.` : `${items.length} ${whole ? "câu / cụm cố định" : "cụm từ"}. Mỗi lượt đi qua cả bộ trước khi hỏi lại, giúp bạn tập nhớ thay vì chỉ chép ngay câu vừa xem.`}</p>
    {progress?.dueAt && <p className="text-sm">Lần ôn tiếp: <b>{new Date(progress.dueAt).toLocaleDateString("vi-VN")}</b>{progress.dueAt <= Date.now() && " · Đã đến lịch ôn"}</p>}
    {progress?.passedAt && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />Ôn nhanh: tự nhớ hai lượt, bỏ bước chép</label>}
    <Button onClick={start}><Keyboard size={16} />{run?.phase === "done" ? "Gõ lại để củng cố" : "Bắt đầu gõ từng câu"}</Button>
    <p className="text-xs text-muted">Nhấn Enter để kiểm tra và tiếp tục; Shift + Enter xuống dòng. Không tính tốc độ. Có thể dừng bất cứ lúc nào, câu đang gõ được lưu.</p>
  </CardContent></Card>;
  const full = run.phase === "whole";
  const job = run.jobs[run.index];
  const line = items.find((c) => c.id === job?.id) ?? items[0];
  const target = full ? memoryTarget(items) : line.en;
  const contextualExample = exampleValues ? fillFrame(line.en, exampleValues) : line.example;
  const hasSlots = frameSlots(target).length > 0;
  const shown = run.hinted || run.checked || (!full && job.stage === 0);
  const assisted = run.hinted && (full || job.stage > 0);
  const needsRetry = !run.correct || assisted;
  const submit = () => onRun(run.checked ? advanceMemory(run, whole) : checkMemory(run, items));
  return <Card data-testid="typing-practice"><CardContent className="space-y-4 pt-5">
    <div className="flex flex-wrap gap-2"><Badge tone="primary">{full ? "Ghép khung từ trí nhớ" : STAGE_NAMES[job.stage]}</Badge><Badge>{full ? `${items.length} câu theo thứ tự` : `Câu ${items.findIndex((c) => c.id === line.id) + 1}/${items.length}`}</Badge></div>
    <Progress value={full ? 100 : 100 * run.index / run.jobs.length} label="Tiến độ lượt gõ" />
    {full ? <><h3 className="text-lg font-semibold">Tự gõ phần cố định của cả khung</h3><p className="text-sm text-muted">Gõ lần lượt từ mở đến kết. Chỉ gõ phần cố định đã học; chưa cần thêm tên, ý riêng hoặc phần trong ngoặc vuông. Đây là kiểm tra khung, chưa phải một bài viết hoàn chỉnh.</p><ol className="grid list-inside list-decimal gap-1 text-sm text-muted sm:grid-cols-2">{items.map((c) => <li key={c.id}>{c.vi}</li>)}</ol></> : <><p className="text-xs font-semibold uppercase tracking-wide text-primary">{line.part}</p><h3 className="text-lg font-semibold">{line.vi}</h3>{line.slot && <p className="text-sm text-muted">Khi viết bài, nối thêm: <span className="font-medium">{line.slot}</span></p>}</>}
    {!run.checked && shown && <div className="whitespace-pre-wrap break-words rounded-xl border border-primary/20 bg-primary-soft p-4 text-lg font-medium leading-relaxed" data-testid="typing-model"><FrameTemplate text={target} /></div>}
    {!full && job.stage === 1 && !shown && <p className="break-words rounded-xl bg-surface-2 p-4 font-mono text-lg" aria-label="Gợi ý chữ đầu">{fadedText(target)}</p>}
    {hasSlots && <p className="text-xs text-muted">Chỉ gõ chữ cố định. Bỏ qua phần [trong ngoặc]; nếu gõ cả nhãn trong ngoặc cũng được. Ý điền vào sẽ luyện ở mục áp dụng.</p>}
    {!full && !run.checked && job.stage === 0 && <p className="text-sm text-muted">Ví dụ áp dụng: {contextualExample}</p>}
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label className="block text-sm font-medium" htmlFor="writing-memory-input">{full ? "Gõ toàn bộ khung" : "Gõ câu tiếng Anh"}</label>
      <Textarea ref={input} id="writing-memory-input" rows={full ? Math.min(items.length + 1, 12) : 3} className="text-lg" value={run.text} readOnly={run.checked} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={full ? "Nhớ lại lần lượt từ mở đến kết…" : "Gõ ở đây…"} onChange={(e) => onRun(typeMemory(run, e.target.value))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
      {run.checked && <div role="status" className={`space-y-2 rounded-xl border p-4 ${needsRetry ? "border-border bg-surface-2" : "border-success/30 bg-success-soft"}`}>
        <p className="font-semibold">{!run.correct ? "Chưa khớp — xem chỗ cần sửa" : assisted ? "Gõ đúng sau khi xem mẫu — sẽ hỏi lại" : full ? "Bạn đã nhớ đúng thứ tự cả khung" : job.stage < 2 ? "Gõ đúng — tiếp tục giảm gợi ý" : "Nhớ đúng không nhìn mẫu"}</p>
        {!run.correct && <><p className="whitespace-pre-wrap break-words text-base">{diffWords(fixedFrameText(run.text), fixedFrameText(target)).map((p, i) => p.type === "del" ? <del key={i} className="mx-0.5 bg-danger-soft text-danger">{p.text}</del> : p.type === "ins" ? <ins key={i} className="mx-0.5 bg-primary-soft font-semibold text-primary">{p.text}</ins> : <span key={i}>{p.text}</span>)}</p><p className="text-xs text-muted">Gạch ngang: phần cần bỏ hoặc thay. Gạch dưới: phần cần thêm.</p></>}
        <p className="whitespace-pre-wrap break-words font-medium"><FrameTemplate text={target} /></p>
        {!full && <p className="text-sm text-muted">Áp dụng: {contextualExample}</p>}
        {needsRetry && <p className="text-sm">{full ? "Lượt tiếp theo che mẫu để bạn gõ lại cả khung." : "Câu này sẽ quay lại ở cuối hàng đợi; xem mẫu chưa được tính là tự nhớ."}</p>}
      </div>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!run.checked && !run.text.trim()}>{run.checked ? full ? needsRetry ? "Che mẫu, gõ lại khung" : "Hoàn tất khung" : "Tiếp tục" : "Kiểm tra"}<ArrowRight size={16} /></Button>{!run.checked && !shown && <Button variant="outline" onClick={() => onRun(hintMemory(run))}><Brain size={16} />Chưa nhớ — xem mẫu</Button>}</div>
    </form>
    <p className="text-xs text-muted">Bỏ qua khác biệt chữ hoa, khoảng trắng và dấu câu thông thường. Khi viết thật, bạn có thể diễn đạt khác; ở đây mình luyện một mẫu nhất quán để dễ nhớ.</p>
    <details><summary className="cursor-pointer text-xs text-muted">Muốn bắt đầu lại lượt này?</summary><p className="mt-2 text-xs text-muted">Xóa câu đang gõ và tiến độ của lượt này; các khung khác vẫn được giữ.</p><Button className="mt-2" size="sm" variant="outline" onClick={() => onRun(startMemory(items))}><RotateCcw size={14} />Bắt đầu lại lượt gõ</Button></details>
  </CardContent></Card>;
}
