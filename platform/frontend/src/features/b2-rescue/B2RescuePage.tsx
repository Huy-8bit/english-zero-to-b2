import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Clock3, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/misc";
import { TtsNote } from "@/components/SpeakButton";
import { cn, safeStorage } from "@/lib/utils";
import { PACKS, PHRASES, SOURCES } from "./content";
import { PLAN, STORAGE_KEY, TOTAL_SECONDS, addSeconds, makeRun, restoreState, reviewIds, stats, usedSeconds, type RescueState } from "./state";
import { PhraseDetails, PhraseDrill } from "./PhraseDrill";
import { TopicLab } from "./TopicLab";
import { OutputPractice } from "./OutputPractice";

const time = (seconds: number) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;

export default function B2RescuePage() {
  const [state, setState] = useState(() => restoreState(safeStorage().get<RescueState | null>(STORAGE_KEY, null)));
  const latest = useRef(state);
  const update = useCallback((fn: (s: RescueState) => RescueState) => {
    const next = fn(latest.current); latest.current = next; setState(next); safeStorage().set(STORAGE_KEY, next);
  }, []);
  const [tab, setTab] = useState<"course" | "toolkit" | "results">("course");
  const [running, setRunning] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [query, setQuery] = useState("");
  const [packFilter, setPackFilter] = useState("all");
  const block = PLAN.find((b) => b.id === state.block) ?? PLAN[0];
  const [notice, setNotice] = useState("");
  const counts = stats(state);
  const blockSeconds = (state.seconds[block.id] ?? 0) + liveSeconds;
  const total = usedSeconds(state) + liveSeconds;
  const flushTimer = useRef<() => void>(() => {});

  // Save every five seconds and on pause/navigation; hidden tabs stop the study timer.
  useEffect(() => {
    if (!running) return;
    const id = block.id;
    let last = Date.now();
    let pending = 0;
    const flush = () => {
      pending += Math.max(0, Date.now() - last) / 1000; last = Date.now();
      const whole = Math.floor(pending);
      pending -= whole;
      if (whole) update((s) => addSeconds(s, id, whole));
      setLiveSeconds(0);
    };
    flushTimer.current = flush;
    const timer = setInterval(() => {
      pending += Math.max(0, Date.now() - last) / 1000; last = Date.now();
      const spent = (latest.current.seconds[id] ?? 0) + pending;
      if (pending >= 5 || spent >= block.minutes * 60) flush(); else setLiveSeconds(Math.floor(pending));
      if (spent >= block.minutes * 60) { setRunning(false); setNotice("Hết thời gian chặng này. Chuyển chặng để giữ tổng lịch trong 4 tiếng; bài đang làm vẫn được lưu."); }
    }, 1000);
    const hidden = () => { if (document.hidden) { flush(); setRunning(false); setNotice("Đã tạm dừng giờ khi bạn rời tab. Bấm tiếp tục khi sẵn sàng."); } };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", flush);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("pagehide", flush); flush(); flushTimer.current = () => {}; };
  }, [running, block.id, block.minutes, update]);

  const selectBlock = (id: string) => {
    flushTimer.current(); setRunning(false); setLiveSeconds(0); setNotice(""); setTab("course");
    update((s) => {
      const next = PLAN.find((b) => b.id === id)!;
      if ((next.kind === "learn" || next.kind === "review") && !s.runs[id]) {
        const ids = next.kind === "review" ? reviewIds(s) : PHRASES.filter((p) => p.pack === next.pack).map((p) => p.id);
        return { ...s, block: id, runs: { ...s.runs, [id]: makeRun(ids, next.kind === "review") } };
      }
      return { ...s, block: id };
    });
  };
  const restart = () => update((s) => ({ ...s, runs: { ...s.runs, [block.id]: makeRun(block.kind === "review" ? reviewIds(s) : PHRASES.filter((p) => p.pack === block.pack).map((p) => p.id), true) } }));
  const openReview = () => {
    selectBlock("review");
    update((s) => s.runs.review?.queue.length ? s : { ...s, runs: { ...s.runs, review: makeRun(reviewIds(s), true) } });
  };
  const nextBlock = () => selectBlock(PLAN[Math.min(PLAN.findIndex((b) => b.id === block.id) + 1, PLAN.length - 1)].id);
  const openTab = (next: typeof tab) => { flushTimer.current(); setRunning(false); setTab(next); };
  const startTimer = () => {
    if (running) { flushTimer.current(); setRunning(false); return; }
    setNotice(""); setRunning(true);
  };
  const filtered = PHRASES.filter((p) => (packFilter === "all" || p.pack === packFilter) && `${p.en} ${p.vi} ${p.pattern}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")));

  return <div className="mx-auto max-w-5xl space-y-6" data-testid="b2-rescue">
    <PageHeader title="B2 · 4 giờ để có từ mà viết, mà nói" subtitle="60 cụm ưu tiên + 48 cụm theo 12 chủ đề · Writing & Speaking VSTEP" />
    <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary-soft/70 to-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-widest text-primary">Học cụm dùng được · tập nhớ thật</p><h2 className="mt-2 text-2xl font-bold">Nhớ cụm cốt lõi, dùng cho nhiều chủ đề.</h2><p className="mt-3 text-sm leading-6 text-muted">Nhìn–gõ → che đáp án → gặp lại → đổi chủ đề → viết và nói. Bộ ưu tiên này giúp ôn cấp tốc; 4 tiếng không thay thế toàn bộ vốn từ và kỹ năng B2.</p></div><div className="rounded-2xl border border-primary/20 bg-surface/80 px-5 py-4"><p className="text-xs text-muted">Quỹ thời gian còn lại</p><p className="mt-1 font-mono text-3xl font-bold tabular-nums" data-testid="total-time">{time(TOTAL_SECONDS - total)}</p><p className="mt-1 text-xs text-muted">Gồm 10 phút nghỉ · chỉ đếm khi bật</p></div></div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4">{[[counts.seen, "đã học / 60"], [counts.recalled, "tự nhớ 2 lượt / 60"], [counts.weak, "cần ôn lại"]].map(([n, label]) => <div key={label} className="min-w-0"><b className="text-xl">{n}</b><p className="text-xs leading-5 text-muted">{label}</p></div>)}</div>
    </Card>
    <nav aria-label="Chế độ ôn B2" className="flex flex-wrap gap-2">{([['course', 'Lộ trình 4 tiếng'], ['toolkit', 'Tra cứu 108 cụm'], ['results', 'Kết quả & từ hay quên']] as const).map(([value, label]) => <Button key={value} variant={tab === value ? "primary" : "outline"} aria-pressed={tab === value} onClick={() => openTab(value)}>{label}</Button>)}</nav>

    {tab === "course" && <div className="space-y-5">
      <Card className="p-4"><label className="block text-sm font-medium">Chặng hiện tại<select value={block.id} onChange={(e) => selectBlock(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-3">{PLAN.map((b, i) => <option key={b.id} value={b.id}>{i + 1}. {b.title} · {b.minutes} phút</option>)}</select></label>
        <div className="my-3 flex flex-wrap items-center gap-3"><span className="inline-flex items-center gap-2 text-sm tabular-nums"><Clock3 size={16} /><span data-testid="block-time">{time(block.minutes * 60 - blockSeconds)}</span> còn lại</span><Button size="sm" variant={running ? "secondary" : "primary"} disabled={blockSeconds >= block.minutes * 60} onClick={startTimer}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? "Tạm dừng" : "Bắt đầu / tiếp tục giờ"}</Button><Button size="sm" variant="ghost" onClick={nextBlock} disabled={block.id === "finish"}>Chặng tiếp <ArrowRight size={15} /></Button></div>
        <Progress value={blockSeconds / (block.minutes * 60) * 100} label={`Thời gian chặng ${block.title}`} />
        <p className="mt-2 text-xs text-muted">Đổi chặng, rời trang hoặc ẩn tab sẽ tạm dừng. Bạn vẫn làm bài được khi đồng hồ dừng. Hết giờ chặng không xóa bài đang làm.</p>
        {notice && <p role="status" className="mt-3 rounded-xl bg-primary-soft p-3 text-sm text-primary">{notice}</p>}
      </Card>
      {block.kind === "intro" && <Card className="space-y-5 p-5 sm:p-7"><h2 className="text-xl font-bold">Bắt đầu từ những cụm bạn sẽ dùng nhiều</h2><p className="leading-7">Đừng học 108 cụm một lượt. Sáu nhóm lõi có 10 cụm/nhóm, mỗi nhóm 20 phút. Gõ lại từng cụm sau khi đọc ví dụ; sau đó app che tiếng Anh và hỏi lại hai vòng. Cụm sai hoặc xem gợi ý được đưa về cuối lượt.</p><ol className="list-decimal space-y-2 pl-5 text-sm leading-6"><li>Chỉ gõ cụm in lớn, chưa cần thuộc cả câu ví dụ.</li><li>Đọc thành tiếng một câu của bạn khi tự nhớ đúng.</li><li>Hết 20 phút thì chuyển chặng, để cụm chưa nhớ vào lượt ôn cuối.</li><li>Khi đổi chủ đề, giữ cụm nhưng đổi người, hành động và chi tiết cụ thể.</li></ol><div className="rounded-xl bg-surface-2 p-4"><p className="font-medium" lang="en">save time → tiết kiệm thời gian</p><p className="mt-2 text-sm" lang="en">Online classes help me <u>save time</u>.<br />Planning meals helps me <u>save time</u>.<br />A direct train can help us <u>save time</u>.</p></div><Button onClick={() => selectBlock("benefits")}>Bắt đầu 10 cụm đầu tiên <ArrowRight size={16} /></Button><p className="text-xs text-muted">Không cần hoàn thành khóa khung Writing trước. Chế độ này mở ngay và có tiến độ riêng.</p></Card>}
      {(block.kind === "learn" || block.kind === "review") && (state.runs[block.id] ? <><p className="text-sm text-muted">{block.kind === "review" ? "Ôn trộn cả 60 cụm, ưu tiên cụm từng sai rồi đến cụm chưa học. Làm trong 25 phút; phần chưa xong vẫn giữ để học tiếp." : "10 cụm × 3 lượt: nhìn–gõ, nhớ lại vòng 1, nhớ lại vòng 2. Cụm sai sẽ quay lại; không cần cố gõ hết nếu đã hết giờ."}</p><PhraseDrill state={state} runKey={block.id} update={update} nextBlock={nextBlock} restart={restart} /></> : <Button onClick={() => selectBlock(block.id)}>Mở lượt luyện</Button>)}
      {block.kind === "break" && <Card className="space-y-4 p-7 text-center"><p className="text-4xl" aria-hidden>☕</p><h2 className="text-xl font-bold">Nghỉ 5 phút để quay lại học</h2><p>Đứng dậy, nhìn xa, uống nước. Không cần học thêm từ mới trong chặng này.</p><p className="text-sm text-muted">Bật đồng hồ ở trên; nếu đổi tab, đồng hồ sẽ tạm dừng.</p><Button variant="outline" onClick={nextBlock}>Tôi sẵn sàng học tiếp</Button></Card>}
      {block.kind === "transfer" && <TopicLab state={state} update={update} />}
      {(block.kind === "writing" || block.kind === "speaking") && <OutputPractice key={block.kind} kind={block.kind} state={state} update={update} />}
      {block.kind === "finish" && <Results state={state} onReview={openReview} />}
      <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-semibold">Xem toàn bộ lịch · đúng 240 phút</summary><ol className="mt-3 space-y-1">{PLAN.map((b, i) => { const from = PLAN.slice(0, i).reduce((s, item) => s + item.minutes, 0); return <li key={b.id}><button className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => selectBlock(b.id)}><span>{b.title}</span><span className="shrink-0 font-mono text-xs text-muted">{from}–{from + b.minutes}′</span></button></li>; })}</ol></details>
    </div>}
    {tab === "toolkit" && <div className="space-y-5"><Card className="space-y-4 p-5"><h2 className="text-xl font-bold">60 cụm lõi · nghĩa, cách ghép, ví dụ</h2><p className="text-sm text-muted">Các cụm đơn giản cũng hữu ích trong bài B2 khi dùng chính xác. Đây là bộ ưu tiên biên soạn cho khóa này, không phải danh sách từ bắt buộc chính thức.</p><label className="block text-sm">Tìm cụm hoặc nghĩa Việt<input value={query} onChange={(e) => setQuery(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3" /></label><label className="block text-sm">Nhóm cụm từ<select value={packFilter} onChange={(e) => setPackFilter(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3"><option value="all">Tất cả 60 cụm</option>{PACKS.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><TtsNote /><p className="text-sm text-muted">{filtered.length} cụm phù hợp</p>{filtered.map((p) => <details key={p.id} className="border-t border-border py-2"><summary className="cursor-pointer py-2 text-sm"><b lang="en">{p.en}</b><span className="text-muted"> · {p.vi}</span></summary><div className="py-3"><PhraseDetails phrase={p} /></div></details>)}{!filtered.length && <p>Không tìm thấy cụm phù hợp. Thử từ khóa ngắn hơn hoặc chọn tất cả nhóm.</p>}</Card><TopicLab state={state} update={update} /></div>}
    {tab === "results" && <Results state={state} onReview={openReview} />}
    <details className="rounded-xl border border-border p-4 text-sm"><summary className="cursor-pointer font-semibold">Cơ sở biên soạn & cách dùng bộ cấp tốc</summary><p className="my-3 leading-6 text-muted">Nội dung và lịch học do app biên soạn, tham chiếu mô tả B2, cấu trúc VSTEP và cách luyện nhớ lại có phản hồi. Hai lượt tự nhớ trong buổi chưa chứng minh nhớ lâu hay đạt B2. Với đề lạ, diễn đạt bằng từ quen thuộc, nêu đúng yêu cầu và thêm ví dụ riêng; không ép một câu vào mọi đề. Cụm trong bài nói có thể được rút gọn cho tự nhiên.</p><ul className="list-disc space-y-2 pl-5">{SOURCES.map((s) => <li key={s.url}><a className="text-primary underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}<li><a className="text-primary underline" href="https://vstep.dthu.edu.vn/mainpage/page/27.pdf" target="_blank" rel="noreferrer">Đề mẫu ĐH Đồng Tháp · tham chiếu tình huống quà tặng Speaking Part 2 (trang PDF 17)</a></li></ul></details>
    <div className="flex flex-wrap gap-4 text-sm text-primary"><Link to="/writing-studio?mode=exam" className="inline-flex items-center gap-2 underline"><BookOpen size={16} />Khung Writing đã học</Link><Link to="/model-library?skill=speaking" className="underline">Bài mẫu Speaking</Link><Link to="/vocabulary" className="underline">Từ vựng hằng ngày</Link></div>
  </div>;
}

function Results({ state, onReview }: { state: RescueState; onReview: () => void }) {
  const counts = stats(state);
  const need = reviewIds(state).filter((id) => (state.items[id]?.clean ?? 0) < 2);
  const used = PHRASES.filter((p) => Object.values(state.drafts).some((d) => d.text.toLowerCase().includes(p.en.toLowerCase())));
  return <Card className="space-y-5 p-5 sm:p-7"><h2 className="text-xl font-bold">Những gì bạn đã thực sự luyện</h2><p className="leading-7"><b>{counts.recalled}/60</b> cụm tự nhớ đúng hai lượt, cách nhau ít nhất ba lượt trả lời. <b>{need.length}</b> cụm còn cần ôn; trong đó <b>{counts.weak}</b> cụm đã sai hoặc bỏ qua. Nhìn–gõ và xem gợi ý không được tính là tự nhớ.</p><Progress value={counts.recalled / 60 * 100} label="Số cụm tự nhớ hai lượt" /><p className="text-sm text-muted">{Object.values(state.transfers).filter((t) => t.correct && !t.hinted).length}/12 câu chuyển chủ đề tự điền đúng · {used.length} cụm xuất hiện nguyên dạng trong bản nháp (chưa chấm cách dùng).</p><Button onClick={onReview}>Mở lượt ôn cuối, ưu tiên cụm yếu</Button><div className="grid gap-2 sm:grid-cols-2">{need.slice(0, 12).map((id) => { const p = PHRASES.find((x) => x.id === id)!; return <div key={id} className="rounded-xl bg-surface-2 p-3 text-sm"><b lang="en">{p.en}</b><p className="text-muted">{p.vi}</p><span className={cn("text-xs", state.items[id]?.misses ? "text-warning" : "text-muted")}>{state.items[id] ? "Cần tự nhớ thêm" : "Chưa luyện"}</span></div>; })}</div><p className="text-sm leading-6">Khi chỉ còn ít phút: chọn 5 cụm chưa chắc, nói mỗi cụm trong một câu thật về bản thân, rồi che và gõ lại. Sau buổi này, ôn lại vào ngày mai nếu còn thời gian. Giữ câu đúng, rõ và bám đề trước khi tìm từ khó.</p></Card>;
}
