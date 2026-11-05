import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SpeakButton } from "@/components/SpeakButton";
import { PHRASES } from "./content";
import { TOPICS } from "./topics";
import { matches, type RescueState } from "./state";

/** Highlight exact known chunks without treating matches as a language-quality score. */
export function HighlightChunks({ text }: { text: string }) {
  const escaped = PHRASES.map((p) => p.en).sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  const output: ReactNode[] = [];
  let start = 0;
  for (const match of text.matchAll(re)) {
    output.push(text.slice(start, match.index));
    output.push(<u key={match.index} className="decoration-primary decoration-2 underline-offset-4">{match[0]}</u>);
    start = match.index + match[0].length;
  }
  output.push(text.slice(start));
  return <span className="whitespace-pre-wrap" lang="en">{output}</span>;
}

export function TopicLab({ state, update, initialTopic = "education" }: { state: RescueState; update: (fn: (s: RescueState) => RescueState) => void; initialTopic?: string }) {
  const [id, setId] = useState(initialTopic);
  const topic = TOPICS.find((t) => t.id === id) ?? TOPICS[0];
  const saved = state.transfers[id] ?? { text: "", correct: false, hinted: false, at: 0 };
  const [checked, setChecked] = useState(false);
  const patch = (p: Partial<typeof saved>) => update((s) => ({ ...s, transfers: { ...s.transfers, [id]: { ...(s.transfers[id] ?? saved), ...p, at: Date.now() } } }));
  return <div className="space-y-5">
    <Card className="space-y-4 p-5"><h2 className="text-xl font-bold">Một bộ cụm, nhiều chủ đề</h2><p className="text-sm text-muted">Trong 20 phút: dành 10 phút làm 12 câu chuyển chủ đề, 5 phút đọc 3 chủ đề bạn yếu nhất, 5 phút tự nói lại. 48 cụm theo chủ đề là phần tra cứu; ưu tiên 60 cụm lõi trước.</p>
      <label className="block text-sm font-medium">Chủ đề luyện<select value={id} onChange={(e) => { setId(e.target.value); setChecked(false); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3">{TOPICS.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <div className="grid gap-2 sm:grid-cols-2">{topic.words.map(([en, vi]) => <div key={en} className="rounded-xl bg-surface-2 p-3"><div className="flex items-center justify-between gap-2"><b lang="en">{en}</b><SpeakButton text={en} /></div><p className="text-sm text-muted">{vi}</p></div>)}</div>
      <form className="space-y-3 border-t border-border pt-4" onSubmit={(e) => { e.preventDefault(); setChecked(true); patch({ correct: matches(saved.text, topic.answer) && !saved.hinted }); }}>
        <p className="font-medium">Điền cụm đã học vào chỗ trống</p><p lang="en">{topic.transfer}</p>
        <label className="block text-sm">Cụm còn thiếu<input value={saved.text} autoComplete="off" onChange={(e) => { patch({ text: e.target.value, correct: false }); setChecked(false); }} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3" /></label>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!saved.text.trim()}>Kiểm tra câu</Button><Button variant="outline" onClick={() => { patch({ hinted: true, correct: false }); setChecked(true); }}>Xem cụm gợi ý</Button>{(checked || saved.hinted || saved.correct) && <Button variant="ghost" onClick={() => { patch({ text: "", hinted: false, correct: false }); setChecked(false); }}>Tự thử lại</Button>}</div>
        {(checked || saved.correct || saved.hinted) && <p role="status" className="text-sm">{saved.correct ? "Đúng — đã tự điền được trong ngữ cảnh này." : `Cụm gợi ý: ${topic.answer}. Tự viết thêm một câu với chủ đề khác.`}</p>}
      </form>
    </Card>
    <Card className="space-y-4 p-5"><h3 className="font-bold">Xem cách cụm hoạt động trong câu</h3><p className="text-sm text-muted">Đoạn minh họa từ vựng tự soạn, chưa phải toàn bộ bài thi. Cụm gạch chân thuộc bộ 60 cụm.</p>
      <details><summary className="cursor-pointer py-2 font-medium">Writing · đề cụ thể & đoạn minh họa</summary><p className="my-3 text-sm text-muted" lang="en">{topic.prompt}</p><div className="leading-8"><HighlightChunks text={topic.writing} /></div><SpeakButton text={topic.writing} /></details>
      <details><summary className="cursor-pointer py-2 font-medium">Speaking · câu trả lời tự nhiên</summary><div className="leading-8"><HighlightChunks text={topic.speaking} /></div><SpeakButton text={topic.speaking} /></details>
      <label className="block text-sm font-medium">Câu của tôi với chủ đề này<textarea value={state.drafts[`topic-${id}`]?.text ?? ""} onChange={(e) => update((s) => ({ ...s, drafts: { ...s.drafts, [`topic-${id}`]: { text: e.target.value, checks: {}, at: Date.now() } } }))} placeholder="Viết 2–3 câu: ý chính → lý do → ví dụ của bạn." className="mt-2 min-h-32 w-full rounded-xl border border-border bg-surface p-3 text-base" /></label>
      <p className="text-xs text-muted">Tự lưu bản nháp. Đọc lại: cụm đúng nghĩa chưa, có chi tiết riêng của chủ đề chưa?</p>
    </Card>
  </div>;
}
