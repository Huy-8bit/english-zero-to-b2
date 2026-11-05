import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DOMAIN_PACKS, DOMAIN_PHRASES, type DomainId } from "./topicVocabulary";
import { makeRun, type RescueState } from "./state";
import { PhraseDetails, PhraseDrill } from "./PhraseDrill";
import { HighlightChunks } from "./TopicLab";

export function DomainVocabulary({ state, update }: { state: RescueState; update: (fn: (s: RescueState) => RescueState) => void }) {
  const view = state.domainView ?? { id: "economy", scope: "priority", practice: false };
  const pack = DOMAIN_PACKS.find((p) => p.id === view.id) ?? DOMAIN_PACKS[0];
  const all = DOMAIN_PHRASES.filter((p) => p.domain === pack.id);
  const selected = all.filter((p) => view.scope === "all" || p.priority);
  const runKey = `domain-${pack.id}-${view.scope}`;
  const run = state.runs[runKey];
  const [query, setQuery] = useState("");
  const shown = selected.filter((p) => `${p.en} ${p.vi}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));
  const learned = all.filter((p) => (state.items[p.id]?.clean ?? 0) >= 2).length;
  const weak = all.filter((p) => (state.items[p.id]?.misses ?? 0) > 0 && (state.items[p.id]?.clean ?? 0) < 2);
  const setView = (patch: Partial<typeof view>) => update((s) => ({ ...s, domainView: { ...(s.domainView ?? view), ...patch } }));
  const start = (fresh = false) => update((s) => {
    const ids = selected.map((p) => p.id);
    return { ...s, domainView: { ...view, practice: true }, runs: { ...s.runs, [runKey]: !fresh && s.runs[runKey]?.queue.length ? s.runs[runKey] : makeRun(ids) } };
  });
  const draftKey = `domain-output-${pack.id}`;
  return <div className="space-y-5" data-testid="domain-vocabulary">
    <Card className="space-y-4 p-5">
      <h2 className="text-xl font-bold">72 từ/cụm cho 6 lĩnh vực cần thiết</h2>
      <p className="text-sm leading-6 text-muted">Mỗi lĩnh vực có 6 mục ưu tiên + 6 mục học thêm. Trong chặng vận dụng 20 phút, chọn một lĩnh vực bạn yếu: 10 phút luyện 6 mục ưu tiên, 5 phút viết 3 câu, 5 phút nói lại. Đây là lựa chọn thay cho bài chuyển chủ đề ở chặng đó, không cộng thêm vào lịch 240 phút.</p>
      <label className="block text-sm font-medium" htmlFor="domain-select">Lĩnh vực cần học</label>
      <select id="domain-select" value={pack.id} onChange={(e) => { setQuery(""); setView({ id: e.target.value as DomainId, practice: false }); }} className="min-h-11 w-full rounded-xl border border-border bg-surface px-3">{DOMAIN_PACKS.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lượng từ cần học"><Button variant={view.scope === "priority" ? "primary" : "outline"} aria-pressed={view.scope === "priority"} onClick={() => { setQuery(""); setView({ scope: "priority", practice: false }); }}>6 mục ưu tiên</Button><Button variant={view.scope === "all" ? "primary" : "outline"} aria-pressed={view.scope === "all"} onClick={() => { setQuery(""); setView({ scope: "all", practice: false }); }}>Đủ 12 mục</Button></div>
      <p className="text-sm" data-testid="domain-progress"><b>{learned}/12</b> mục tự nhớ 2 lượt trong lĩnh vực này · {weak.length} mục cần ôn lại</p>
      <p className="text-xs text-muted">Tiến độ này được lưu riêng theo mục; không cộng vào chỉ số 60 cụm lõi ở đầu trang. Tự nhớ cách nhau ít nhất 3 lượt trả lời mới được tính hai lượt.</p>
      {!view.practice && <div className="flex flex-wrap gap-2"><Button onClick={() => start()}>{run?.queue.length ? "Tiếp tục lượt gõ đang dở" : `Gõ nhớ ${selected.length} mục đã chọn`}</Button></div>}
      {view.practice && <Button variant="outline" onClick={() => setView({ practice: false })}>Về danh sách từ · giữ lượt gõ</Button>}
    </Card>
    {view.practice ? <PhraseDrill key={runKey} state={state} runKey={runKey} update={update} nextBlock={() => setView({ practice: false })} nextLabel="Về danh sách từ" restart={() => start(true)} /> : <>
      <Card className="space-y-3 p-5"><label className="block text-sm" htmlFor="domain-search">Tìm từ trong lĩnh vực đã chọn</label><input id="domain-search" value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-surface px-3" /><p className="text-xs text-muted">{shown.length}/{selected.length} mục · mở từng mục để xem cách ghép, ví dụ và lỗi cần tránh</p>
        {shown.map((p) => <details key={p.id} className="border-t border-border py-2" data-testid="domain-word"><summary className="cursor-pointer py-2 text-sm"><span className="mb-1 block text-xs font-semibold text-primary">{p.priority ? "Ưu tiên trong buổi cấp tốc" : "Học thêm khi còn thời gian"}</span><b lang="en">{p.en}</b> · {p.vi}</summary><div className="py-3"><PhraseDetails phrase={p} /></div></details>)}
        {!shown.length && <p className="text-sm">Chưa có kết quả. Thử chọn đủ 12 mục hoặc đổi từ khóa.</p>}
      </Card>
      <Card className="space-y-4 p-5"><h3 className="font-bold">Dùng từ vào đề cụ thể</h3><p className="rounded-xl bg-surface-2 p-4" lang="en">{pack.prompt}</p><p className="text-sm text-muted">Đề luyện tự soạn. Gợi ý phát triển ý: {pack.plan}</p><label className="block text-sm font-medium" htmlFor="domain-output">Ba câu của tôi</label><textarea id="domain-output" value={state.drafts[draftKey]?.text ?? ""} onChange={(e) => update((s) => ({ ...s, drafts: { ...s.drafts, [draftKey]: { text: e.target.value, checks: {}, at: Date.now() } } }))} placeholder="Ý chính → lý do → ví dụ. Dùng 2–3 cụm vừa học, rồi nói lại không nhìn." className="min-h-36 w-full rounded-xl border border-border bg-surface p-3 text-base" />
        {state.drafts[draftKey]?.text && <div className="rounded-xl border border-border p-3 text-sm leading-7"><HighlightChunks text={state.drafts[draftKey].text} /></div>}
        <p className="text-xs text-muted">Tự lưu bản nháp. Cụm trùng nguyên dạng được gạch chân để tự kiểm tra; chưa chấm nghĩa hoặc ngữ pháp.</p>
      </Card>
    </>}
  </div>;
}
