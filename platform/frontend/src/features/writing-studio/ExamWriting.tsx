import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, Brain, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input, Textarea } from "@/components/ui/misc";
import { safeStorage, wordCount } from "@/lib/utils";
import { assembleWriting, FRAME_FORMAT_SOURCE, frameById, frameDraftKey, unfilledSlots, WRITING_FRAMES, type WritingFrame } from "./examFrames";
import {
  checkRecall, EMPTY_DRAFT, EMPTY_EXAM, freshRecall, nextRecall, revealRecall, updateRecallText,
  type ExamDraft, type ExamWritingState, type FrameRecall,
} from "./examWritingState";

const storage = safeStorage();
const KEY = "em-writing-exam";
const STEPS = [{ key: "frame", title: "1. Xem khung", icon: BookOpen }, { key: "write", title: "2. Viết theo khung", icon: PenLine }, { key: "memory", title: "3. Học thuộc khung", icon: Brain }] as const;

export default function ExamWriting() {
  const [state, setState] = useState(() => storage.get<ExamWritingState>(KEY, EMPTY_EXAM));
  useEffect(() => { storage.set(KEY, state); }, [state]);
  const frame = frameById(state.frameId);
  const topic = frame.topics.find((t) => t.id === state.topics[frame.id]) ?? frame.topics[0];
  const key = frameDraftKey(frame.id, topic.id);
  const draft = state.drafts[key] ?? EMPTY_DRAFT;
  const text = assembleWriting(frame, draft.parts);
  const slots = unfilledSlots(text);
  const words = wordCount(text.replace(/\[[^\]]+\]/g, ""));
  const checks = [...topic.requirements, "Đã có phần mở, thân và kết; các ý nối với nhau rõ ràng.", "Đã soát thì, chủ–vị, mạo từ, số nhiều và dấu câu."];
  const setDraft = (fn: (d: ExamDraft) => ExamDraft) => setState((s) => ({ ...s, drafts: { ...s.drafts, [key]: fn(s.drafts[key] ?? EMPTY_DRAFT) } }));
  const setRun = (fn: (r: FrameRecall) => FrameRecall) => setState((s) => ({ ...s, recall: { ...s.recall, [frame.id]: fn(s.recall[frame.id] ?? freshRecall(frame)) } }));
  return <div className="reader-writing space-y-5" data-testid="writing-exam">
    <Card><CardContent className="space-y-4 pt-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Khung bài<select aria-label="Khung bài" className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3" value={frame.id} onChange={(e) => setState((s) => ({ ...s, frameId: e.target.value }))}>
          {WRITING_FRAMES.map((f) => <option key={f.id} value={f.id}>Task {f.task} · {f.title}</option>)}
        </select></label>
        <label className="text-sm font-medium">Chủ đề luyện<select aria-label="Chủ đề luyện" className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3" value={topic.id} onChange={(e) => setState((s) => ({ ...s, topics: { ...s.topics, [frame.id]: e.target.value } }))}>
          {frame.topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select></label>
      </div>
      <div className="flex flex-wrap gap-2"><Badge tone="primary">VSTEP-style · Task {frame.task}</Badge><Badge>Tối thiểu {frame.wordMin} từ</Badge><Badge>Gợi ý luyện {frame.minutes} phút</Badge></div>
      <p className="text-sm text-muted">{frame.guidance}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Các bước ôn thi Writing">{STEPS.map(({ key, title, icon: Icon }) => <Button key={key} variant={state.step === key ? "primary" : "outline"} aria-pressed={state.step === key} onClick={() => setState((s) => ({ ...s, step: key }))}><Icon size={16} />{title}</Button>)}</div>
      <p className="text-xs text-muted">Nháp được lưu riêng theo khung và chủ đề trong trình duyệt. Đổi chủ đề rồi quay lại để viết tiếp.</p>
    </CardContent></Card>

    {state.step === "frame" && <>
      <Card><CardHeader><CardTitle>Bố cục cần nhớ</CardTitle></CardHeader><CardContent>
        <ol className="reader-outline grid gap-3 md:grid-cols-2">{frame.sections.map((s, i) => <li key={s.id} className="rounded-2xl border border-border p-4"><h3 className="font-semibold">{i + 1}. {s.title}</h3><p className="mt-1 text-sm text-muted">{s.goal}</p><p className="reader-pattern mt-3 whitespace-pre-wrap rounded-xl bg-primary-soft/40 p-3 text-sm leading-relaxed">{s.pattern}</p></li>)}</ol>
        <p className="mt-3 text-sm text-muted">Học bố cục và câu dẫn; phần trong [ngoặc vuông] phải thay bằng ý trả lời đúng đề. Đây là bố cục gợi ý để luyện, có thể điều chỉnh khi cần.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Ví dụ áp dụng: {frame.topics[0].title}</CardTitle></CardHeader><CardContent>
        <details><summary className="cursor-pointer font-medium text-primary">Xem bài mẫu và vai trò từng đoạn</summary><p className="mt-3 text-sm text-muted">Bài mẫu minh họa cho chủ đề {frame.topics[0].title}; khi đổi đề, cần đổi cả lập luận và ví dụ.</p>
          <div className="mt-3 space-y-4">{frame.sections.map((s) => <div key={s.id}><h3 className="text-sm font-bold text-primary">{s.title}</h3><p className="mt-1 whitespace-pre-wrap leading-relaxed">{s.example}</p></div>)}</div>
        </details>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setState((s) => ({ ...s, step: "write" }))}>Tập viết vào khung</Button><Button variant="outline" onClick={() => setState((s) => ({ ...s, step: "memory" }))}>Học thuộc các câu dẫn</Button></div>
      </CardContent></Card>
    </>}

    {state.step === "write" && <>
      <Card><CardHeader><CardTitle>Đề luyện: {topic.title}</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="leading-relaxed">{topic.prompt}</p><ul className="list-disc space-y-1 pl-5 text-sm">{topic.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
        <details><summary className="cursor-pointer text-sm font-medium text-primary">Gợi ý lên ý — mở khi cần</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{topic.ideas.map((idea) => <li key={idea}>{idea}</li>)}</ul></details>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={state.hideFrame} onChange={(e) => setState((s) => ({ ...s, hideFrame: e.target.checked }))} />Ẩn khung khi tự viết</label>
      </CardContent></Card>
      {frame.sections.map((part, i) => <Card key={part.id}><CardContent className="space-y-3 pt-5">
        <label htmlFor={`exam-${part.id}`} className="block font-semibold">{i + 1}. {part.title}</label><p className="text-sm text-muted">{part.goal}</p>
        {!state.hideFrame && <div className="space-y-2 rounded-xl bg-surface-2 p-3"><p className="whitespace-pre-wrap text-sm leading-relaxed">{part.pattern}</p>
          <Button size="sm" variant="outline" disabled={!!draft.parts[part.id]?.trim()} onClick={() => setDraft((d) => ({ ...d, parts: { ...d.parts, [part.id]: part.pattern }, checks: {} }))}>Dùng khung đoạn {i + 1}</Button></div>}
        <Textarea id={`exam-${part.id}`} rows={part.id === "details" ? 7 : 5} placeholder="Viết phần này bằng ý của bạn…" value={draft.parts[part.id] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, parts: { ...d.parts, [part.id]: e.target.value }, checks: {} }))} />
      </CardContent></Card>)}
      <Card><CardHeader><CardTitle>Ghép bài và tự rà soát</CardTitle></CardHeader><CardContent className="space-y-3">
        <p className="text-sm"><b>{words} từ</b> / tối thiểu {frame.wordMin} · {frame.sections.filter((s) => !!draft.parts[s.id]?.trim()).length}/{frame.sections.length} phần đã viết</p>
        {slots.length > 0 && <p className="text-sm text-warning" role="status">Còn {slots.length} chỗ trong ngoặc vuông cần thay bằng nội dung của bạn. Phần gợi ý trong ngoặc chưa được tính vào số từ.</p>}
        <details><summary className="cursor-pointer font-medium text-primary">Xem bài đã ghép</summary><Textarea className="mt-3" rows={12} readOnly aria-label="Bài viết đã ghép" value={text} /></details>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Checklist tự rà soát</legend>{checks.map((label, i) => <label key={label} className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={draft.checks[String(i)] ?? false} onChange={(e) => setDraft((d) => ({ ...d, checks: { ...d.checks, [String(i)]: e.target.checked } }))} /><span>{label}</span></label>)}</fieldset>
        <p className="text-xs text-muted">Đã tự rà soát {checks.filter((_, i) => draft.checks[String(i)]).length}/{checks.length} mục. Hãy dùng cùng khung cho chủ đề khác ở danh sách phía trên.</p>
      </CardContent></Card>
    </>}

    {state.step === "memory" && <FrameMemory frame={frame} run={state.recall[frame.id]} onRun={setRun} onWrite={() => setState((s) => ({ ...s, step: "write" }))} />}
    <p className="text-xs text-muted">Khung do ứng dụng biên soạn để tự luyện. Tham khảo <a href={FRAME_FORMAT_SOURCE} target="_blank" rel="noreferrer" className="text-primary underline">định dạng VSTEP.3–5 từ ULIS–VNU</a>; các khoảng luyện 20/40 phút ở trên là gợi ý phân bổ thời gian.</p>
  </div>;
}

function FrameMemory({ frame, run, onRun, onWrite }: { frame: WritingFrame; run?: FrameRecall; onRun: (fn: (r: FrameRecall) => FrameRecall) => void; onWrite: () => void }) {
  const cue = run && frame.cues.find((c) => c.id === run.ids[run.index]);
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { input.current?.focus(); }, [cue?.id, frame.id]);
  const answer = cue && run?.answers[cue.id];
  const start = () => onRun(() => freshRecall(frame));
  if (!run) return <Card><CardHeader><CardTitle>Học thuộc khung: {frame.title}</CardTitle></CardHeader><CardContent className="space-y-3">
    <p>Nhìn gợi ý tiếng Việt, tự gõ lại câu dẫn tiếng Anh trước khi xem mẫu. Khung này có {frame.cues.length} cụm cần nhớ.</p>
    <p className="text-sm text-muted">Thứ tự bố cục: {frame.sections.map((s) => s.title).join(" → ")}. Thuộc câu dẫn rồi tập thay ý bằng nhiều chủ đề.</p>
    <Button onClick={start}><Brain size={16} />Bắt đầu học thuộc</Button>
  </CardContent></Card>;
  if (!cue) {
    const unaided = run.ids.filter((id) => run.answers[id]?.correct && !run.answers[id]?.hinted).length;
    const retry = run.ids.filter((id) => !run.answers[id]?.correct || run.answers[id]?.hinted);
    return <Card data-testid="frame-memory-result"><CardHeader><CardTitle>Nhớ không gợi ý {unaided}/{run.ids.length} cụm trong lượt này</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-muted">Thử nhớ lại sau một đề viết nữa. Cụm đã xem mẫu hoặc trả lời sai cần được luyện lại mà không nhìn.</p>
      <div className="flex flex-wrap gap-2">{retry.length > 0 && <Button onClick={() => onRun(() => freshRecall(frame, retry))}>Ôn {retry.length} cụm cần nhớ lại</Button>}<Button variant="outline" onClick={start}>Luyện lại toàn khung</Button><Button onClick={onWrite}>Áp dụng vào bài viết</Button></div>
    </CardContent></Card>;
  }
  return <Card data-testid="frame-memory"><CardHeader><CardTitle>Nhớ lại câu dẫn — {frame.title}</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="flex flex-wrap gap-2"><Badge tone="primary">Cụm {run.index + 1}/{run.ids.length}</Badge><Badge>{frame.sections.find((s) => s.id === cue.section)?.title}</Badge></div>
    <Progress value={100 * run.index / run.ids.length} label={`Đã ôn ${run.index}/${run.ids.length} cụm`} />
    <p className="font-semibold">{cue.hint}</p>
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (answer?.checked) onRun(nextRecall); else onRun((r) => checkRecall(frame, r)); }}>
      <label className="block text-sm">Gõ câu dẫn từ trí nhớ<Input ref={input} className="mt-1" value={answer?.text ?? ""} readOnly={answer?.checked} onChange={(e) => onRun((r) => updateRecallText(r, e.target.value))} autoComplete="off" autoCapitalize="off" spellCheck={false} /></label>
      {(answer?.hinted || answer?.checked) && <div className="rounded-xl bg-surface-2 p-3" role="status">
        {answer.checked && <p className="font-semibold">{answer.correct ? answer.hinted ? "Đúng khi đã xem gợi ý" : "Nhớ đúng không cần gợi ý" : "Chưa khớp cụm mẫu"}</p>}
        <p className="mt-1 font-medium text-primary">{cue.answer}</p><p className="mt-1 text-xs text-muted">Khi viết bài thật, bạn có thể dùng cách diễn đạt phù hợp khác; lượt này luyện nhớ cụm mẫu.</p>
      </div>}
      <div className="flex flex-wrap gap-2">{!answer?.checked && <Button variant="outline" onClick={() => onRun(revealRecall)}>Xem cụm mẫu</Button>}
        <Button type="submit" disabled={!answer?.checked && !answer?.text.trim()}>{answer?.checked ? run.index + 1 < run.ids.length ? "Cụm tiếp" : "Xem kết quả" : "Kiểm tra trí nhớ"}</Button></div>
    </form>
    <p className="text-xs text-muted">Có thể bỏ qua khác biệt chữ hoa và dấu câu. Xem mẫu trước không được tính là tự nhớ trong lượt này. Câu đang làm được lưu khi tải lại.</p>
  </CardContent></Card>;
}
